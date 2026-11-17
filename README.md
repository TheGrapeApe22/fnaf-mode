# FNAF Mode

A GNOME Shell 50 extension for Ubuntu 26.04 / Wayland. `fnaf-mode` toggles a
click-through overlay on the primary screen, including over fullscreen apps.
Your apps retain keyboard focus and mouse input.

Every **5–50 seconds of normal desktop time**, it runs a **2–4 second** event:
white flash → dark flicker → random still/looping frame animation → black → fade
back to desktop. A different visual is chosen each time when at least two exist.
One or two of your own MP3s start together and fade in/out. No images, GIFs,
sounds, or downloads are bundled. Nothing controls physical lights or brightness.

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
~/.local/bin/fnaf-mode       # toggle
~/.local/bin/fnaf-mode off   # immediately remove effects and stop audio
~/.local/bin/fnaf-mode status
```

If `~/.local/bin` is on your PATH, use just `fnaf-mode`. Otherwise add
`export PATH="$HOME/.local/bin:$PATH"` to `~/.bashrc`.

`deploy.sh --no-enable` installs files without asking GNOME to enable the
extension. The extension is initially inactive; once enabled, its on/off setting
persists across logins. Locking the session pauses effects; unlocking restarts the
normal random wait. Deploying again preserves your installed config and media.
GNOME caches extension modules, so disabling/re-enabling alone does not reliably
load code changes; log out/in after redeployment.

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
      frame-00001.png
      frame-00002.png
      ...
    jumpscare-two/
      001.webp
      002.webp
  sounds/
    static.mp3
    scream.mp3
```

Each still and each animation subfolder counts as one visual. Frames are sorted
naturally by filename and loop at `animationFps`. PNG, JPEG and WebP are supported.
Use reasonably sized frames (roughly your screen resolution) and short animations;
these are rendered inside GNOME Shell. Images are centered and fitted without
cropping. Transparent images reveal your desktop; opaque images cover it.
Hidden files/folders and symlinks are ignored. Personal media in this repository
is git-ignored. With no visuals, the extension waits silently for you to add some.
With no MP3s, events are silent.

GIFs must be converted to frame folders:

```sh
fnaf-mode import-gif ~/Downloads/mangle.gif mangle-jumpscare
# Optional rate (also set animationFps to the same value):
fnaf-mode import-gif ~/Downloads/another.gif another-jumpscare --fps 20
```

Import keeps your source GIF intact, refuses to overwrite an existing animation,
and caps output to 900 frames and 1280 pixels per dimension. GIF frame timing is
resampled to the selected fixed frame rate. Frames become visible to the extension
only after conversion completes. Direct GIF playback is not used.

Each event chooses one or two distinct MP3s from `sounds/`. Supply at least two
for simultaneous playback. Prefer tracks at least as long as `eventMaxSeconds` so
the fade-out happens during audible content. Shorter tracks are padded with
silence; longer tracks are faded and cut to the event duration. Volume is per
track, so two tracks together can be louder. No sound changes system volume.

## Adjust settings

```sh
fnaf-mode config   # print config path
fnaf-mode assets   # print media library path
```

Edit `~/.config/fnaf-mode/config.json`. The complete starting config is
[`config.example.json`](config.example.json). Key settings:

| Key | Default | Meaning |
| --- | --- | --- |
| `intervalMinSeconds`, `intervalMaxSeconds` | 5, 50 | Random normal time between events |
| `eventMinSeconds`, `eventMaxSeconds` | 2, 4 | Total event time, including all fades |
| `flashSeconds`, `flashOpacity` | 0.12, 180 | Opening white flash; opacity 0–255 |
| `flickerSeconds`, `flickerStepMs` | 0.45, 90 | Dark flicker duration and update interval |
| `blackoutSeconds`, `fadeBackSeconds` | 0.2, 0.65 | Black screen, then return to desktop |
| `imageOpacity`, `animationFps` | 255, 12 | Visual opacity and frame rate (1–30) |
| `soundEnabled` | true | Allow audio |
| `soundMinTracks`, `soundMaxTracks` | 1, 2 | Number of distinct MP3s (1–2) |
| `soundVolume` | 45 | Per-track mpv volume (0–100) |
| `soundFadeInSeconds`, `soundFadeOutSeconds` | 0.3, 0.65 | Audio fades |
| `assetDirectory` | `""` | Default media root; or absolute path / `~/...` |

The config and media are re-read between events; no deployment is needed for
changes. Toggle off/on to immediately start a new wait using edited timing.
An invalid config logs an error and retains the last good values. Missing keys use
defaults. If you shorten events, transition phases scale down to leave time for
the image. Set `flashOpacity` to 0 to suppress the white flash.

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
them in the Extensions app first. `status` prints the requested on/off setting
and GNOME's extension state so you can check that it actually loaded.

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
