#!/usr/bin/env -S gjs -m
// Command-line filter: stdin (or arguments) → Vietnamese on stdout.
// Uses the same skip words as the extension. For Neovim:
//   xnoremap <leader>tv :!~/.local/share/gnome-shell/extensions/vn-telex@tecix/cli.js<CR>

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';

import {telexTransform, parseSkips} from './telex.js';

function skipWords() {
    try {
        const dir = GLib.path_get_dirname(System.programPath) + '/schemas';
        const src = Gio.SettingsSchemaSource.new_from_directory(dir, Gio.SettingsSchemaSource.get_default(), false);
        const schema = src.lookup('org.gnome.shell.extensions.vn-telex', false);
        return parseSkips(new Gio.Settings({settings_schema: schema}).get_string('skip-words'));
    } catch (e) {
        return [];
    }
}

let text;
if (ARGV.length > 0) {
    text = ARGV.join(' ');
} else {
    const [, bytes] = GLib.file_get_contents('/dev/stdin');
    text = new TextDecoder().decode(bytes).replace(/\n$/, '');
}
print(telexTransform(text, skipWords()));
