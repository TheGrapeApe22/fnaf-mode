Make one folder per jumpscare. Frames can be directly inside it:

mangle_jumpscare_1/
  frame-00001.gif
  frame-00002.gif

Or in a frames/ subfolder (the layout created by import-gif):

mangle_jumpscare_2/
  frames/
    frame-00001.png
    frame-00002.png

Frames play ONCE in natural filename order at visuals.animationFps (default 12).
PNG, JPEG, WebP and individual GIF frames are supported. Filename delay hints are
ignored; playback speed comes from the configured frame rate. A frames/ subfolder
takes precedence over root-level frames.

All audio belongs in ../sounds/. In ../audio_links.json, map this animation's
folder name under "animations" to its complete sound list. Every listed track
plays together: include both ambient tracks and the jumpscare track. No extra
random tracks are added. MP3s inside animation folders are not used.

After the opening flash, the animation and all linked sounds start together.
After the last frame, the screen goes black and fades back; audio fades out with
that ending. Animation duration comes from frame count / FPS plus the transitions.

For GIF imports: fnaf-mode import-gif /path/to/jumpscare.gif mangle-jumpscare
Then add "mangle-jumpscare" to the "animations" section in ../audio_links.json.

Folder names containing top/bottom/left/right set screen alignment. Individual
frame names can override those hints; center/centre resets alignment to center.
