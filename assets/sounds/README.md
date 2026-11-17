Put your own MP3 files here for global event audio. Every event chooses one or two
distinct files (according to audio.minTracks / maxTracks) and starts them together,
fading in and out. An animation's associated MP3 plays in addition to these tracks.
With two global tracks and an associated MP3, all three play together.

For an animation-specific sound, put an MP3 next to that animation's frames/ folder.
audio.mp3 is preferred, but other filenames work too.

For a complete fade envelope, use tracks at least as long as the event (animation
playback plus ending, or timing.eventMaxSeconds for a still image). Tracks never
loop. No audio is downloaded.
