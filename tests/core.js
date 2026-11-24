import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {DEFAULTS, normalizeConfig, readConfig, scanAssets, EventBag, timeline,
    readAudioLinks, animationTimeline, frameIndex, imageAlignment, imageGeometry} from '../extension/core.js';

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
    assert(normalizeConfig().panelOnColor === '#ffffff', 'Default panel color');
    assert(normalizeConfig({panel: {onColor: '#e34A19'}}).panelOnColor === '#e34A19' &&
        normalizeConfig({panel: {onColor: '#f00'}}).panelOnColor === '#f00', 'Hex panel colors supported');
    for (const onColor of ['red; padding: 50px', '#12345', '', null, 123]) {
        let rejected = false;
        try { normalizeConfig({panel: {onColor}}); } catch (_) { rejected = true; }
        assert(rejected, 'Invalid panel colors rejected');
    }
    assert(normalizeConfig({panel: {offColor: '#345'}}).panelOffColor === '#345', 'Off color is configurable independently');
    let invalidOffColor = false;
    try { normalizeConfig({panel: {offColor: 'invalid'}}); } catch (_) { invalidOffColor = true; }
    assert(invalidOffColor, 'Invalid off color rejected');
    assert(normalizeConfig().initialWaitSeconds === 5, 'Default initial wait is five seconds');
    assert(normalizeConfig().jumpscareFirst === false &&
        normalizeConfig({timing: {jumpscareFirst: true}}).jumpscareFirst === true,
        'Jumpscare-first setting defaults off and accepts a boolean');
    const mixed = [{id: 'still', type: 'image'}, {id: 'scare', type: 'animation'}];
    for (let i = 0; i < 20; i++)
        assert(new EventBag().draw(mixed, null, true).id === 'scare', 'First-event selection excludes still images');
    assert(new EventBag().draw(mixed, 'scare', true).id === 'scare',
        'Only available animation can repeat across activations');
    assert(new EventBag().draw([mixed[0]], null, true) === null, 'No animation means wait instead of showing an image');
    const seven = Array.from({length: 7}, (_, i) => ({id: String(i), type: i < 2 ? 'animation' : 'image'}));
    const bag = new EventBag();
    let previous = null;
    for (let cycle = 0; cycle < 100; cycle++) {
        const drawn = [];
        for (let i = 0; i < seven.length; i++) {
            const event = bag.draw(seven, previous, cycle === 0 && i === 0);
            assert(event.id !== previous, 'No immediate repeat, including across bag boundaries');
            if (cycle === 0 && i === 0)
                assert(event.type === 'animation', 'Jumpscare-first draws from the same bag');
            drawn.push(event.id);
            previous = event.id;
        }
        assert(new Set(drawn).size === 7, 'Each bag contains every event exactly once');
    }
    const liveBag = new EventBag();
    const initial = liveBag.draw(seven);
    const updated = seven.toReversed().map(item => ({...item, updated: true}));
    const afterEdit = Array.from({length: 6}, () => liveBag.draw(updated));
    assert(afterEdit.every(item => item.updated && item.id !== initial.id) &&
        new Set(afterEdit.map(item => item.id)).size === 6, 'Metadata/reordering edits do not reset the bag');
    const added = [...seven, {id: 'new', type: 'image'}];
    assert(new Set(Array.from({length: 8}, () => liveBag.draw(added).id)).size === 8,
        'Adding an event refreshes the bag');
    assert(Array.from({length: 6}, () => liveBag.draw(seven.slice(1))).every(item => item.id !== '0'),
        'Removed events are never drawn');
    assert(normalizeConfig({timing: {initialWaitSeconds: 0}}).initialWaitSeconds === 0,
        'Initial wait can be disabled');
    assert(normalizeConfig({timing: {initialWaitSeconds: -1}}).initialWaitSeconds === 0,
        'Initial wait cannot be negative');
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
        audio: {enabled: false, volume: 20}, assets: {directory: '~/scares'}});
    assert(grouped.intervalMinSeconds === 7 && grouped.eventMaxSeconds === 6 &&
        grouped.flashOpacity === 100 && grouped.soundVolume === 20 &&
        !grouped.soundEnabled && grouped.assetDirectory === '~/scares',
    'Grouped config loads timing, visuals, audio and assets');
    assert(grouped.flickerGapMaxSeconds === 0.4, 'Burst gap bounds');
    let badSection = false;
    try { normalizeConfig({visuals: null}); } catch (_) { badSection = true; }
    assert(badSection, 'Invalid config sections rejected');
    const c = normalizeConfig({timing: {intervalMinSeconds: 9, intervalMaxSeconds: 2},
        visuals: {animationFps: 999, fadeBackSeconds: Infinity, flashOpacity: -20}});
    assert(c.intervalMaxSeconds === 9 && c.animationFps === 30, 'Timing bounds');
    assert(c.flashOpacity === 0, 'Opacity bounds');
    assert(c.fadeBackSeconds === DEFAULTS.fadeBackSeconds, 'Non-finite values rejected');
    for (const duration of [0.5, 2, 4, 10]) {
        const t = timeline(normalizeConfig({visuals: {flashSeconds: 99}}), duration);
        assert(t.flashEnd <= t.flickerEnd && t.flickerEnd < t.imageEnd &&
            t.imageEnd <= t.blackoutEnd && t.blackoutEnd <= t.end, 'Phase order');
        assert(t.end === duration, 'Whole event fits requested duration');
    }
    const animation = {frames: Array(24)};
    const animationConfig = normalizeConfig({timing: {eventMinSeconds: 90, eventMaxSeconds: 90}});
    const phases = animationTimeline(animationConfig, animation.frames.length);
    assert(Math.abs(phases.imageEnd - phases.imageStart - 2) < 0.0001,
        'Animation runs for frame count / FPS, independent of still-image event duration');
    assert(frameIndex(animation, animationConfig, phases, phases.imageStart) === 0 &&
        frameIndex(animation, animationConfig, phases, phases.imageEnd - 0.001) === 23 &&
        frameIndex(animation, animationConfig, phases, phases.end + 10) === 23,
    'First and last frames have their own interval; animation never wraps');
    const single = animationTimeline(animationConfig, 1);
    assert(Math.abs(single.imageEnd - single.imageStart - 1 / 12) < 0.0001,
        'A one-frame animation is still an animation');
    write(`${root}/images/a.png`);
    write(`${root}/images/b.JPG`);
    write(`${root}/images/readme.md`);
    write(`${root}/animations/scare/frame-10.png`);
    write(`${root}/animations/scare/frame-2.png`);
    write(`${root}/animations/.import-partial/frame-1.png`);
    write(`${root}/sounds/a.mp3`);
    write(`${root}/sounds/b.MP3`);
    const assets = scanAssets(root);
    assert(assets.visuals.length === 3, 'Asset discovery');
    assert(assets.visuals[2].frames[0].endsWith('frame-2.png'), 'Natural frame order');
    write(`${root}/animations/z-bundle/frames/frame-10.gif`);
    write(`${root}/animations/z-bundle/frames/frame-2.png`);
    write(`${root}/animations/z-bundle/old-root-frame.png`);
    write(`${root}/animations/z-bundle/another.mp3`);
    write(`${root}/animations/z-bundle/audio.mp3`);
    write(`${root}/animations/zz-named/frames/001.gif`);
    write(`${root}/animations/zz-named/FNAF 2 Jumpscare Sound.mp3`);
    const bundled = scanAssets(root).visuals;
    const bundle = bundled.find(v => v.id.endsWith('/z-bundle'));
    const named = bundled.find(v => v.id.endsWith('/zz-named'));
    assert(bundle.type === 'animation' && bundle.frames.length === 2 &&
        bundle.frames[0].endsWith('/frames/frame-2.png'),
    'Nested frames, GIF support, natural order and no root duplicates');
    assert(named.sounds.length === 0 && assets.visuals[0].type === 'image',
        'No mapping file is silent; folder MP3s are ignored');
    write(`${root}/sounds/jumpscare.mp3`);
    const links = {images: {'a.png': ['a.mp3', 'b.MP3'], 'b.JPG': []},
        animations: {'z-bundle': ['a.mp3', 'b.MP3', 'jumpscare.mp3', 'a.mp3'],
            'zz-named': ['missing.mp3']}};
    write(`${root}/audio_links.json`, JSON.stringify(links));
    const mapped = scanAssets(root);
    assert(mapped.visuals.find(v => v.id.endsWith('/a.png')).sounds.length === 2,
        'Full image filenames resolve their exact listed sounds');
    assert(mapped.visuals.find(v => v.id.endsWith('/b.JPG')).sounds.length === 0 &&
        mapped.visuals.find(v => v.id.endsWith('/scare')).sounds.length === 0,
        'Explicit empty and omitted mappings are silent');
    assert(mapped.visuals.find(v => v.id.endsWith('/z-bundle')).sounds.length === 3,
        'All mapped animation tracks resolve, duplicates removed');
    assert(mapped.visuals.find(v => v.id.endsWith('/zz-named')).sounds.length === 0 &&
        mapped.warnings.length === 1, 'Missing sound skipped with a diagnostic');
    links.animations['z-bundle'] = ['b.MP3'];
    write(`${root}/audio_links.json`, JSON.stringify(links));
    assert(scanAssets(root).visuals.find(v => v.id.endsWith('/z-bundle')).sounds[0].endsWith('/b.MP3'),
        'Mapping edits are read dynamically');
    links.images = {a: ['a.mp3'], 'b.jpg': ['b.MP3']};
    write(`${root}/audio_links.json`, JSON.stringify(links));
    assert(scanAssets(root).visuals.filter(v => v.type === 'image').every(v => v.sounds.length === 0),
        'Stems and mismatched filename casing do not resolve');
    for (const invalid of ['{broken', '[]', '{"images":null}', '{"animations":{"scare":"a.mp3"}}']) {
        write(`${root}/audio_links.json`, invalid);
        let rejected = false;
        try { readAudioLinks(root); } catch (_) { rejected = true; }
        assert(rejected, 'Invalid mapping rejected');
    }
    assert(new EventBag().draw([], null) === null, 'Empty library');
    for (let i = 0; i < 50; i++)
        assert(new EventBag().draw(assets.visuals, assets.visuals[0].id).id !== assets.visuals[0].id, 'No repeat');
    assert(new EventBag().draw([assets.visuals[0]], assets.visuals[0].id) === assets.visuals[0], 'Single visual');
    assert(scanAssets(`${root}/missing`).visuals.length === 0, 'Missing library');
    const [, defaultBytes] = GLib.file_get_contents('default.json');
    const fileDefaults = JSON.parse(new TextDecoder().decode(defaultBytes));
    fileDefaults.timing.initialWaitSeconds = 12;
    fileDefaults.timing.jumpscareFirst = true;
    fileDefaults.audio.volume = 63;
    fileDefaults.panel.onColor = '#123456';
    fileDefaults.panel.offColor = '#abcdef';
    fileDefaults.assets.directory = '/tmp/fnaf-test-library';
    write(`${root}/default.json`, JSON.stringify(fileDefaults));
    assert(readConfig(`${root}/config.json`).initialWaitSeconds === 12,
        'Missing config reads default.json');
    write(`${root}/config.json`, '{"audio": {"enabled": false}}');
    const inheritedConfig = readConfig(`${root}/config.json`);
    assert(!inheritedConfig.soundEnabled && inheritedConfig.soundVolume === 63 &&
        inheritedConfig.panelOnColor === '#123456' && inheritedConfig.assetDirectory === '/tmp/fnaf-test-library',
    'Missing fields and sections inherit file defaults, including siblings in a partially overridden section');
    write(`${root}/config.json`, JSON.stringify({timing: {initialWaitSeconds: 0, jumpscareFirst: false},
        audio: {volume: 0}, assets: {directory: ''}}));
    const explicit = readConfig(`${root}/config.json`);
    assert(explicit.initialWaitSeconds === 0 && !explicit.jumpscareFirst &&
        explicit.soundVolume === 0 && explicit.assetDirectory === '',
    'Explicit zero, false and empty strings override defaults');
    fileDefaults.panel.onColor = '#654321';
    write(`${root}/default.json`, JSON.stringify(fileDefaults));
    assert(readConfig(`${root}/config.json`).panelOnColor === '#654321', 'Default edits are read dynamically');
    write(`${root}/config.json`, '{"panel":{"onColor":"#456789"}}');
    assert(readConfig(`${root}/config.json`).panelOnColor === '#456789' &&
        readConfig(`${root}/config.json`).panelOffColor === '#abcdef', 'On color override inherits default off color');
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
