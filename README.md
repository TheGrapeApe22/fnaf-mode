# FNAF Mode

A GNOME Shell 50 extension for Ubuntu 26.04 / Wayland. `fnaf-mode` toggles a
click-through overlay on the primary screen, including over fullscreen apps.
Your apps retain keyboard focus and mouse input.

With the current repository config, events follow **2 seconds of normal desktop
time**. Still-image events last **4 seconds**; animations play once at
`visuals.animationFps`, then go black and fade back to desktop. Opening flashes
and repeated flicker bursts overlay the images. A different visual is chosen each
time when at least two exist. An animation's associated MP3 starts with its first
frame and fades out with the ending, alongside the random global tracks.
Each event also plays one or two random tracks from the global sound folder. Supply your own media; nothing is downloaded.
Nothing controls physical lights or brightness.

## Install

From this folder:

```sh
# mpv is needed for sound; ffmpeg is only needed to convert GIFs.
sudo apt install mpv ffmpeg
./deploy.sh
```

Log out and back in after first installation (or extension code updates), then:

```sh
~/.local/bin/fnaf-mode on
~/.local/bin/fnaf-mode toggle # switch on/off
~/.local/bin/fnaf-mode        # same as toggle
~/.local/bin/fnaf-mode off   # immediately remove effects and stop audio
~/.local/bin/fnaf-mode status
~/.local/bin/fnaf-mode status --verbose # include GNOME extension details
```

If `~/.local/bin` is on your PATH, use just `fnaf-mode`. Otherwise add
`export PATH="$HOME/.local/bin:$PATH"` to `~/.bashrc`.

`deploy.sh --no-enable` installs files without asking GNOME to enable the
extension. The extension is initially inactive; once enabled, its on/off setting
persists across logins. Locking the session pauses effects; unlocking restarts the
normal random wait. Each deployment overwrites the installed config with this
repository's `config.json`. Existing installed media files are preserved.
GNOME caches extension modules, so disabling/re-enabling alone does not reliably
load code changes; log out/in after redeployment.

`status` prints `FNAF mode ON` or `FNAF mode OFF`. An ON setting with an inactive
extension is reported as OFF with the GNOME state. If GNOME cannot be reached,
an ON setting is reported as UNKNOWN rather than claiming effects are running.

The interval measures normal desktop time **after the entire previous event
finishes**. A 4-second event plus a 2-second interval means approximately 6 seconds
between event starts, with 2 seconds of normal desktop in between. If the normal
gap itself is much longer, redeploy your config and log out/in to load extension
code changes; then toggle off/on to reset any previously scheduled wait.

## Supply media

You can populate the `assets/` folders in this repository **before deployment**.
The deploy script copies new files into your installed media library. After
installation, add/edit files directly in the installed library:

```text
~/.local/share/fnaf-mode/assets/
  images/
    mangle-1.png
    mangle-2.jpg
  animations/
    jumpscare-one/
      frames/
        frame-00001.png
        frame-00002.png
      audio.mp3
    jumpscare-two/
      frames/
        001.gif
        002.gif
      FNAF 2 Jumpscare Sound.mp3
  sounds/
    static.mp3
    scream.mp3
```

Each still and each animation subfolder counts as one visual. Frames are sorted
naturally by filename and play **once** at `visuals.animationFps`. Still images
support PNG, JPEG and WebP. Animation frames also support individual GIF images
(their first frame is used). Older animation folders with frames directly inside
the animation folder still work; when `frames/` exists, it takes precedence.
Use reasonably sized frames (roughly your screen resolution) and short animations;
these are rendered inside GNOME Shell. Images are fitted without cropping.
Transparent images reveal your desktop; opaque images cover it.
Hidden files/folders and symlinks are ignored. Personal media in this repository
is git-ignored. With no visuals, the extension waits silently for you to add some.
With no MP3s, events are silent.

Filename hints align the fitted image with the corresponding screen edge:

| Filename | Alignment |
| --- | --- |
| `mangle-top.png` | Top, horizontally centered |
| `mangle-bottom.png` | Bottom, horizontally centered |
| `mangle-left.png` | Left, vertically centered |
| `mangle-right.png` | Right, vertically centered |
| `mangle-top-left.png` | Top-left corner |
| `mangle_bottom_right.png` | Bottom-right corner |
| `mangle.png` or `mangle-center.png` | Center |

Hints are case-insensitive substrings, so `MangleTopRight.png` also works.
Conflicting hints such as `top-bottom` center that axis. Animation folder names
provide defaults (`animations/jumpscare-bottom-left/frames/frame-001.png`); a frame's own
hints override the corresponding axis. `center` (or `centre`) resets both axes.
Only the filename and animation folder name are used, not parent directory names.
Alignment moves the space around an image; an image filling an entire screen axis
already touches both edges on that axis. Transparent margins inside a file remain.
Rename installed assets to change alignment without redeploying.

GIFs must be converted to frame folders:

```sh
fnaf-mode import-gif ~/Downloads/mangle.gif mangle-jumpscare
# Optional rate (also set visuals.animationFps to the same value):
fnaf-mode import-gif ~/Downloads/another.gif another-jumpscare --fps 20
```

Import keeps your source GIF intact, refuses to overwrite an existing animation,
and caps output to 900 frames and 1280 pixels per dimension. GIF frame timing is
resampled to the selected fixed frame rate. Frames become visible to the extension
only after conversion completes. Import creates `<name>/frames/`; put an associated
MP3 beside `frames/` afterward. Multi-frame GIFs are converted rather than played
directly; individual GIF files already extracted as frames can be used as-is.

Put each animation's MP3 beside its `frames/` directory. `audio.mp3` is preferred
(case-insensitive). A descriptive filename also works: if `audio.mp3` is absent,
the first MP3 in natural filename order is used. Keep one MP3 per animation for
clarity. This track plays **in addition to** the global random tracks.

Every event chooses one or two distinct tracks from `sounds/`, according to
`audio.minTracks` / `maxTracks`. With both set to 2 and an associated MP3 present,
all three tracks start together with the animation. Without an associated MP3,
the event still plays its global tracks. With an empty global sound folder, the
associated MP3 can play alone. `audio.enabled` and volume/fade settings apply to
all tracks.

Animation playback lasts **frame count ÷ animationFps**. The opening flash happens
first; the first animation frame and its audio start together after it. After the
last frame's interval, the image immediately goes black and fades to desktop.
The audio continues into that ending and fades out. Animation events ignore
`timing.eventMinSeconds` / `eventMaxSeconds`; still images continue using them.
For example, 24 frames at 12 FPS play for 2 seconds, plus the opening flash,
blackout, and return fade. Frame filenames such as `delay-0.05s` do not set timing;
the configured frame rate is used for every animation.

Prefer tracks at least as long as the animation plus its blackout and return fade,
or the configured still-image event duration, so the ending fade stays audible.
Shorter tracks are padded with silence; longer tracks are faded and cut to the
event duration. Tracks never loop. Volume is per track, so simultaneous tracks
combine at a higher volume. No sound changes system volume.

## Adjust settings

```sh
fnaf-mode config   # print config path
fnaf-mode assets   # print media library path
```

Edit this repository's [`config.json`](config.json), then run `./deploy.sh` to
overwrite `~/.config/fnaf-mode/config.json`. You can also edit the installed file
directly for immediate changes, but the next deployment replaces it. Key settings:

The file has four sections: `timing`, `visuals`, `audio`, and `assets`.

| Setting | Meaning |
| --- | --- |
| `timing.intervalMinSeconds`, `intervalMaxSeconds` | Random normal time between events |
| `timing.eventMinSeconds`, `eventMaxSeconds` | Still-image event time, including all fades |
| `visuals.flashSeconds`, `flashOpacity` | Opening white flash duration and opacity (0–255) |
| `visuals.flickerSeconds`, `flickerStepMs` | Opening flicker duration and darkness update interval |
| `visuals.flickerGapMinSeconds`, `flickerGapMaxSeconds` | Random clear gaps between repeated flicker bursts |
| `visuals.flickerBurstMinSeconds`, `flickerBurstMaxSeconds` | Duration of each repeated flicker burst |
| `visuals.blackoutSeconds`, `fadeBackSeconds` | Black screen, then return to desktop |
| `visuals.imageOpacity`, `animationFps` | Visual opacity (0–255) and frame rate (1–30) |
| `audio.enabled` | Allow audio |
| `audio.minTracks`, `maxTracks` | Number of random global MP3s (1–2), plus any associated animation track |
| `audio.volume` | Per-track mpv volume (0–100) |
| `audio.fadeInSeconds`, `fadeOutSeconds` | Audio fades |
| `assets.directory` | Empty string for default media root, or an absolute path / `~/...` |

Repeated dark flicker bursts continue throughout the image phase. Reduce the gap
settings for more frequent flickers; increase the burst settings for longer ones.
The final blackout and fade back remain smooth.

The installed config and media are re-read between events. Changes made directly
to the installed config take effect without deployment; edits to the repository
config require `./deploy.sh`. Toggle off/on to immediately start a new wait using
edited timing. Invalid config logs an error and retains the last good values.
Missing keys use defaults (5–50 seconds between events, 2–4 seconds per event).
Old flat configs still load. If you shorten still-image events, transition phases
scale down to leave time for the image. Set `visuals.flashOpacity` to 0 to suppress the white
flash.

XDG_CONFIG_HOME and XDG_DATA_HOME are respected; the paths above are defaults.
GNOME must share those environment settings with your terminal.

## Troubleshooting / removal

```sh
gnome-extensions info fnaf-mode@local
journalctl --user -f -o cat   # look for [FNAF Mode] errors
# Emergency stop, also available through the Extensions app:
gnome-extensions disable fnaf-mode@local
```

If GNOME reports “extension does not exist” immediately after installation, log
out/in, then run `fnaf-mode on`. If user extensions are globally disabled, enable
them in the Extensions app first. `status` checks the on/off setting and whether
GNOME loaded the extension. Use `--verbose` to include full extension details.

To uninstall, disable the extension, then remove
`~/.local/share/gnome-shell/extensions/fnaf-mode@local` and
`~/.local/bin/fnaf-mode`. Config/media remain in their separate `fnaf-mode`
directories until you choose to remove them.

## Checks

```sh
gjs -m tests/core.js
python3 tests/integration.py
bash -n deploy.sh
```

The automated checks cover config, asset discovery, scheduling arithmetic,
JavaScript syntax, isolated deployment, GIF import, and audio fade rendering.
Live compositor stacking, visual appearance, and input passthrough still need a
manual check in your GNOME session after installation.

Implementation references: [GNOME extension API](https://gjs.guide/extensions/topics/extension.html),
[GSettings](https://gjs.guide/extensions/development/preferences.html),
[GNOME 50 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-50.html),
and [mpv audio filters](https://mpv.io/manual/stable/#audio-filters).
