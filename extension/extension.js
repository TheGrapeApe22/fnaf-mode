import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {DEFAULTS, readConfig, scanAssets, choose, randomBetween, timeline,
    readAudioLinks, animationTimeline, frameIndex, imageAlignment, imageGeometry} from './core.js';

export default class FnafMode extends Extension {
    enable() {
        this._sources = new Set();
        this._players = new Set();
        this._settings = this.getSettings();
        this._configPath = GLib.build_filenamev([GLib.get_user_config_dir(), 'fnaf-mode', 'config.json']);
        this._settingsId = this._settings.connect('changed::active', () => this._sync());
        this._monitorId = Main.layoutManager.connect('monitors-changed', () => this._sync());
        this._sessionId = Main.sessionMode.connect('updated', () => this._sync());
        this._sync();
    }

    _later(ms, callback) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(1, Math.round(ms)), () => {
            this._sources.delete(id);
            try {
                callback();
            } catch (error) {
                console.error(`[FNAF Mode] ${error.stack ?? error}`);
                this._clear();
                this._settings.set_boolean('active', false);
            }
            return GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
    }

    _clear() {
        for (const id of this._sources)
            GLib.source_remove(id);
        this._sources.clear();
        for (const player of this._players) {
            try { player.send_signal(15); } catch (_) { /* Already exited. */ }
        }
        this._players.clear();
        if (this._overlay) {
            Main.layoutManager.removeChrome(this._overlay);
            this._overlay.destroy();
            this._overlay = null;
        }
        this._image = null;
        this._light = null;
    }

    _sync() {
        this._clear();
        this._firstEvent = true;
        if (this._settings.get_boolean('active') && !Main.sessionMode.isLocked &&
            !Main.sessionMode.isGreeter && Main.layoutManager.primaryMonitor)
            this._schedule(true);
    }

    _config() {
        try {
            return readConfig(this._configPath);
        } catch (error) {
            // Retain the previous good settings if a file is being edited or is invalid.
            console.error(`[FNAF Mode] Invalid config: ${error.message}`);
            return this._lastConfig ?? {...DEFAULTS};
        }
    }

    _schedule(initial = false) {
        this._lastConfig = this._config();
        const c = this._lastConfig;
        const seconds = initial ? c.initialWaitSeconds
            : randomBetween(c.intervalMinSeconds, c.intervalMaxSeconds);
        this._later(seconds * 1000, () => this._begin());
    }

    _begin() {
        const c = this._config();
        this._lastConfig = c;
        const root = c.assetDirectory
            ? (c.assetDirectory.startsWith('~/')
                ? GLib.build_filenamev([GLib.get_home_dir(), c.assetDirectory.slice(2)]) : c.assetDirectory)
            : GLib.build_filenamev([GLib.get_user_data_dir(), 'fnaf-mode', 'assets']);
        let links;
        try {
            links = readAudioLinks(root);
            this._lastAudioLinks = {root, links};
        } catch (error) {
            console.warn(`[FNAF Mode] Invalid audio_links.json: ${error.message}; keeping last valid mapping.`);
            links = this._lastAudioLinks?.root === root ? this._lastAudioLinks.links : {};
        }
        const assets = scanAssets(root, links);
        for (const warning of assets.warnings)
            console.warn(`[FNAF Mode] ${warning}`);
        const animationOnly = this._firstEvent && c.jumpscareFirst;
        const visual = choose(assets.visuals, this._previousVisual, animationOnly);
        if (!visual) {
            if (!this._warnedEmpty) {
                console.warn(animationOnly
                    ? `[FNAF Mode] jumpscareFirst requires an animation in ${root}/animations; waiting for frames.`
                    : `[FNAF Mode] Add images or animation frames to ${root}; waiting for assets.`);
                this._warnedEmpty = true;
            }
            this._schedule();
            return;
        }
        this._warnedEmpty = false;
        this._previousVisual = visual.id;
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        this._firstEvent = false;
        this._overlay = new St.Widget({reactive: false, can_focus: false,
            x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height,
            clip_to_allocation: true});
        this._image = new St.Widget({reactive: false, can_focus: false,
            width: monitor.width, height: monitor.height});
        this._light = new St.Widget({reactive: false, can_focus: false,
            width: monitor.width, height: monitor.height});
        this._overlay.add_child(this._image);
        this._overlay.add_child(this._light);
        // GNOME 50 removed affectsInputRegion; non-reactive actors provide passthrough.
        Main.layoutManager.addTopChrome(this._overlay, {
            affectsStruts: false, trackFullscreen: false,
        });
        const phases = visual.type === 'animation'
            ? animationTimeline(c, visual.frames.length)
            : timeline(c, randomBetween(c.eventMinSeconds, c.eventMaxSeconds));
        let soundStarted = false;
        const started = GLib.get_monotonic_time();
        const frameGeometry = new Map();
        const baseAlignment = imageAlignment(visual.id);
        let lastFrame = -1;
        let lastFlicker = -1;
        let burstStart = phases.flickerEnd + randomBetween(c.flickerGapMinSeconds, c.flickerGapMaxSeconds);
        let burstEnd = burstStart + randomBetween(c.flickerBurstMinSeconds, c.flickerBurstMaxSeconds);
        let fadeStarted = false;
        const flicker = elapsed => {
            const step = Math.floor(elapsed * 1000 / c.flickerStepMs);
            if (step !== lastFlicker) {
                this._image.opacity = Math.random() < 0.3 ? 0 : c.imageOpacity;
                this._light.set_style('background-color: black;');
                this._light.opacity = Math.floor(randomBetween(60, 230));
                lastFlicker = step;
            }
        };
        const tick = () => {
            const elapsed = (GLib.get_monotonic_time() - started) / 1000000;
            if (elapsed >= phases.end) {
                this._clear();
                this._schedule();
                return;
            }
            if (!soundStarted && elapsed >= phases.imageStart) {
                soundStarted = true;
                const audioSeconds = phases.end - phases.imageStart;
                this._playSounds(visual.sounds, audioSeconds, c);
            }
            const frame = frameIndex(visual, c, phases, elapsed);
            if (frame !== lastFrame && elapsed < phases.imageEnd) {
                const path = visual.frames[frame];
                const uri = Gio.File.new_for_path(path).get_uri();
                if (!frameGeometry.has(path)) {
                    let width = 0;
                    let height = 0;
                    try {
                        [, width, height] = GdkPixbuf.Pixbuf.get_file_info(path);
                    } catch (_) { /* A removed or unreadable frame retains screen-sized geometry. */ }
                    frameGeometry.set(path, imageGeometry(width, height, monitor.width, monitor.height,
                        imageAlignment(path, baseAlignment)));
                }
                const geometry = frameGeometry.get(path);
                this._image.set_size(geometry.width, geometry.height);
                this._image.set_position(geometry.x, geometry.y);
                // Position the fitted actor: St does not support CSS position keywords/percentages.
                // Encoded URI prevents filenames from injecting CSS.
                this._image.set_style(`background-image: url("${uri}"); background-size: contain; background-repeat: no-repeat;`);
                lastFrame = frame;
            }
            if (elapsed < phases.flashEnd) {
                this._image.opacity = 0;
                this._light.set_style('background-color: white;');
                this._light.opacity = c.flashOpacity;
            } else if (elapsed < phases.flickerEnd) {
                flicker(elapsed);
            } else if (elapsed < phases.imageEnd) {
                if (elapsed >= burstEnd) {
                    burstStart = elapsed + randomBetween(c.flickerGapMinSeconds, c.flickerGapMaxSeconds);
                    burstEnd = burstStart + randomBetween(c.flickerBurstMinSeconds, c.flickerBurstMaxSeconds);
                }
                if (elapsed >= burstStart) {
                    flicker(elapsed);
                } else {
                    this._image.opacity = c.imageOpacity;
                    this._light.opacity = 0;
                    lastFlicker = -1;
                }
            } else if (!fadeStarted) {
                this._image.opacity = 0;
                this._light.set_style('background-color: black;');
                this._light.opacity = 255;
                if (elapsed >= phases.blackoutEnd) {
                    fadeStarted = true;
                    this._light.ease({opacity: 0,
                        duration: Math.max(1, (phases.end - elapsed) * 1000),
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD});
                }
            }
            this._later(1000 / Math.max(20, c.animationFps), tick);
        };
        tick();
    }

    _playSounds(files, seconds, c) {
        if (!c.soundEnabled || !files.length)
            return;
        const mpv = GLib.find_program_in_path('mpv');
        if (!mpv) {
            console.warn('[FNAF Mode] Install mpv to enable audio.');
            return;
        }
        const fadeIn = Math.min(c.soundFadeInSeconds, seconds / 2);
        const fadeOut = Math.min(c.soundFadeOutSeconds, seconds / 2);
        const filters = [`apad=whole_dur=${seconds}`];
        if (fadeIn > 0)
            filters.push(`afade=t=in:st=0:d=${fadeIn}`);
        if (fadeOut > 0)
            filters.push(`afade=t=out:st=${seconds - fadeOut}:d=${fadeOut}`);
        const argv = [mpv, '--no-config', '--no-video', '--audio-display=no',
            '--no-terminal', '--input-terminal=no', `--length=${seconds}`,
            `--volume=${c.soundVolume}`, `--af=lavfi=[${filters.join(',')}]`];
        for (const file of files) {
            try {
                const player = Gio.Subprocess.new([...argv, '--', file],
                    Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
                const players = this._players;
                players.add(player);
                player.wait_async(null, (proc, result) => {
                    try {
                        proc.wait_finish(result);
                        if (!proc.get_successful() && !proc.get_if_signaled())
                            console.warn('[FNAF Mode] mpv failed to play a supplied track.');
                    } catch (error) {
                        console.warn(`[FNAF Mode] Audio: ${error.message}`);
                    }
                    players.delete(proc);
                });
            } catch (error) {
                console.warn(`[FNAF Mode] Audio: ${error.message}`);
            }
        }
    }

    disable() {
        this._settings.disconnect(this._settingsId);
        Main.layoutManager.disconnect(this._monitorId);
        Main.sessionMode.disconnect(this._sessionId);
        this._clear();
        this._settings = null;
        this._lastConfig = null;
        this._previousVisual = null;
        this._lastAudioLinks = null;
    }
}
