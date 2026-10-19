// VN Telex — GNOME Shell extension (Wayland & X11)
// Select Telex text → press the hotkey → the selection is replaced with Vietnamese.
// Copies the selection with a virtual Ctrl+C, pastes the result with Ctrl+V,
// then restores the previous clipboard. Copyous is put in incognito mode meanwhile.
// With nothing selected, selects to paragraph start (Ctrl+Shift+ArrowUp) and converts that —
// automatically, after asking, or not at all (setting 'empty-selection').

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';

import {telexTransform, parseSkips} from './telex.js';
import {translator} from './i18n.js';

// Ctrl+V does not paste in terminals, and pasting into Neovim normal mode runs the text as commands.
const TERMINALS = [
    'gnome-terminal', 'gnome-terminal-server', 'org.gnome.terminal', 'org.gnome.ptyxis', 'ptyxis',
    'kgx', 'org.gnome.console', 'kitty', 'alacritty', 'org.wezfurlong.wezterm', 'wezterm',
    'com.mitchellh.ghostty', 'ghostty', 'tilix', 'com.gexperts.tilix', 'konsole', 'org.kde.konsole',
    'foot', 'footclient', 'xterm', 'terminator', 'com.raggesilver.blackbox', 'blackbox', 'dev.warp.warp',
];

// A conversion that hasn't finished by then is abandoned so the hotkey never stays dead
const BUSY_TIMEOUT_MS = 5000;

// Clipboard polling interval while waiting for Ctrl+C; the total wait is the 'copy-timeout' setting
const COPY_POLL_MS = 30;

const MODS = Clutter.ModifierType.SHIFT_MASK | Clutter.ModifierType.CONTROL_MASK |
    Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.MOD4_MASK |
    Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.HYPER_MASK | Clutter.ModifierType.META_MASK;

export default class VnTelexExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._ = translator(this._settings);
        this._clipboard = St.Clipboard.get_default();
        this._icon = Gio.FileIcon.new(this.dir.get_child('icons').get_child('vn-telex.svg'));
        const seat = Clutter.get_default_backend().get_default_seat();
        this._kbd = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        this._timeouts = new Set();
        this._busy = false;

        Main.wm.addKeybinding('hotkey', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this._run());
    }

    disable() {
        Main.wm.removeKeybinding('hotkey');
        this._dialog?.close();
        this._dialog = null;
        this._endIncognito?.();
        this._source?.destroy();
        this._source = null;
        for (const id of this._timeouts)
            GLib.source_remove(id);
        this._timeouts = null;
        this._kbd = null;
        this._clipboard = null;
        this._icon = null;
        this._settings = null;
        this._ = null;
    }

    _later(ms, fn) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._timeouts?.delete(id);
            if (!this._settings)
                return GLib.SOURCE_REMOVE;
            try {
                fn();
            } catch (e) {
                logError(e, 'VN Telex');
                this._endIncognito?.();
                this._busy = false;
            }
            return GLib.SOURCE_REMOVE;
        });
        this._timeouts.add(id);
    }

    // ---------- Notifications with the extension's own icon ----------

    _notify(body) {
        if (!this._settings.get_boolean('show-notifications'))
            return;
        if (!this._source) {
            this._source = new MessageTray.Source({title: 'VN Telex', icon: this._icon});
            this._source.connect('destroy', () => {
                this._source = null;
            });
            Main.messageTray.add(this._source);
        }
        const notification = new MessageTray.Notification({
            source: this._source,
            title: 'VN Telex',
            body,
            gicon: this._icon,
            isTransient: true,
        });
        this._source.addNotification(notification);
    }

    // ---------- Copyous incognito ----------

    // Copyous (copyous@boerdereinar.dev) settings, or null when it isn't installed
    _copyousSettings() {
        const id = 'org.gnome.shell.extensions.copyous';
        try {
            const ext = Main.extensionManager.lookup('copyous@boerdereinar.dev');
            let source = Gio.SettingsSchemaSource.get_default();
            const dir = ext?.dir?.get_child('schemas');
            if (dir?.query_exists(null))
                source = Gio.SettingsSchemaSource.new_from_directory(dir.get_path(), source, false);
            const schema = source?.lookup(id, true);
            if (!schema || !schema.has_key('incognito'))
                return null;
            return new Gio.Settings({settings_schema: schema});
        } catch (e) {
            return null;
        }
    }

    // Turn incognito on for one conversion; returns finish(cb), which leaves incognito then calls cb
    _beginIncognito() {
        const copyous = this._copyousSettings();
        const wasIncognito = copyous?.get_boolean('incognito') ?? true;
        if (!wasIncognito)
            copyous.set_boolean('incognito', true);
        this._endIncognito = () => {
            if (!wasIncognito)
                copyous.set_boolean('incognito', false);
            this._endIncognito = null;
        };
        // Copyous reads the clipboard asynchronously: leave incognito only after it has settled
        return cb => this._later(300, () => {
            this._endIncognito?.();
            cb();
        });
    }

    // ---------- Main flow ----------

    _isTerminal() {
        const w = global.display.focus_window;
        if (!w)
            return false;
        const ids = [w.get_wm_class(), w.get_wm_class_instance(), w.get_gtk_application_id?.()]
            .filter(Boolean).map(s => s.toLowerCase());
        return ids.some(id => TERMINALS.includes(id) || id.includes('terminal'));
    }

    _run() {
        if (this._busy || this._dialog)
            return;
        if (this._isTerminal()) {
            this._notify(this._('Not supported in terminals — in Neovim, map a key to cli.js.'));
            return;
        }
        this._setBusy();
        const window = global.display.focus_window;

        this._afterModifiersReleased(() => {
            this._convertSelection(found => {
                if (found) {
                    this._busy = false;
                    return;
                }
                switch (this._settings.get_string('empty-selection')) {
                case 'ask':
                    this._busy = false;
                    this._askSelectToLineStart(window);
                    break;
                case 'none':
                    this._busy = false;
                    this._notify(this._('Nothing is selected.'));
                    break;
                default:
                    this._selectToLineStartAndConvert();
                }
            });
        });
    }

    _setBusy() {
        this._busy = true;
        const token = Symbol('busy');
        this._busyToken = token;
        this._later(BUSY_TIMEOUT_MS, () => {
            if (this._busyToken === token)
                this._busy = false;
        });
    }

    // Ctrl+Shift+ArrowUp selects back to the paragraph start, then convert that
    _selectToLineStartAndConvert() {
        this._afterModifiersReleased(() => {
            this._ctrlShift(Clutter.KEY_Up);
            this._later(80, () => {
                this._convertSelection(found => {
                    this._busy = false;
                    if (!found)
                        this._notify(this._('Couldn’t select any text before the cursor.'));
                });
            });
        });
    }

    // Copy the selection, convert, paste, restore. done(found) runs once Copyous has settled.
    // The caller is responsible for clearing this._busy.
    _convertSelection(done) {
        const type = St.ClipboardType.CLIPBOARD;
        const finish = this._beginIncognito();

        this._saveClipboard(saved => {
            // A marker tells us whether Ctrl+C copied anything
            const marker = `⁣vntelex${GLib.get_monotonic_time()}`;
            this._clipboard.set_text(type, marker);
            this._ctrl(Clutter.KEY_c);
            this._waitForCopy(marker, 0, text => {
                if (!text) {
                    this._restoreClipboard(saved);
                    finish(() => done(false));
                    return;
                }
                const out = telexTransform(text, parseSkips(this._settings.get_string('skip-words')));
                if (out === text) {
                    this._restoreClipboard(saved);
                    finish(() => done(true));
                    return;
                }
                this._clipboard.set_text(type, out);
                this._later(30, () => {
                    this._ctrl(Clutter.KEY_v);
                    this._later(400, () => {
                        this._restoreClipboard(saved);
                        finish(() => done(true));
                    });
                });
            });
        });
    }

    // Nothing selected: ask before selecting from the cursor to the start of the line
    _askSelectToLineStart(window) {
        const dialog = new ModalDialog.ModalDialog({destroyOnClose: true});
        const content = new Dialog.MessageDialogContent({
            title: this._('Nothing selected'),
            description: this._('Select this paragraph (Ctrl+Shift+↑) and convert it to Vietnamese?'),
        });
        content.insert_child_at_index(new St.Icon({gicon: this._icon, icon_size: 64, x_align: Clutter.ActorAlign.CENTER}), 0);
        dialog.contentLayout.add_child(content);

        let accepted = false;
        dialog.setButtons([
            {label: this._('Cancel'), action: () => dialog.close(), key: Clutter.KEY_Escape},
            {label: this._('Select & convert'), action: () => {
                accepted = true;
                dialog.close();
            }, default: true},
        ]);

        dialog.connect('closed', () => {
            this._dialog = null;
            if (!accepted || !this._settings)
                return;
            this._setBusy();
            // Give keyboard focus back to the app, then Ctrl+Shift+ArrowUp and convert
            this._later(150, () => {
                if (window && !window.is_destroyed?.() && global.display.focus_window !== window)
                    window.activate(global.get_current_time());
                this._later(100, () => this._selectToLineStartAndConvert());
            });
        });

        this._dialog = dialog;
        dialog.open(global.get_current_time());
    }

    // Poll the clipboard until the app has replaced our marker (max 'copy-timeout' ms)
    _waitForCopy(marker, tries, cb) {
        this._later(COPY_POLL_MS, () => {
            this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (_c, text) => {
                if (!this._settings)
                    return;
                if (text && text !== marker) {
                    cb(text);
                } else if ((tries + 1) * COPY_POLL_MS >= this._settings.get_int('copy-timeout')) {
                    cb(null);
                } else {
                    this._waitForCopy(marker, tries + 1, cb);
                }
            });
        });
    }

    // ---------- Clipboard save / restore ----------

    // Keep the user's clipboard: an image if there is one, otherwise text
    _saveClipboard(cb) {
        const type = St.ClipboardType.CLIPBOARD;
        let mimes = [];
        try {
            mimes = this._clipboard.get_mimetypes(type) ?? [];
        } catch (e) {}
        const image = mimes.find(m => m.startsWith('image/'));
        if (image && this._clipboard.get_content) {
            this._clipboard.get_content(type, image, (_c, bytes) => cb({mime: image, bytes}));
            return;
        }
        this._clipboard.get_text(type, (_c, text) => cb({text}));
    }

    _restoreClipboard(saved) {
        const type = St.ClipboardType.CLIPBOARD;
        if (saved.bytes)
            this._clipboard.set_content(type, saved.mime, saved.bytes);
        else if (saved.text !== null && saved.text !== undefined)
            this._clipboard.set_text(type, saved.text);
    }

    // ---------- Virtual keyboard ----------

    // The hotkey fires on key press; wait until its modifiers are up so we don't send Super+Alt+Ctrl+V
    _afterModifiersReleased(cb, tries = 0) {
        const [, , mods] = global.get_pointer();
        if ((mods & MODS) === 0 || tries >= 50) {
            cb();
            return;
        }
        this._later(20, () => this._afterModifiersReleased(cb, tries + 1));
    }

    _key(keyval, down) {
        this._kbd.notify_keyval(GLib.get_monotonic_time(), keyval,
            down ? Clutter.KeyState.PRESSED : Clutter.KeyState.RELEASED);
    }

    _combo(modifier, keyval) {
        this._key(modifier, true);
        this._key(keyval, true);
        this._key(keyval, false);
        this._key(modifier, false);
    }

    _ctrl(keyval) {
        this._combo(Clutter.KEY_Control_L, keyval);
    }

    _shift(keyval) {
        this._combo(Clutter.KEY_Shift_L, keyval);
    }

    _ctrlShift(keyval) {
        this._key(Clutter.KEY_Control_L, true);
        this._key(Clutter.KEY_Shift_L, true);
        this._key(keyval, true);
        this._key(keyval, false);
        this._key(Clutter.KEY_Shift_L, false);
        this._key(Clutter.KEY_Control_L, false);
    }
}
