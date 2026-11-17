import GLib from 'gi://GLib';
import {layoutManager, sessionMode, settings} from './shell-mocks.js';
const {default: FnafMode} = await import(ARGV[0]);
Math.random = () => 0.5; // Repeatable burst timing and darkness.
function assert(value, message) { if (!value) throw new Error(message); }
function spin(ms) {
    const loop = new GLib.MainLoop(null, false);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { loop.quit(); return GLib.SOURCE_REMOVE; });
    loop.run();
}
const extension = new FnafMode();
extension.enable();
assert(extension._sources.size === 0, 'Initially inactive');
settings.set_boolean('active', true);
assert(extension._sources.size === 1, 'Single pending event');
spin(650);
assert(layoutManager.actors.size === 1 && extension._players.size === 2, 'Event and paired audio started');
assert(extension._overlay.x === 17 && extension._overlay.y === 29, 'Primary monitor positioning');
// Sample beyond the opening flicker, while the image is still being shown.
spin(500);
const middleOpacities = [];
for (let i = 0; i < 10; i++) {
    spin(40);
    middleOpacities.push(extension._light.opacity);
}
assert(middleOpacities.some(v => v === 0) && middleOpacities.some(v => v > 0),
    'Image phase continues alternating between clear and dark flicker');
const first = extension._overlay;
settings.set_boolean('active', false);
assert(first.destroyed && !layoutManager.actors.size && !extension._sources.size && !extension._players.size,
    'Off immediately clears actors, timers, and audio');
settings.set_boolean('active', true);
spin(650);
sessionMode.isLocked = true;
sessionMode.emit('updated');
assert(!layoutManager.actors.size && !extension._sources.size && !extension._players.size, 'Lock cleanup');
sessionMode.isLocked = false;
sessionMode.emit('updated');
spin(2700);
assert(settings.active, 'No hidden callback errors');
assert(!layoutManager.actors.size && extension._sources.size === 1, 'Completed event schedules normal wait');
extension.disable();
assert(!settings.handlers.size && !sessionMode.handlers.size && !layoutManager.handlers.size &&
    !extension._sources.size, 'Disable disconnects signals and removes timers');
spin(100);
print('PASS: scheduling, ongoing flicker, primary screen, click-through properties, audio pairing, off/lock/disable cleanup');
