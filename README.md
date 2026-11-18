# FNAF Mode

A GNOME Shell 50 extension for Ubuntu 26.04 / Wayland. `fnaf-mode` toggles a
click-through overlay on the primary screen, including over fullscreen apps.
Your apps retain keyboard focus and mouse input.

Events alternate with normal desktop time, controlled by `timing` in `config.json`.
`timing.initialWaitSeconds` sets the delay before the first event after activation
or resuming from a locked session (default 5 seconds; 0 starts immediately).
It replaces the first interval rather than adding to it. Later events use
`intervalMinSeconds` / `intervalMaxSeconds` after the previous event finishes.
With audio enabled and a nonzero initial wait, a bundled 150 ms silent WAV plays
at zero volume about 1.5 seconds before the first event to wake the audio output.
It runs once per activation/resume, not between later events, and is canceled on
off or lock. It does not extend the initial wait; very short waits give the device
less time to wake up. The silent file is part of the extension, not the mapped
sound library.
Set `timing.jumpscareFirst` to `true` to force the first event after activation or
resume to be an animation. Later events choose normally from images and animations.
If no animation is available, it waits for animation frames rather than showing
an image. The initial wait still applies.
Still-image duration is also configurable; animations play once at
`visuals.animationFps`, then go black and fade back to desktop. Opening flashes
and repeated flicker bursts overlay the images. A different visual is chosen each
time when at least two exist. `assets/audio_links.json` selects the complete set
of tracks for each image or animation. All listed tracks start together with the
visual and fade out with the ending. Supply your own media; nothing is downloaded.
Nothing controls physical lights or brightness.

The top bar shows `○` when mode is off, seconds until the next event while waiting,
and `●` during an event. The countdown includes the initial wait and follows the
actual scheduled deadline, updating once per second. `–` means effects are paused.
Click the indicator to toggle mode; it uses the same command and configured
activation volume as the terminal. Disabling the whole extension removes the
indicator.

Set `panel.textColor` in `config.json` to color all indicator text, for example
`"panel": {"textColor": "#ff5500"}`. Three- and six-digit hex colors are supported;
the default is `#ffffff`. Config edits are picked up on the next toggle or event.

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

`fnaf-mode on` sets the default system output volume once to
`audio.systemVolumePercent` (50% by default). Toggling on does the same. You can
adjust volume freely afterward; events do not reset it. Turning mode off leaves
the volume as-is, and mute state is preserved. This uses `wpctl` (WirePlumber),
or `pactl` when `wpctl` is unavailable. This happens when the terminal command
activates the mode, not when GNOME restores it after login or unlocking.

`deploy.sh --no-enable` installs files without asking GNOME to enable the
extension. The extension is initially inactive; once enabled, its on/off setting
persists across logins. Locking the session pauses effects; unlocking starts the
initial wait again. Each deployment overwrites the installed config with this
repository's `config.json` and mirrors its `assets/` folder into the installed
media library. Changed files are replaced; installed files and folders absent
from the repository are deleted, including media added only to the installed copy.
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
The deploy script mirrors this folder into your installed media library. Keep
assets you want to retain in the repository's `assets/` folder. You can edit the
installed library directly for immediate changes, but deployment replaces those
edits and deletes files absent from the repository:

```text
~/.local/share/fnaf-mode/assets/
  audio_links.json
  images/
    mangle_bottom.webp
    mangle_left.webp
  animations/
    mangle_jumpscare_1/
      frame-00001.gif
      frame-00002.gif
    mangle_jumpscare_2/
      frames/
        001.png
        002.png
  sounds/
    ambience_fnaf_2.mp3
    mangle.mp3
    jumpscare_fnaf_2.mp3
```

Each still and each animation subfolder counts as one visual. Frames are sorted
naturally by filename and play **once** at `visuals.animationFps`. Still images
support PNG, JPEG and WebP. Animation frames also support individual GIF images
(their first frame is used). Frames can live directly inside the animation folder
or in a `frames/` subfolder; when `frames/` exists, it takes precedence.
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
only after conversion completes. Import creates `<name>/frames/`; add its sound
mapping to `audio_links.json` afterward. Multi-frame GIFs are converted rather than played
directly; individual GIF files already extracted as frames can be used as-is.

Keep **all MP3s in `sounds/`**. Map each visual to its complete track list in
`assets/audio_links.json`, for example:

```json
{
  "animations": {
    "mangle_jumpscare_1": ["ambience_fnaf_2.mp3", "mangle.mp3", "jumpscare_fnaf_2.mp3"]
  },
  "images": {
    "mangle_bottom.webp": ["ambience_fnaf_2.mp3", "mangle.mp3"]
  }
}
```

Animation keys are folder names. Image keys must be full filenames, including the
extension, such as `mangle_bottom.webp`. Names
are case-sensitive. Each listed sound filename resolves directly inside `sounds/`.
Every listed track plays together, even when there are more than two. The list
includes ambient tracks as well as jumpscare audio; no additional random tracks
are added. Repeated filenames are played once. An empty list or an omitted visual
is silent. Missing sound files are skipped and logged, while other tracks play.
MP3s placed inside animation folders are no longer used.

The installed mapping is re-read before every event. Editing it changes the next
event without toggling or logging out. If JSON is temporarily invalid while being
edited, the extension logs the error and retains the last valid mapping (or stays
silent if none has loaded yet). A missing mapping file makes all visuals silent.
The JSON arrays are the only source of track selection and track counts.

For edits to this repository's mapping, run `./deploy.sh` to copy it into the
installed library. Once this version of the extension is loaded, changes to the
mapping alone do not require another logout. `audio.enabled`, volume and fades
apply to every mapped track.

Animation playback lasts **frame count ÷ animationFps**. The opening flash happens
first; the first animation frame and its audio start together after it. After the
last frame's interval, the image immediately goes black and fades to desktop.
All mapped audio tracks continue into that ending and fade out. Animation events ignore
`timing.eventMinSeconds` / `eventMaxSeconds`; still images continue using them.
For example, 24 frames at 12 FPS play for 2 seconds, plus the opening flash,
blackout, and return fade. Frame filenames such as `delay-0.05s` do not set timing;
the configured frame rate is used for every animation.

Prefer tracks at least as long as the animation plus its blackout and return fade,
or the configured still-image event duration, so the ending fade stays audible.
Shorter tracks are padded with silence; longer tracks are faded and cut to the
event duration. Tracks never loop. Volume is per track, so simultaneous tracks
combine at a higher volume. Per-track playback volume is separate from the
one-time system output volume set when you turn FNAF mode on.

## Adjust settings

```sh
fnaf-mode config   # print config path
fnaf-mode assets   # print media library path
```

Edit this repository's [`config.json`](config.json), then run `./deploy.sh` to
overwrite `~/.config/fnaf-mode/config.json`. You can also edit the installed file
directly for immediate changes, but the next deployment replaces it. Key settings:

The file has five sections: `timing`, `visuals`, `audio`, `panel`, and `assets`.

| Setting | Meaning |
| --- | --- |
| `timing.initialWaitSeconds` | Wait before the first event after activation/resume (default 5 seconds) |
| `timing.jumpscareFirst` | Force the first event to be an animation (default false) |
| `timing.intervalMinSeconds`, `intervalMaxSeconds` | Random normal time between events |
| `timing.eventMinSeconds`, `eventMaxSeconds` | Still-image event time, including all fades |
| `visuals.flashSeconds`, `flashOpacity` | Opening white flash duration and opacity (0–255) |
| `visuals.flickerSeconds`, `flickerStepMs` | Opening flicker duration and darkness update interval |
| `visuals.flickerGapMinSeconds`, `flickerGapMaxSeconds` | Random clear gaps between repeated flicker bursts |
| `visuals.flickerBurstMinSeconds`, `flickerBurstMaxSeconds` | Duration of each repeated flicker burst |
| `visuals.blackoutSeconds`, `fadeBackSeconds` | Black screen, then return to desktop |
| `visuals.imageOpacity`, `animationFps` | Visual opacity (0–255) and frame rate (1–30) |
| `audio.enabled` | Allow audio |
| `audio.volume` | Per-track mpv volume (0–100) |
| `audio.systemVolumePercent` | System output volume set once by on/toggle-on (0–100; default 50) |
| `audio.fadeInSeconds`, `fadeOutSeconds` | Audio fades |
| `assets.directory` | Empty string for default media root, or an absolute path / `~/...` |
| `panel.textColor` | Top-bar circle/countdown color (`#RGB` or `#RRGGBB`; default `#ffffff`) |

Repeated dark flicker bursts continue throughout the image phase. Reduce the gap
settings for more frequent flickers; increase the burst settings for longer ones.
The final blackout and fade back remain smooth.

The installed config and media are re-read between events. Changes made directly
to the installed config take effect without deployment; edits to the repository
config require `./deploy.sh`. Toggle off/on to immediately start a new wait using
edited timing. Invalid config logs an error and retains the last good values.
Missing keys use defaults (5–50 seconds between events, 2–4 seconds per event).
Use the grouped config format shown in `config.json`. If you shorten still-image events, transition phases
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
python3 tests/volume.py
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
