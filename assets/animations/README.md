Make a subfolder for each animation, with PNG/JPG/WebP frames inside:

mangle-jumpscare/
  frame-00001.png
  frame-00002.png
  ...

Frames sort naturally by filename and loop at visuals.animationFps (default 12).
Hidden folders are ignored. Keep images at reasonable sizes; the shell renders them.
For GIFs use: fnaf-mode import-gif /path/to/jumpscare.gif mangle-jumpscare
