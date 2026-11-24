import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {layoutManager, sessionMode, settings, panel} from './shell-mocks.js';
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
assert(extension._indicatorLabel.text === '○' && panel.statusArea['fnaf-mode'] === extension._indicator,
    'Off mode has an open-circle indicator in the top bar');
assert(extension._indicatorLabel.get_style().includes('color: #3377cc;'), 'Configured off-circle color');
// Check that the actual click callback delegates to the CLI, without changing system volume.
const originalSpawn = Gio.Subprocess.new;
const calls = [];
let completeToggle;
Gio.Subprocess.new = argv => {
    calls.push(argv);
    return {
        communicate_utf8_async(_input, _cancel, done) {
            completeToggle = () => {
                settings.set_boolean('active', !settings.active);
                done(this, {});
            };
        },
        communicate_utf8_finish() { return [true, null, '']; },
        get_successful() { return true; },
    };
};
try {
    extension._panelToggle.emit('clicked');
    extension._panelToggle.emit('clicked');
    assert(calls.length === 1 && calls[0][0] === `${GLib.get_home_dir()}/.local/bin/fnaf-mode` &&
        calls[0][1] === 'toggle', 'Click runs the CLI once and guards against double clicks');
    completeToggle();
    assert(settings.active && extension._indicatorLabel.text === '1', 'Click on starts countdown');
    extension._panelToggle.emit('clicked');
    completeToggle();
    assert(!settings.active && extension._indicatorLabel.text === '○' && !extension._countdownId,
        'Click off restores the circle and stops the countdown');
    assert(extension._indicatorLabel.get_style().includes('color: #3377cc;'), 'Click off applies offColor');
} finally {
    Gio.Subprocess.new = originalSpawn;
}
const initialConfig = extension._config();
extension._config = () => ({...initialConfig, initialWaitSeconds: 2.2});
settings.set_boolean('active', true);
assert(extension._indicatorLabel.text === '3', 'Countdown rounds remaining seconds up');
assert(extension._indicatorLabel.get_style().includes('color: #ff5500;'), 'Countdown retains configured color');
spin(1100);
assert(extension._indicatorLabel.text === '2' && !extension._overlay,
    'Countdown ticks from the scheduled deadline while desktop remains normal');
settings.set_boolean('active', false);
extension._config = () => initialConfig;
settings.set_boolean('active', true);
assert(extension._sources.size === 2, 'Initial wait schedules one silent warm-up and one event');
spin(650);
assert(!layoutManager.actors.size && !extension._players.size,
    'Initial wait is longer than the regular interval and has no early effects or audio');
spin(300);
assert(layoutManager.actors.size === 1 && extension._players.size === 3,
    'Animation starts its associated audio plus both global tracks');
assert(extension._indicatorLabel.text === '●' && !extension._countdownId,
    'Active event displays a filled circle and has no countdown timer');
assert(extension._indicatorLabel.get_style().includes('color: #ff5500;'), 'Active circle retains configured color');
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
assert(extension._indicatorLabel.text === '○' && !extension._countdownId,
    'Terminal off also updates the indicator');
assert(extension._indicatorLabel.get_style().includes('color: #3377cc;'), 'Terminal off applies offColor');
settings.set_boolean('active', true);
spin(950);
assert(extension._players.size === 2, 'Still image uses both global tracks');
sessionMode.isLocked = true;
sessionMode.emit('updated');
assert(!layoutManager.actors.size && !extension._sources.size && !extension._players.size, 'Lock cleanup');
assert(extension._indicatorLabel.text === '–' && !extension._countdownId,
    'Paused session has no stale countdown');
assert(extension._indicatorLabel.get_style().includes('color: #ff5500;'), 'Paused mode is still on and uses onColor');
sessionMode.isLocked = false;
const fullAnimationEvents = layoutManager.events.length;
sessionMode.emit('updated');
spin(3000);
assert(settings.active, 'No hidden callback errors');
assert(!layoutManager.actors.size && extension._sources.size === 1, 'Completed event schedules normal wait');
assert(extension._indicatorLabel.text === '1' && extension._countdownId,
    'Completed event restores the normal cooldown countdown');
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
const mappingPath = `${savedConfig.assetDirectory}/audio_links.json`;
GLib.file_set_contents(mappingPath, JSON.stringify({images: {'plain.png': ['a.mp3', 'b.mp3']},
    animations: {'converted-right': ['jumpscare.mp3']}}));
extension._config = () => ({...savedConfig, flashSeconds: 0.4});
settings.set_boolean('active', true);
spin(950);
assert(extension._players.size === 0, 'Opening flash does not start animation audio early');
spin(400);
assert(extension._players.size === 1, 'Mapping edit takes effect next event, after opening flash');
GLib.file_set_contents(mappingPath, '{editing');
settings.set_boolean('active', true);
spin(950);
assert(settings.active && extension._players.size === 2,
    'Malformed mapping during an edit retains the last valid mapping and keeps mode active');
extension._config = () => ({...savedConfig, initialWaitSeconds: 0, jumpscareFirst: true});
extension._previousVisual = `${savedConfig.assetDirectory}/animations/converted-right`;
settings.set_boolean('active', true);
spin(150);
assert(extension._previousVisual.endsWith('/converted-right') && !extension._firstEvent,
    'Activation forces an animation even if it was the previous visual');
spin(2550);
assert(extension._previousVisual.endsWith('/plain.png') && extension._players.size === 2,
    'Following events return to normal mixed selection');
extension.disable();
assert(!settings.handlers.size && !sessionMode.handlers.size && !layoutManager.handlers.size &&
    !extension._sources.size, 'Disable disconnects signals and removes timers');
assert(!panel.statusArea['fnaf-mode'] && !extension._indicator && !extension._countdownId,
    'Disable removes the top-bar indicator and its timer');
spin(100);
print('PASS: panel countdown/toggle/cleanup, mapped audio, live edits, one-shot playback, timing and alignment');
