// Model only the shell boundary; core.js, GLib timers and subprocesses stay real.
import GLib from 'gi://GLib';
export class Signals {
    constructor() { this.handlers = new Map(); this.nextId = 1; }
    connect(name, fn) { const id = this.nextId++; this.handlers.set(id, {name, fn}); return id; }
    disconnect(id) { this.handlers.delete(id); }
    emit(name) { for (const h of [...this.handlers.values()]) if (h.name === name) h.fn(); }
}
class Settings extends Signals {
    active = false;
    get_boolean() { return this.active; }
    set_boolean(_key, value) { this.active = value; this.emit('changed::active'); }
}
export const settings = new Settings();
export class Extension { getSettings() { return settings; } }
class Widget extends Signals {
    constructor(props) {
        super();
        Object.assign(this, props);
        this.children = this.child ? [this.child] : [];
    }
    add_child(child) { this.children.push(child); }
    set_size(width, height) { Object.assign(this, {width, height}); }
    set_position(x, y) { Object.assign(this, {x, y}); }
    set_style(style) {
        this.style = style;
        this.styleHistory ??= [];
        this.styleHistory.push(style);
    }
    get_style() { return this.style ?? null; }
    ease(props) { this.opacity = props.opacity; }
    destroy() {
        this.destroyed = true;
        for (const child of this.children)
            child.destroy();
        this.emit('destroy');
        this.handlers.clear();
    }
}
export const St = {Widget, Label: Widget, Button: Widget};
export const Clutter = {AnimationMode: {EASE_OUT_QUAD: 0}, ActorAlign: {CENTER: 0}};
export const PanelMenu = {Button: class extends Widget {
    constructor() { super({}); }
}};
export const panel = {
    statusArea: {},
    addToStatusArea(role, indicator) {
        if (this.statusArea[role])
            throw new Error(`Duplicate panel indicator: ${role}`);
        this.statusArea[role] = indicator;
        indicator.connect('destroy', () => { delete this.statusArea[role]; });
    },
};
export const notifications = [];
export function notifyError(title, message) { notifications.push({title, message}); }
export const sessionMode = Object.assign(new Signals(), {isLocked: false, isGreeter: false});
export const layoutManager = Object.assign(new Signals(), {
    primaryMonitor: {x: 17, y: 29, width: 1920, height: 1080},
    actors: new Set(),
    events: [],
    addTopChrome(actor, params) {
        if (Object.keys(params).some(key => !['affectsStruts', 'trackFullscreen'].includes(key)))
            throw new Error('Unsupported GNOME 50 chrome parameter');
        if (actor.reactive !== false || actor.can_focus !== false)
            throw new Error('Overlay must not intercept input');
        if (actor.children.some(c => c.reactive || c.can_focus))
            throw new Error('Children must not intercept input');
        this.actors.add(actor);
        this.events.push({kind: 'start', time: GLib.get_monotonic_time() / 1000000, actor});
    },
    removeChrome(actor) {
        this.actors.delete(actor);
        this.events.push({kind: 'end', time: GLib.get_monotonic_time() / 1000000});
    },
});
