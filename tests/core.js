import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {DEFAULTS, normalizeConfig, readConfig, scanAssets, choose, timeline,
    imageAlignment, imageGeometry} from '../extension/core.js';

function assert(value, message) {
    if (!value)
        throw new Error(message);
}
function write(path, text = '') {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
    GLib.file_set_contents(path, text);
}
function remove(file) {
    if (file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY) {
        const entries = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = entries.next_file(null)))
            remove(file.get_child(info.get_name()));
        entries.close(null);
    }
    file.delete(null);
}

const root = GLib.dir_make_tmp('fnaf-test-XXXXXX');
try {
    for (const [name, x, y] of [
        ['mangle.png', 0.5, 0.5], ['mangle-top.png', 0.5, 0],
        ['mangle_bottom.JPG', 0.5, 1], ['mangleLeft.webp', 0, 0.5],
        ['MANGLE-TOP-RIGHT.PNG', 1, 0], ['bottomleft.png', 0, 1],
        ['top-bottom-left-right.png', 0.5, 0.5], ['/top/right/mangle.png', 0.5, 0.5],
    ]) {
        const a = imageAlignment(name);
        assert(a.x === x && a.y === y, `Filename alignment: ${name}`);
    }
    const folder = imageAlignment('jumpscare-bottom-right');
    const inherited = imageAlignment('frame-001.png', folder);
    const override = imageAlignment('frame-top-002.png', folder);
    const centered = imageAlignment('frame-center-003.png', folder);
    assert(inherited.x === 1 && inherited.y === 1 && override.x === 1 && override.y === 0 &&
        centered.x === 0.5 && centered.y === 0.5, 'Animation folder inheritance and frame overrides');
    const wide = imageGeometry(200, 100, 1920, 1080, {x: 0.5, y: 1});
    const tall = imageGeometry(100, 200, 1920, 1080, {x: 1, y: 0});
    assert(wide.width === 1920 && wide.height === 960 && wide.y === 120, 'Bottom edge, aspect preserved');
    assert(tall.width === 540 && tall.height === 1080 && tall.x === 1380, 'Right edge, aspect preserved');
    const grouped = normalizeConfig({timing: {intervalMinSeconds: 7, eventMaxSeconds: 6},
        visuals: {flashOpacity: 100, flickerGapMinSeconds: 0.4, flickerGapMaxSeconds: 0.1},
        audio: {enabled: false, maxTracks: 1, volume: 20}, assets: {directory: '~/scares'}});
    assert(grouped.intervalMinSeconds === 7 && grouped.eventMaxSeconds === 6 &&
        grouped.flashOpacity === 100 && grouped.soundVolume === 20 &&
        !grouped.soundEnabled && grouped.soundMaxTracks === 1 && grouped.assetDirectory === '~/scares',
    'Grouped config loads timing, visuals, audio and assets');
    assert(grouped.flickerGapMaxSeconds === 0.4, 'Burst gap bounds');
    let badSection = false;
    try { normalizeConfig({visuals: null}); } catch (_) { badSection = true; }
    assert(badSection, 'Invalid config sections rejected');
    const c = normalizeConfig({intervalMinSeconds: 9, intervalMaxSeconds: 2,
        animationFps: 999, soundMinTracks: 2, soundMaxTracks: 1,
        fadeBackSeconds: Infinity, flashOpacity: -20});
    assert(c.intervalMaxSeconds === 9 && c.animationFps === 30, 'Timing bounds');
    assert(c.soundMaxTracks === 2 && c.flashOpacity === 0, 'Track/opacity bounds');
    assert(c.fadeBackSeconds === DEFAULTS.fadeBackSeconds, 'Non-finite values rejected');
    for (const duration of [0.5, 2, 4, 10]) {
        const t = timeline(normalizeConfig({flashSeconds: 99}), duration);
        assert(t.flashEnd <= t.flickerEnd && t.flickerEnd < t.imageEnd &&
            t.imageEnd <= t.blackoutEnd && t.blackoutEnd <= t.end, 'Phase order');
        assert(t.end === duration, 'Whole event fits requested duration');
    }
    write(`${root}/images/a.png`);
    write(`${root}/images/b.JPG`);
    write(`${root}/images/readme.md`);
    write(`${root}/animations/scare/frame-10.png`);
    write(`${root}/animations/scare/frame-2.png`);
    write(`${root}/animations/.import-partial/frame-1.png`);
    write(`${root}/sounds/a.mp3`);
    write(`${root}/sounds/b.MP3`);
    const assets = scanAssets(root);
    assert(assets.visuals.length === 3 && assets.sounds.length === 2, 'Asset discovery');
    assert(assets.visuals[2].frames[0].endsWith('frame-2.png'), 'Natural frame order');
    assert(choose([], null) === null, 'Empty library');
    for (let i = 0; i < 50; i++)
        assert(choose(assets.visuals, assets.visuals[0].id).id !== assets.visuals[0].id, 'No repeat');
    assert(choose([assets.visuals[0]], assets.visuals[0].id) === assets.visuals[0], 'Single visual');
    assert(scanAssets(`${root}/missing`).visuals.length === 0, 'Missing library');
    write(`${root}/config.json`, '{"soundEnabled": false}');
    assert(!readConfig(`${root}/config.json`).soundEnabled, 'Read supplied config');
    write(`${root}/config.json`, '{broken');
    let rejected = false;
    try { readConfig(`${root}/config.json`); } catch (_) { rejected = true; }
    assert(rejected, 'Malformed JSON rejected');
    for (const name of ['core.js', 'extension.js']) {
        const [, bytes] = GLib.file_get_contents(`extension/${name}`);
        Reflect.parse(new TextDecoder().decode(bytes), {target: 'module'});
    }
    print('PASS: config validation, event timing, asset discovery, selection, module syntax');
} finally {
    remove(Gio.File.new_for_path(root));
}
