import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {telexTransform, parseSkips} from './telex.js';
import {translator} from './i18n.js';

const EMPTY_SELECTION = [
    ['auto', 'Select to paragraph start', 'Press Ctrl+Shift+↑, then convert'],
    ['ask', 'Ask first', 'Show a confirmation dialog'],
    ['none', 'Do nothing', 'Just report that nothing is selected'],
];

// Language names stay in their own language
const LANGUAGES = [
    ['auto', null],
    ['en', 'English'],
    ['vi', 'Tiếng Việt'],
];

// Adw.ShortcutLabel / Adw.WrapBox need libadwaita 1.8; older shells fall back to GTK widgets
const ShortcutLabel = Adw.ShortcutLabel ?? Gtk.ShortcutLabel;

function joinSkips(words) {
    return words.join(', ');
}

export default class VnTelexPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const _ = this._ = translator(settings);
        window.set_default_size(640, 760);
        window.set_search_enabled(true);

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        page.add(this._generalGroup(window, settings));
        page.add(this._tryGroup(settings));
        page.add(this._skipGroup(window, settings));
        page.add(this._tipsGroup());
    }

    // ---------- Hotkey & behaviour ----------

    _generalGroup(window, settings) {
        const _ = this._;
        const group = new Adw.PreferencesGroup({
            title: _('How to use'),
            description: _('Select text typed in Telex, then press the shortcut — the selection is replaced with accented Vietnamese.'),
        });

        // Hotkey: click to record a new shortcut
        const hotkeyRow = new Adw.ActionRow({
            title: _('Shortcut'),
            subtitle: _('Click to set a new shortcut'),
            activatable: true,
        });
        const label = new ShortcutLabel({
            disabled_text: _('Disabled'),
            valign: Gtk.Align.CENTER,
        });
        const resetHotkey = new Gtk.Button({
            icon_name: 'edit-undo-symbolic',
            tooltip_text: _('Reset to default'),
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        resetHotkey.connect('clicked', () => settings.reset('hotkey'));
        hotkeyRow.add_suffix(label);
        hotkeyRow.add_suffix(resetHotkey);
        hotkeyRow.connect('activated', () => this._recordShortcut(window, settings));

        const syncHotkey = () => {
            label.accelerator = settings.get_strv('hotkey')[0] ?? '';
            resetHotkey.sensitive = settings.get_user_value('hotkey') !== null;
        };
        settings.connect('changed::hotkey', syncHotkey);
        syncHotkey();
        group.add(hotkeyRow);

        // What to do when nothing is selected
        const model = new Gtk.StringList();
        for (const [, title] of EMPTY_SELECTION)
            model.append(_(title));
        const emptyRow = new Adw.ComboRow({
            title: _('When nothing is selected'),
            model,
        });
        const syncEmpty = () => {
            const i = EMPTY_SELECTION.findIndex(([id]) => id === settings.get_string('empty-selection'));
            emptyRow.selected = Math.max(i, 0);
            emptyRow.subtitle = _(EMPTY_SELECTION[emptyRow.selected][2]);
        };
        settings.connect('changed::empty-selection', syncEmpty);
        syncEmpty();
        emptyRow.connect('notify::selected', () => {
            const id = EMPTY_SELECTION[emptyRow.selected]?.[0];
            if (id && id !== settings.get_string('empty-selection'))
                settings.set_string('empty-selection', id);
        });
        group.add(emptyRow);

        const timeoutRow = Adw.SpinRow.new_with_range(0, 2000, 50);
        timeoutRow.title = _('Selection wait time (ms)');
        timeoutRow.subtitle = _('How long to wait for copied text before treating the selection as empty. Lower is faster; raise it if some apps get treated as having no selection.');
        settings.bind('copy-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(timeoutRow);

        const notifyRow = new Adw.SwitchRow({
            title: _('Show notifications'),
            subtitle: _('Tell me when a conversion can’t run (terminal, no text…)'),
        });
        settings.bind('show-notifications', notifyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(notifyRow);

        group.add(this._languageRow(window, settings));

        return group;
    }

    _languageRow(window, settings) {
        const _ = this._;
        const model = new Gtk.StringList();
        for (const [, name] of LANGUAGES)
            model.append(name ?? _('Automatic'));
        const row = new Adw.ComboRow({
            title: _('Language'),
            icon_name: 'preferences-desktop-locale-symbolic',
            model,
        });
        const sync = () => {
            const i = LANGUAGES.findIndex(([id]) => id === settings.get_string('language'));
            row.selected = Math.max(i, 0);
            row.subtitle = row.selected === 0 ? _('Follow the system language') : '';
        };
        settings.connect('changed::language', sync);
        sync();
        row.connect('notify::selected', () => {
            const id = LANGUAGES[row.selected]?.[0];
            if (id && id !== settings.get_string('language')) {
                settings.set_string('language', id);
                window.add_toast(new Adw.Toast({title: _('Reopen preferences to update this window'), timeout: 3}));
            }
        });
        return row;
    }

    _recordShortcut(window, settings) {
        const _ = this._;
        const status = new Adw.StatusPage({
            icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
            title: _('Press a new shortcut'),
            description: _('Esc to cancel · Backspace to clear the shortcut'),
        });
        const preview = new ShortcutLabel({
            disabled_text: '…',
            halign: Gtk.Align.CENTER,
        });
        status.set_child(preview);

        const dialog = new Adw.Dialog({
            title: _('Set shortcut'),
            content_width: 420,
            child: new Adw.ToolbarView({content: status}),
        });
        dialog.child.add_top_bar(new Adw.HeaderBar());

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_c, keyval, keycode, state) => {
            let mask = state & Gtk.accelerator_get_default_mod_mask();
            mask &= ~Gdk.ModifierType.LOCK_MASK;
            const key = Gdk.keyval_to_lower(keyval);

            if (mask === 0 && key === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (mask === 0 && key === Gdk.KEY_BackSpace) {
                settings.set_strv('hotkey', []);
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (!Gtk.accelerator_valid(key, mask) || mask === 0 ||
                (mask === Gdk.ModifierType.SHIFT_MASK && key < 0xff00)) {
                // Lone modifiers or Shift+letter: show progress, keep waiting
                preview.accelerator = Gtk.accelerator_name_with_keycode(null, key, keycode, mask);
                status.description = _('Use at least one of Ctrl, Alt or Super');
                return Gdk.EVENT_STOP;
            }
            settings.set_strv('hotkey', [Gtk.accelerator_name_with_keycode(null, key, keycode, mask)]);
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present(window);
    }

    // ---------- Live preview ----------

    _tryGroup(settings) {
        const _ = this._;
        const group = new Adw.PreferencesGroup({
            title: _('Try it'),
            description: _('Type Telex below to see the result (skip words applied).'),
        });

        const input = new Adw.EntryRow({title: _('Telex text'), text: 'Tieengs Vieetj khoong daaus, deploy len server'});
        const output = new Adw.ActionRow({
            title: '',
            subtitle_selectable: true,
            css_classes: ['property'],
        });
        const copy = new Gtk.Button({
            icon_name: 'edit-copy-symbolic',
            tooltip_text: _('Copy'),
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        copy.connect('clicked', () => {
            output.get_clipboard().set(output.subtitle);
            copy.icon_name = 'object-select-symbolic';
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
                copy.icon_name = 'edit-copy-symbolic';
                return GLib.SOURCE_REMOVE;
            });
        });
        output.add_suffix(copy);

        const update = () => {
            const text = input.text;
            output.title = _('Result');
            output.subtitle = text
                ? GLib.markup_escape_text(telexTransform(text, parseSkips(settings.get_string('skip-words'))), -1)
                : '—';
            copy.sensitive = !!text;
        };
        input.connect('changed', update);
        settings.connect('changed::skip-words', update);
        update();

        group.add(input);
        group.add(output);
        return group;
    }

    // ---------- Skip words ----------

    _skipGroup(window, settings) {
        const _ = this._;
        const group = new Adw.PreferencesGroup({
            title: _('Skip words'),
            description: _('English words left untouched, matched by prefix (e.g. “test” also keeps “tests”, “testing”).'),
        });

        const reset = new Gtk.Button({
            icon_name: 'edit-undo-symbolic',
            tooltip_text: _('Restore the default list'),
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        group.set_header_suffix(reset);

        const add = new Adw.EntryRow({
            title: _('Add words (comma-separated)'),
            show_apply_button: true,
        });
        const filter = new Adw.EntryRow({title: _('Search the list')});
        filter.add_prefix(new Gtk.Image({icon_name: 'system-search-symbolic'}));

        const expander = new Adw.ExpanderRow({title: _('Word list')});
        const flow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 6,
            row_spacing: 6,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            max_children_per_line: 30,
            homogeneous: false,
        });
        const empty = new Gtk.Label({
            label: _('No words'),
            css_classes: ['dim-label'],
            margin_top: 12,
            margin_bottom: 12,
        });
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        box.append(flow);
        box.append(empty);
        expander.add_row(new Adw.PreferencesRow({child: box, activatable: false}));

        const words = () => [...new Set(parseSkips(settings.get_string('skip-words')).map(w => w.toLowerCase()))];
        const save = list => settings.set_string('skip-words', joinSkips(list));

        const toast = msg => window.add_toast(new Adw.Toast({title: msg, timeout: 2}));

        const rebuild = () => {
            let child;
            while ((child = flow.get_first_child()))
                flow.remove(child);

            const all = words();
            const q = filter.text.trim().toLowerCase();
            const shown = all.filter(w => w.includes(q)).sort();
            for (const word of shown)
                flow.append(this._chip(word, () => {
                    save(words().filter(w => w !== word));
                    toast(_('Removed “{word}”', {word}));
                }));

            expander.subtitle = q
                ? _('{shown} / {total} words', {shown: shown.length, total: all.length})
                : _('{total} words', {total: all.length});
            empty.visible = shown.length === 0;
            flow.visible = shown.length > 0;
            reset.sensitive = settings.get_user_value('skip-words') !== null;
        };

        add.connect('apply', () => {
            const current = words();
            const fresh = parseSkips(add.text.toLowerCase()).filter(w => !current.includes(w));
            add.text = '';
            if (fresh.length === 0)
                return;
            save([...current, ...fresh]);
            toast(fresh.length === 1 ? _('Added “{word}”', {word: fresh[0]}) : _('Added {count} words', {count: fresh.length}));
        });
        filter.connect('changed', () => {
            if (filter.text)
                expander.expanded = true;
            rebuild();
        });
        reset.connect('clicked', () => {
            settings.reset('skip-words');
            toast(_('Default list restored'));
        });
        settings.connect('changed::skip-words', rebuild);
        rebuild();

        group.add(add);
        group.add(filter);
        group.add(expander);
        return group;
    }

    _chip(word, onRemove) {
        const box = new Gtk.Box({spacing: 2, css_classes: ['card']});
        box.append(new Gtk.Label({label: word, margin_start: 10, margin_end: 2}));
        const remove = new Gtk.Button({
            icon_name: 'window-close-symbolic',
            tooltip_text: this._('Remove “{word}”', {word}),
            css_classes: ['flat', 'circular'],
            valign: Gtk.Align.CENTER,
        });
        remove.connect('clicked', onRemove);
        box.append(remove);
        return new Gtk.FlowBoxChild({child: box, focusable: false});
    }

    // ---------- Tips ----------

    _tipsGroup() {
        const _ = this._;
        const group = new Adw.PreferencesGroup({title: _('Notes')});
        group.add(new Adw.ActionRow({
            title: _('Terminal'),
            subtitle: _('Not supported in terminals. For Neovim, map a key to cli.js in the extension folder.'),
            subtitle_selectable: true,
        }));
        group.add(new Adw.ActionRow({
            title: _('Clipboard'),
            subtitle: _('Your clipboard is restored after converting; Copyous is switched to incognito meanwhile.'),
        }));
        return group;
    }
}
