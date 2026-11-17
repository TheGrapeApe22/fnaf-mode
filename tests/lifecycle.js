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
assert(layoutManager.actors.size === 1 && extension._players.size === 1, 'Animation and its associated audio started');
assert(extension._overlay.x === 17 && extension._overlay.y === 29, 'Primary monitor positioning');
assert(extension._image.x === 840 && extension._image.y === 0 &&
    extension._image.width === 1080 && extension._image.height === 1080,
    `Animation folder right hint positions actual decoded frame at the screen edge: ${JSON.stringify({
        x: extension._image.x, y: extension._image.y, width: extension._image.width,
        height: extension._image.height, visual: extension._previousVisual})}`);
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
assert(extension._players.size === 2, 'Still image uses the global paired-audio fallback');
sessionMode.isLocked = true;
sessionMode.emit('updated');
assert(!layoutManager.actors.size && !extension._sources.size && !extension._players.size, 'Lock cleanup');
sessionMode.isLocked = false;
const fullAnimationEvents = layoutManager.events.length;
sessionMode.emit('updated');
spin(2700);
assert(settings.active, 'No hidden callback errors');
assert(!layoutManager.actors.size && extension._sources.size === 1, 'Completed event schedules normal wait');
const lastEnd = layoutManager.events.at(-1);
assert(lastEnd.kind === 'end', 'Previous event finished');
const completedStart = layoutManager.events.slice(fullAnimationEvents).find(e => e.kind === 'start');
const indices = completedStart.actor.children[0].styleHistory.map(style =>
    Number(style.match(/frame-(\d+)\.png/)[1]));
assert(indices[0] === 1 && indices.length <= 24 &&
    indices.every((frame, i) => i === 0 || frame > indices[i - 1]),
    'Animation frames advance once in order without restarting');
assert(lastEnd.time - completedStart.time >= 1.99 && lastEnd.time - completedStart.time < 2.4,
    'Animation ends after its frame-based duration');
spin(500);
const nextStart = layoutManager.events.at(-1);
assert(nextStart.kind === 'start', 'Next event begins after configured wait');
const gap = nextStart.time - lastEnd.time;
assert(gap >= 0.49 && gap < 0.8, `Configured 0.5-second gap respected: ${gap}`);
// A new animation must keep its associated sound silent until the opening flash ends.
const savedConfig = extension._config();
extension._config = () => ({...savedConfig, flashSeconds: 0.4});
settings.set_boolean('active', true);
spin(650);
assert(extension._players.size === 0, 'Opening flash does not start animation audio early');
spin(400);
assert(extension._players.size === 1, 'Associated audio starts with animation after flash');
extension.disable();
assert(!settings.handlers.size && !sessionMode.handlers.size && !layoutManager.handlers.size &&
    !extension._sources.size, 'Disable disconnects signals and removes timers');
spin(100);
print('PASS: one-shot playback, associated audio synchronization, global fallback, scheduling, alignment, flicker and cleanup');
