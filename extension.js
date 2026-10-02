import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const KEY = 'toggle-shortcut';
const MARGIN = 12;   // gap between bar and screen edge
const BORDER = 2;    // must match .wsbar-thumb border in stylesheet.css
const SPACING = 8;   // gap between previews
const SYNC_MS = 400; // refresh interval while bar is visible

class WorkspaceBar {
    constructor(settings) {
        this._settings = settings;
        this._shown = false;
        this._entries = [];
        this._signals = [];
        this._sig = '';
        this._hidden = {x: 0, y: 0};
        this._rebuildId = 0;
        this._syncId = 0;

        this._actor = new St.BoxLayout({
            style_class: 'wsbar', reactive: true, visible: false,
        });
        this._scroll = new St.ScrollView({
            overlay_scrollbars: true, x_expand: true, y_expand: true,
        });
        this._box = new St.BoxLayout();
        this._scroll.add_child(this._box);
        this._actor.add_child(this._scroll);
        Main.layoutManager.addChrome(this._actor, {trackFullscreen: true});

        const wm = global.workspace_manager;
        this._connect(wm, 'workspace-added', () => this._queueRebuild());
        this._connect(wm, 'workspace-removed', () => this._queueRebuild());
        this._connect(wm, 'active-workspace-changed', () => this._queueRebuild());
        this._connect(Main.layoutManager, 'monitors-changed', () => this._queueRebuild());
        this._connect(settings, 'changed', (_s, key) => {
            if (key !== KEY) this._queueRebuild();
        });
    }

    _connect(obj, name, cb) {
        this._signals.push([obj, obj.connect(name, cb)]);
    }

    toggle() {
        if (this._shown) this.hide(); else this.show();
    }

    show() {
        if (this._shown) return;
        this._rebuild();               // placed off-screen because _shown is false
        this._shown = true;
        this._actor.visible = true;
        this._actor.remove_all_transitions();
        this._actor.ease({
            translation_x: 0, translation_y: 0,
            duration: this._settings.get_int('animation-time'),
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._syncId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SYNC_MS, () => {
            this._sync();
            return GLib.SOURCE_CONTINUE;
        });
    }

    hide() {
        if (!this._shown) return;
        this._shown = false;
        if (this._syncId) {
            GLib.source_remove(this._syncId);
            this._syncId = 0;
        }
        this._actor.remove_all_transitions();
        this._actor.ease({
            translation_x: this._hidden.x, translation_y: this._hidden.y,
            duration: this._settings.get_int('animation-time'),
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (!this._shown) this._actor.visible = false;
            },
        });
    }

    _queueRebuild() {
        if (this._rebuildId) return;
        this._rebuildId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._rebuildId = 0;
            this._rebuild();
            return GLib.SOURCE_REMOVE;
        });
    }

    _windowsOf(ws) {
        const wins = ws.list_windows().filter(w =>
            !w.is_skip_taskbar() && !w.minimized &&
            w.get_monitor() === this._monIdx && w.get_compositor_private());
        return global.display.sort_windows_by_stacking(wins);
    }

    _signature() {
        const wm = global.workspace_manager;
        const parts = [];
        for (let i = 0; i < wm.get_n_workspaces(); i++)
            parts.push(`${i}:${this._windowsOf(wm.get_workspace_by_index(i)).map(w => w.get_id()).join(',')}`);
        return `${wm.get_active_workspace_index()}|${parts.join('|')}`;
    }

    _sync() {
        if (this._signature() !== this._sig) {
            this._rebuild();
            return;
        }
        // Same windows: just follow their movement/resizing.
        for (const e of this._entries) {
            if (!e.actor.get_stage()) continue;
            e.clone.set_scale(this._scale, this._scale);
            e.clone.set_position(
                Math.round((e.actor.x - this._mon.x) * this._scale),
                Math.round((e.actor.y - this._mon.y) * this._scale));
        }
    }

    _rebuild() {
        const s = this._settings;
        const side = s.get_string('side');
        const vertical = side === 'left' || side === 'right';
        const wm = global.workspace_manager;

        this._monIdx = Main.layoutManager.primaryIndex;
        this._mon = Main.layoutManager.monitors[this._monIdx];
        const area = Main.layoutManager.getWorkAreaForMonitor(this._monIdx);

        const thumbW = s.get_int('thumb-width');
        this._scale = thumbW / this._mon.width;
        const thumbH = Math.round(this._mon.height * this._scale);
        const pad = s.get_int('bar-padding');

        this._box.destroy_all_children();
        this._entries = [];
        this._box.vertical = vertical;
        this._box.style = `spacing: ${SPACING}px;`;
        this._actor.style = `padding: ${pad}px;`;
        this._scroll.hscrollbar_policy = vertical ? St.PolicyType.NEVER : St.PolicyType.AUTOMATIC;
        this._scroll.vscrollbar_policy = vertical ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER;

        const n = wm.get_n_workspaces();
        const active = wm.get_active_workspace_index();

        for (let i = 0; i < n; i++) {
            const ws = wm.get_workspace_by_index(i);
            const button = new St.Button({
                style_class: 'wsbar-thumb', reactive: true,
                can_focus: false, track_hover: true,
            });
            if (i === active) button.add_style_class_name('active');

            const holder = new St.Widget({
                width: thumbW, height: thumbH, clip_to_allocation: true,
            });
            button.set_child(holder);

            for (const win of this._windowsOf(ws)) {
                const actor = win.get_compositor_private();
                const clone = new Clutter.Clone({source: actor});
                holder.add_child(clone);
                this._entries.push({clone, actor});
            }

            const num = new St.Label({style_class: 'wsbar-num', text: `${i + 1}`});
            num.set_position(4, 4);
            holder.add_child(num);

            button.connect('clicked', () => {
                ws.activate(global.get_current_time());
                if (this._settings.get_boolean('hide-on-select')) this.hide();
            });
            this._box.add_child(button);
        }
        this._sync_positions_only();
        this._sig = this._signature();

        // --- geometry ---
        const outerW = thumbW + 2 * BORDER;
        const outerH = thumbH + 2 * BORDER;
        const along = vertical ? outerH : outerW;
        const content = n * along + (n - 1) * SPACING + 2 * pad;
        const maxLen = Math.floor((vertical ? area.height : area.width) *
            s.get_int('bar-length-percent') / 100);
        const length = Math.min(content, maxLen);
        const thickness = (vertical ? outerW : outerH) + 2 * pad;

        const w = vertical ? thickness : length;
        const h = vertical ? length : thickness;
        let x, y;
        if (vertical) {
            y = area.y + Math.round((area.height - h) / 2);
            x = side === 'left' ? area.x + MARGIN : area.x + area.width - w - MARGIN;
        } else {
            x = area.x + Math.round((area.width - w) / 2);
            y = side === 'top' ? area.y + MARGIN : area.y + area.height - h - MARGIN;
        }
        this._actor.set_position(x, y);
        this._actor.set_size(w, h);

        const off = thickness + MARGIN;
        this._hidden = {
            x: side === 'left' ? -off : side === 'right' ? off : 0,
            y: side === 'top' ? -off : side === 'bottom' ? off : 0,
        };

        this._actor.remove_all_transitions();
        if (this._shown) {
            this._actor.set_translation(0, 0, 0);
            this._actor.visible = true;
        } else {
            this._actor.set_translation(this._hidden.x, this._hidden.y, 0);
            this._actor.visible = false;
        }
    }

    _sync_positions_only() {
        for (const e of this._entries) {
            e.clone.set_scale(this._scale, this._scale);
            e.clone.set_position(
                Math.round((e.actor.x - this._mon.x) * this._scale),
                Math.round((e.actor.y - this._mon.y) * this._scale));
        }
    }

    destroy() {
        if (this._syncId) GLib.source_remove(this._syncId);
        if (this._rebuildId) GLib.source_remove(this._rebuildId);
        for (const [obj, id] of this._signals) obj.disconnect(id);
        this._signals = [];
        this._actor.remove_all_transitions();
        Main.layoutManager.removeChrome(this._actor);
        this._actor.destroy();
    }
}

export default class FloatingWorkspaceBarExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._bar = new WorkspaceBar(this._settings);
        Main.wm.addKeybinding(
            KEY, this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._bar.toggle());
    }

    disable() {
        Main.wm.removeKeybinding(KEY);
        this._bar?.destroy();
        this._bar = null;
        this._settings = null;
    }
}
