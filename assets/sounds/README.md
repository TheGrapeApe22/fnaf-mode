Keep all MP3 files here. ../audio_links.json selects the complete set of sounds
for each animation folder or still image. Every listed track starts together,
fading in and out. Include ambient tracks and any jumpscare track in the same list.
No extra random sounds are added. Duplicate names are played once.

Empty or omitted mappings are silent. Missing MP3s are skipped and logged. The
mapping is read before every event, so edits to the installed JSON apply next time.
If audio_links.json is absent, audio.minTracks / maxTracks control random selection
from this folder instead.

For an audible ending fade, use tracks at least as long as the event. Tracks never
loop. No audio is downloaded.
