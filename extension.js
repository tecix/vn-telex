// VN Telex — GNOME Shell extension (Wayland & X11)
// Select Telex text → press the hotkey → the selection is replaced with Vietnamese.
// Copies the selection with a virtual Ctrl+C, pastes the result with Ctrl+V,
// then restores the previous clipboard. Copyous is put in incognito mode meanwhile.
// With nothing selected, selects to paragraph start (Ctrl+Shift+ArrowUp) and converts that —
// automatically, after asking, or not at all (setting 'empty-selection').
// Fast mode (setting 'fast-mode') reacts to the clipboard owner change instead of polling,
// shortens the wait per app from learned copy times, and runs the fallback in one clipboard session.
// In terminals (setting 'terminal-mode') it copies with Ctrl+Shift+C, erases the changed tail with
// Backspace and pastes it with Ctrl+Shift+V, or only puts the result on the clipboard.

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

// The code points of `from` after its common prefix with `to`, and the code points of `to` that replace them
function changedTail(from, to) {
    const a = [...from];
    const b = [...to];
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i])
        i++;
    return [a.slice(i), b.slice(i).join('')];
}

// Terminals copy and paste with Ctrl+Shift+C / Ctrl+Shift+V and can't replace a selection
const TERMINALS = [
    'gnome-terminal', 'gnome-terminal-server', 'org.gnome.terminal', 'org.gnome.ptyxis', 'ptyxis',
    'kgx', 'org.gnome.console', 'kitty', 'alacritty', 'org.wezfurlong.wezterm', 'wezterm',
    'com.mitchellh.ghostty', 'ghostty', 'tilix', 'com.gexperts.tilix', 'konsole', 'org.kde.konsole',
    'foot', 'footclient', 'terminator', 'com.raggesilver.blackbox', 'blackbox', 'dev.warp.warp',
];

// No Ctrl+Shift+C there: it reaches the shell as Ctrl+C and would interrupt the running program
const NO_COPY_TERMINALS = ['xterm', 'uxterm', 'urxvt', 'rxvt', 'st', 'st-256color'];

// A conversion that hasn't finished by then is abandoned so the hotkey never stays dead
const BUSY_TIMEOUT_MS = 5000;

// Clipboard polling interval while waiting for Ctrl+C; the total wait is the 'copy-timeout' setting
const COPY_POLL_MS = 30;

// Fast mode wait per app: FACTOR × the slowest copy seen there + MARGIN, at least MIN, at most 'copy-timeout'
const FAST_MIN_WAIT_MS = 80;
const FAST_WAIT_FACTOR = 2;
const FAST_WAIT_MARGIN_MS = 40;

// Pause after Ctrl+Shift+ArrowUp before copying; virtual keys arrive in order, so fast mode needs little
const SELECT_SETTLE_MS = 80;
const SELECT_SETTLE_FAST_MS = 20;

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
        this._loadCopyTimes();
        this._settings.connectObject('changed::copy-times', () => this._loadCopyTimes(), this);

        Main.wm.addKeybinding('hotkey', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this._run());
    }

    disable() {
        Main.wm.removeKeybinding('hotkey');
        this._settings.disconnectObject(this);
        global.display.get_selection().disconnectObject(this);
        this._dialog?.disconnectObject(this);
        this._dialog?.close();
        this._dialog = null;
        this._endIncognito?.();
        this._source?.disconnectObject(this);
        this._source?.destroy();
        this._source = null;
        for (const id of this._timeouts)
            GLib.source_remove(id);
        this._timeouts = null;
        this._kbd = null;
        this._copyTimes = null;
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
        return id;
    }

    _cancel(id) {
        if (this._timeouts?.delete(id))
            GLib.source_remove(id);
    }

    // ---------- Notifications with the extension's own icon ----------

    _notify(body) {
        if (!this._settings.get_boolean('show-notifications'))
            return;
        if (!this._source) {
            this._source = new MessageTray.Source({title: 'VN Telex', icon: this._icon});
            this._source.connectObject('destroy', () => {
                this._source = null;
            }, this);
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

    // 'terminal', 'unsupported' (a terminal without Ctrl+Shift+C) or null
    _terminalKind() {
        const w = global.display.focus_window;
        if (!w)
            return null;
        const ids = [w.get_wm_class(), w.get_wm_class_instance(), w.get_gtk_application_id?.()]
            .filter(Boolean).map(s => s.toLowerCase());
        if (ids.some(id => NO_COPY_TERMINALS.includes(id)))
            return 'unsupported';
        if (ids.some(id => TERMINALS.includes(id) || id.includes('terminal')))
            return 'terminal';
        return null;
    }

    _run() {
        if (this._busy || this._dialog)
            return;
        const terminal = this._terminalKind();
        if (terminal) {
            this._runInTerminal(terminal);
            return;
        }
        this._setBusy();
        const window = global.display.focus_window;
        const fast = this._settings.get_boolean('fast-mode');

        this._afterModifiersReleased(() => {
            this._withClipboard(end => this._copyConvertPaste((found, pasted) => {
                if (found) {
                    end(pasted, () => {
                        this._busy = false;
                    });
                } else if (fast && this._settings.get_string('empty-selection') === 'auto') {
                    // Same clipboard session: no restore and no Copyous pause between the two copies
                    this._selectToLineStart(SELECT_SETTLE_FAST_MS, () => this._copyConvertPaste((found2, pasted2) =>
                        end(pasted2, () => this._lineStartDone(found2))));
                } else {
                    end(false, () => this._nothingSelected(window));
                }
            }));
        });
    }

    // A terminal can't replace its selection. Copy it with Ctrl+Shift+C, then either erase the changed
    // tail with Backspace and paste the new one with Ctrl+Shift+V (which assumes the selection ends at
    // the cursor, i.e. text just typed), or leave the result on the clipboard ('terminal-mode' = 'copy').
    _runInTerminal(kind) {
        const mode = this._settings.get_string('terminal-mode');
        if (kind === 'unsupported' || mode === 'off') {
            this._notify(kind === 'unsupported'
                ? this._('This terminal has no Ctrl+Shift+C — in Neovim, map a key to cli.js.')
                : this._('Turned off in terminals — in Neovim, map a key to cli.js.'));
            return;
        }
        this._setBusy();
        const type = St.ClipboardType.CLIPBOARD;

        this._afterModifiersReleased(() => this._withClipboard(end => {
            const done = (pasted, after) => end(pasted, () => {
                this._busy = false;
                after?.();
            });
            const marker = `⁣vntelex${GLib.get_monotonic_time()}`;
            this._clipboard.set_text(type, marker);
            this._waitForCopy(marker, copied => {
                if (!copied) {
                    done(false, () => this._notify(this._('Nothing is selected. In terminals, select the text you just typed.')));
                    return;
                }
                // A selected line ends with a newline that isn't part of the input
                const text = copied.replace(/\n+$/, '');
                const out = telexTransform(text, parseSkips(this._settings.get_string('skip-words')));
                if (out === text) {
                    done(false);
                    return;
                }
                const [erase, insert] = changedTail(text, out);
                // Backspace can't cross lines in a shell prompt, so multi-line changes are only copied
                if (mode === 'copy' || erase.includes('\n') || insert.includes('\n')) {
                    // Set after the restore, outside Copyous incognito: this result is meant to be kept
                    done(false, () => {
                        this._clipboard.set_text(type, out);
                        this._notify(this._('Converted text copied — paste it with Ctrl+Shift+V.'));
                    });
                    return;
                }
                this._clipboard.set_text(type, insert);
                this._later(30, () => {
                    for (let i = 0; i < erase.length; i++)
                        this._tap(Clutter.KEY_BackSpace);
                    if (insert)
                        this._ctrlShift(Clutter.KEY_v);
                    done(insert !== '');
                });
            });
            this._ctrlShift(Clutter.KEY_c);
        }));
    }

    _nothingSelected(window) {
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
        const settle = this._settings.get_boolean('fast-mode') ? SELECT_SETTLE_FAST_MS : SELECT_SETTLE_MS;
        this._selectToLineStart(settle, () => this._convertSelection(found => this._lineStartDone(found)));
    }

    _selectToLineStart(settle, cb) {
        this._afterModifiersReleased(() => {
            this._ctrlShift(Clutter.KEY_Up);
            this._later(settle, cb);
        });
    }

    _lineStartDone(found) {
        this._busy = false;
        if (!found)
            this._notify(this._('Couldn’t select any text before the cursor.'));
    }

    // Copy the selection, convert, paste, restore. done(found) runs once Copyous has settled.
    // The caller is responsible for clearing this._busy.
    _convertSelection(done) {
        this._withClipboard(end => this._copyConvertPaste((found, pasted) => end(pasted, () => done(found))));
    }

    // Save the clipboard and enter Copyous incognito, then run fn(end).
    // end(pasted, cb) restores the clipboard (after the app has read a paste), leaves incognito, then calls cb.
    _withClipboard(fn) {
        const finish = this._beginIncognito();
        this._saveClipboard(saved => fn((pasted, cb) => {
            const restore = () => {
                this._restoreClipboard(saved);
                finish(cb);
            };
            if (pasted)
                this._later(400, restore);
            else
                restore();
        }));
    }

    // Ctrl+C, convert, Ctrl+V. cb(found, pasted): found when something was copied,
    // pasted when the conversion changed it and Ctrl+V was sent.
    _copyConvertPaste(cb) {
        const type = St.ClipboardType.CLIPBOARD;
        // A marker tells us whether Ctrl+C copied anything
        const marker = `⁣vntelex${GLib.get_monotonic_time()}`;
        this._clipboard.set_text(type, marker);
        this._waitForCopy(marker, text => {
            if (!text) {
                cb(false, false);
                return;
            }
            const out = telexTransform(text, parseSkips(this._settings.get_string('skip-words')));
            if (out === text) {
                cb(true, false);
                return;
            }
            this._clipboard.set_text(type, out);
            this._later(30, () => {
                this._ctrl(Clutter.KEY_v);
                cb(true, true);
            });
        });
        this._ctrl(Clutter.KEY_c);
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

        dialog.connectObject('closed', () => {
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
        }, this);

        this._dialog = dialog;
        dialog.open(global.get_current_time());
    }

    // Wait until the app has replaced our marker on the clipboard: cb(text), or cb(null) on timeout.
    // Call it before sending Ctrl+C.
    _waitForCopy(marker, cb) {
        if (this._settings.get_boolean('fast-mode'))
            this._watchCopy(marker, cb);
        else
            this._pollCopy(marker, 0, cb);
    }

    // Poll the clipboard (max 'copy-timeout' ms)
    _pollCopy(marker, tries, cb) {
        this._later(COPY_POLL_MS, () => {
            this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (_c, text) => {
                if (!this._settings)
                    return;
                if (text && text !== marker) {
                    cb(text);
                } else if ((tries + 1) * COPY_POLL_MS >= this._settings.get_int('copy-timeout')) {
                    cb(null);
                } else {
                    this._pollCopy(marker, tries + 1, cb);
                }
            });
        });
    }

    // Fast mode: react as soon as the app takes the clipboard; give up after the learned wait for this app
    _watchCopy(marker, cb) {
        const app = this._appId();
        const start = GLib.get_monotonic_time();
        const selection = global.display.get_selection();
        let timer = 0;
        let finished = false;
        const stop = text => {
            if (finished)
                return;
            finished = true;
            selection.disconnectObject(this);
            this._cancel(timer);
            if (text)
                this._learnCopyTime(app, (GLib.get_monotonic_time() - start) / 1000);
            cb(text);
        };
        selection.connectObject('owner-changed', (_s, selectionType) => {
            if (selectionType !== Meta.SelectionType.SELECTION_CLIPBOARD)
                return;
            this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (_c, text) => {
                if (this._settings && text && text !== marker)
                    stop(text);
            });
        }, this);
        timer = this._later(this._copyWait(app), () => stop(null));
    }

    // ---------- Learned copy times (fast mode) ----------

    // Key for the learned copy times: the focused app
    _appId() {
        const w = global.display.focus_window;
        return (w?.get_gtk_application_id?.() || w?.get_wm_class() || '').toLowerCase();
    }

    // A margin over the slowest copy seen in this app, never above 'copy-timeout'
    _copyWait(app) {
        const max = this._settings.get_int('copy-timeout');
        const learned = this._copyTimes[app];
        if (learned === undefined)
            return max;
        return Math.min(max, Math.max(FAST_MIN_WAIT_MS, FAST_WAIT_FACTOR * learned + FAST_WAIT_MARGIN_MS));
    }

    _loadCopyTimes() {
        this._copyTimes = this._settings.get_value('copy-times').deep_unpack();
    }

    _learnCopyTime(app, ms) {
        ms = Math.ceil(ms);
        if (!app || ms <= (this._copyTimes[app] ?? -1))
            return;
        this._settings.set_value('copy-times', new GLib.Variant('a{si}', {...this._copyTimes, [app]: ms}));
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

    _tap(keyval) {
        this._key(keyval, true);
        this._key(keyval, false);
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
