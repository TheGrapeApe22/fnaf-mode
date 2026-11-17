Make one folder per jumpscare:

mangle-bottom-left/
  frames/
    frame-00001.png
    frame-00002.png
    ...
  audio.mp3

Frames sort naturally by filename and play ONCE at visuals.animationFps (default
12). PNG, JPEG, WebP and individual GIF frame files are supported. Filename delay
hints are ignored; playback speed comes from the configured frame rate.

The first animation frame and its associated MP3 start together after the opening
flash. After the last frame, the screen goes black and fades back to desktop;
audio fades out with that ending. The configured event duration applies only to
still images; animations use frame count / FPS plus the opening/ending effects.

An MP3 with any filename works; audio.mp3 takes priority if several are present.
Use one MP3 per folder. The local MP3 plays alongside the global sounds/ tracks, not in their place.
Without a local MP3, the global tracks still play.
Older folders with frames directly in the animation folder still work. A frames/
subfolder takes precedence over root-level frame files.

Hidden folders are ignored. Keep images at reasonable sizes; the shell renders them.
For GIF imports: fnaf-mode import-gif /path/to/jumpscare.gif mangle-jumpscare
This creates mangle-jumpscare/frames/; add your MP3 next to frames/ afterward.

Folder names with top/bottom/left/right provide screen alignment, e.g.
mangle-bottom-left/. Frame filenames can override the folder's alignment hints.
Use center/centre in a frame filename to reset alignment to the center.
