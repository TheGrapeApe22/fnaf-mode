import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const DEFAULTS = Object.freeze({
    initialWaitSeconds: 5,
    jumpscareFirst: false,
    intervalMinSeconds: 5, intervalMaxSeconds: 50,
    eventMinSeconds: 2, eventMaxSeconds: 4,
    flashSeconds: 0.12, flashOpacity: 180,
    flickerSeconds: 0.45, flickerStepMs: 90,
    flickerGapMinSeconds: 0.12, flickerGapMaxSeconds: 0.3,
    flickerBurstMinSeconds: 0.12, flickerBurstMaxSeconds: 0.28,
    blackoutSeconds: 0.2, fadeBackSeconds: 0.65,
    imageOpacity: 255, animationFps: 12,
    soundEnabled: true,
    soundVolume: 45, soundFadeInSeconds: 0.3, soundFadeOutSeconds: 0.65,
    assetDirectory: '',
    panelTextColor: '#ffffff',
});

export function normalizeConfig(raw = {}, defaults = DEFAULTS) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('Config must be a JSON object');
    for (const section of ['timing', 'visuals', 'audio', 'panel', 'assets']) {
        if (section in raw && (!raw[section] || typeof raw[section] !== 'object' || Array.isArray(raw[section])))
            throw new Error(`${section} must be a JSON object`);
    }
    const input = {...raw.timing, ...raw.visuals};
    for (const key of ['enabled', 'volume', 'fadeInSeconds', 'fadeOutSeconds']) {
        if (raw.audio && key in raw.audio)
            input[`sound${key[0].toUpperCase()}${key.slice(1)}`] = raw.audio[key];
    }
    if (raw.assets && 'directory' in raw.assets)
        input.assetDirectory = raw.assets.directory;
    if (raw.panel && 'textColor' in raw.panel) {
        if (typeof raw.panel.textColor !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(raw.panel.textColor))
            throw new Error('panel.textColor must be a hex color such as #ffffff or #f00');
        input.panelTextColor = raw.panel.textColor;
    }
    const c = {...defaults};
    for (const [key, value] of Object.entries(defaults)) {
        if (typeof value === 'number') {
            if (typeof input[key] === 'number' && Number.isFinite(input[key]))
                c[key] = Math.max(0, input[key]);
        } else if (typeof input[key] === typeof value)
            c[key] = input[key];
    }
    for (const prefix of ['interval', 'event']) {
        c[`${prefix}MinSeconds`] = Math.max(0.5, c[`${prefix}MinSeconds`]);
        c[`${prefix}MaxSeconds`] = Math.max(c[`${prefix}MinSeconds`], c[`${prefix}MaxSeconds`]);
    }
    // Bound resource usage and retain some time for the image itself.
    c.animationFps = Math.min(30, Math.max(1, c.animationFps));
    c.flickerStepMs = Math.max(50, c.flickerStepMs);
    for (const kind of ['Gap', 'Burst']) {
        c[`flicker${kind}MinSeconds`] = Math.max(0.05, c[`flicker${kind}MinSeconds`]);
        c[`flicker${kind}MaxSeconds`] = Math.max(c[`flicker${kind}MinSeconds`], c[`flicker${kind}MaxSeconds`]);
    }
    c.flashOpacity = Math.min(255, c.flashOpacity);
    c.imageOpacity = Math.min(255, c.imageOpacity);
    c.soundVolume = Math.min(100, c.soundVolume);
    if (c.assetDirectory && !c.assetDirectory.startsWith('/') && !c.assetDirectory.startsWith('~/'))
        throw new Error('assets.directory must be an absolute path or start with ~/');
    return c;
}

function readJson(path, required = false) {
    const file = Gio.File.new_for_path(path);
    if (!required && !file.query_exists(null))
        return {};
    const [, bytes] = file.load_contents(null);
    return JSON.parse(new TextDecoder().decode(bytes));
}

export function mergeConfig(defaults, overrides) {
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!object(defaults) || !object(overrides))
        throw new Error('Config files must contain JSON objects');
    const merged = {...defaults, ...overrides};
    for (const [key, value] of Object.entries(overrides)) {
        if (object(value) && object(defaults[key]))
            merged[key] = mergeConfig(defaults[key], value);
    }
    return merged;
}

export function readConfig(path) {
    const defaults = readJson(GLib.build_filenamev([GLib.path_get_dirname(path), 'default.json']), true);
    return normalizeConfig(mergeConfig(defaults, readJson(path)), normalizeConfig(defaults));
}

export function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

export class EventBag {
    constructor() {
        this._signature = null;
        this._remaining = [];
    }

    draw(items, previous = null, animationOnly = false) {
        // Store IDs, not asset objects, so audio/metadata edits apply immediately.
        const byId = new Map(items.map(item => [item.id, item]));
        const ids = [...byId.keys()];
        const signature = JSON.stringify([...ids].sort());
        if (signature !== this._signature) {
            this._signature = signature;
            this._remaining = [];
        }
        if (!this._remaining.length) {
            this._remaining = [...ids];
            for (let i = this._remaining.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this._remaining[i], this._remaining[j]] = [this._remaining[j], this._remaining[i]];
            }
        }
        const eligible = [];
        for (let i = 0; i < this._remaining.length; i++) {
            if (!animationOnly || byId.get(this._remaining[i]).type === 'animation')
                eligible.push(i);
        }
        if (!eligible.length)
            return null;
        const index = eligible.at(-1);
        // Avoid immediate repeats at bag boundaries (unless only one choice exists).
        if (this._remaining[index] === previous && eligible.length > 1) {
            const other = eligible[Math.floor(Math.random() * (eligible.length - 1))];
            [this._remaining[index], this._remaining[other]] = [this._remaining[other], this._remaining[index]];
        }
        return byId.get(this._remaining.splice(index, 1)[0]);
    }
}

export function imageAlignment(filename, fallback = {x: 0.5, y: 0.5}) {
    const name = GLib.path_get_basename(filename).replace(/\.(png|jpe?g|webp|gif)$/i, '').toLowerCase();
    const alignment = /cent(?:er|re)/.test(name) ? {x: 0.5, y: 0.5} : {...fallback};
    for (const [axis, start, end] of [['x', 'left', 'right'], ['y', 'top', 'bottom']]) {
        const a = name.includes(start);
        const b = name.includes(end);
        if (a || b)
            alignment[axis] = a === b ? 0.5 : (a ? 0 : 1);
    }
    return alignment;
}

export function imageGeometry(width, height, screenWidth, screenHeight, alignment) {
    if (!(width > 0 && height > 0)) {
        width = screenWidth;
        height = screenHeight;
    }
    const scale = Math.min(screenWidth / width, screenHeight / height);
    width *= scale;
    height *= scale;
    return {width, height, x: (screenWidth - width) * alignment.x,
        y: (screenHeight - height) * alignment.y};
}

function children(path) {
    const result = [];
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null))
        return result;
    const enumerator = file.enumerate_children('standard::name,standard::type',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    try {
        let info;
        while ((info = enumerator.next_file(null))) {
            if (!info.get_name().startsWith('.'))
                result.push({name: info.get_name(), type: info.get_file_type(),
                    path: GLib.build_filenamev([path, info.get_name()])});
        }
    } finally {
        enumerator.close(null);
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'en', {numeric: true}));
}

const imagePattern = /\.(png|jpe?g|webp)$/i;
export function readAudioLinks(root) {
    const raw = readJson(GLib.build_filenamev([root, 'audio_links.json']));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('audio_links.json must be an object');
    for (const section of ['images', 'animations']) {
        const entries = Object.hasOwn(raw, section) ? raw[section] : {};
        if (!entries || typeof entries !== 'object' || Array.isArray(entries))
            throw new Error(`audio_links.json ${section} must be an object`);
        for (const [name, tracks] of Object.entries(entries)) {
            if (!Array.isArray(tracks) || tracks.some(track => typeof track !== 'string'))
                throw new Error(`audio_links.json ${section}.${name} must be an array of sound filenames`);
        }
    }
    return raw;
}

export function scanAssets(root, audioLinks = readAudioLinks(root)) {
    const visuals = [];
    const regular = f => f.type === Gio.FileType.REGULAR;
    for (const f of children(GLib.build_filenamev([root, 'images']))) {
        if (regular(f) && imagePattern.test(f.name))
            visuals.push({id: f.path, type: 'image', frames: [f.path]});
    }
    for (const folder of children(GLib.build_filenamev([root, 'animations']))) {
        if (folder.type !== Gio.FileType.DIRECTORY)
            continue;
        const entries = children(folder.path);
        const frameDirectory = entries.find(f => f.name === 'frames' && f.type === Gio.FileType.DIRECTORY);
        // Both direct frames and the importer's frames/ layout are supported.
        const frames = (frameDirectory ? children(frameDirectory.path) : entries)
            .filter(f => regular(f) && /\.(png|jpe?g|webp|gif)$/i.test(f.name));
        if (frames.length)
            visuals.push({id: folder.path, type: 'animation', frames: frames.map(f => f.path)});
    }
    const sounds = children(GLib.build_filenamev([root, 'sounds']))
        .filter(f => regular(f) && /\.mp3$/i.test(f.name)).map(f => f.path);
    const byName = new Map(sounds.map(path => [GLib.path_get_basename(path), path]));
    const warnings = [];
    for (const visual of visuals) {
        const name = GLib.path_get_basename(visual.id);
        const section = audioLinks[visual.type === 'image' ? 'images' : 'animations'] ?? {};
        const tracks = Object.hasOwn(section, name) ? section[name] : [];
        visual.sounds = [];
        for (const track of new Set(tracks)) {
            if (byName.has(track))
                visual.sounds.push(byName.get(track));
            else
                warnings.push(`audio_links.json: ${name} references missing sounds/${track}`);
        }
    }
    return {visuals, warnings};
}

// All phases, including the fade to desktop, fit inside the chosen event duration.
export function timeline(config, seconds) {
    const phases = [config.flashSeconds, config.flickerSeconds,
        config.blackoutSeconds, config.fadeBackSeconds];
    const scale = Math.min(1, seconds * 0.65 / (phases.reduce((a, b) => a + b, 0) || 1));
    const [flash, flicker, blackout, fade] = phases.map(v => v * scale);
    const imageEnd = seconds - blackout - fade;
    return {imageStart: 0, flashEnd: flash, flickerEnd: flash + flicker, imageEnd,
        blackoutEnd: imageEnd + blackout, end: seconds};
}

export function animationTimeline(config, frameCount) {
    const imageStart = config.flashSeconds;
    const duration = frameCount / config.animationFps;
    const imageEnd = imageStart + duration;
    const blackoutEnd = imageEnd + config.blackoutSeconds;
    return {imageStart, flashEnd: imageStart,
        flickerEnd: imageStart + Math.min(config.flickerSeconds, duration * 0.35),
        imageEnd, blackoutEnd, end: blackoutEnd + config.fadeBackSeconds};
}

export function frameIndex(visual, config, phases, elapsed) {
    // Never wrap to frame zero. Each frame gets one interval before blackout.
    return Math.min(visual.frames.length - 1,
        Math.floor(Math.max(0, elapsed - phases.imageStart) * config.animationFps));
}
