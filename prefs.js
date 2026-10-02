import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SIDES = ['left', 'right', 'top', 'bottom'];

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Settings', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        // ---- Position & shortcut ----
        const g1 = new Adw.PreferencesGroup({title: 'Position & shortcut'});
        page.add(g1);

        const side = new Adw.ComboRow({
            title: 'Screen edge',
            model: Gtk.StringList.new(['Left', 'Right', 'Top', 'Bottom']),
            selected: Math.max(0, SIDES.indexOf(settings.get_string('side'))),
        });
        side.connect('notify::selected', () => settings.set_string('side', SIDES[side.selected]));
        g1.add(side);

        g1.add(this._shortcutRow(window, settings));

        const hide = new Adw.SwitchRow({title: 'Slide out after jumping to a workspace'});
        settings.bind('hide-on-select', hide, 'active', Gio.SettingsBindFlags.DEFAULT);
        g1.add(hide);

        // ---- Sizes ----
        const g2 = new Adw.PreferencesGroup({title: 'Sizes'});
        page.add(g2);
        g2.add(this._spin(settings, 'thumb-width', 'Workspace preview width (px)',
            'Height follows your screen aspect ratio', 80, 600, 10));
        g2.add(this._spin(settings, 'bar-length-percent', 'Maximum bar length (%)',
            'Bar scrolls if there are more workspaces than fit', 20, 100, 5));
        g2.add(this._spin(settings, 'bar-padding', 'Bar padding (px)', null, 0, 40, 1));
        g2.add(this._spin(settings, 'animation-time', 'Slide animation (ms)', null, 0, 1000, 50));
    }

    _spin(settings, key, title, subtitle, lo, hi, step) {
        const row = new Adw.SpinRow({
            title, subtitle: subtitle ?? '',
            adjustment: new Gtk.Adjustment({lower: lo, upper: hi, step_increment: step, page_increment: step * 5}),
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _shortcutRow(window, settings) {
        const KEY = 'toggle-shortcut';
        const row = new Adw.ActionRow({
            title: 'Toggle shortcut',
            subtitle: 'Click, then press keys. Backspace clears, Esc cancels.',
        });
        const label = new Gtk.ShortcutLabel({disabled_text: 'Disabled'});
        const button = new Gtk.Button({valign: Gtk.Align.CENTER, child: label});
        row.add_suffix(button);
        row.activatable_widget = button;

        let capturing = false;
        const refresh = () => {
            capturing = false;
            label.disabled_text = 'Disabled';
            label.accelerator = settings.get_strv(KEY)[0] ?? '';
        };
        refresh();
        settings.connect(`changed::${KEY}`, refresh);

        button.connect('clicked', () => {
            capturing = true;
            label.accelerator = '';
            label.disabled_text = 'Press keys…';
        });

        const ctrl = new Gtk.EventControllerKey();
        ctrl.connect('key-pressed', (_c, keyval, _keycode, state) => {
            if (!capturing) return Gdk.EVENT_PROPAGATE;
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            if (mask === 0 && keyval === Gdk.KEY_Escape) { refresh(); return Gdk.EVENT_STOP; }
            if (mask === 0 && keyval === Gdk.KEY_BackSpace) {
                settings.set_strv(KEY, []);
                refresh();
                return Gdk.EVENT_STOP;
            }
            const lower = Gdk.keyval_to_lower(keyval);
            if (!Gtk.accelerator_valid(lower, mask)) return Gdk.EVENT_STOP;
            settings.set_strv(KEY, [Gtk.accelerator_name(lower, mask)]);
            refresh();
            return Gdk.EVENT_STOP;
        });
        window.add_controller(ctrl);
        return row;
    }
}
