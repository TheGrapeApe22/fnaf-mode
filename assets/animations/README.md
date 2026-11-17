Make a subfolder for each animation, with PNG/JPG/WebP frames inside:

mangle-jumpscare/
  frame-00001.png
  frame-00002.png
  ...

Frames sort naturally by filename and loop at visuals.animationFps (default 12).
Hidden folders are ignored. Keep images at reasonable sizes; the shell renders them.
For GIFs use: fnaf-mode import-gif /path/to/jumpscare.gif mangle-jumpscare
Name the folder with top/bottom/left/right for screen alignment, e.g.
mangle-bottom-left/. Frame filenames can override the folder's alignment hints.
Use center/centre in a frame filename to reset alignment to the center.
