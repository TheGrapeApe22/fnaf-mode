#!/usr/bin/env bash
# Per-user install. No sudo, desktop restart, or media downloads.
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for tool in python3 glib-compile-schemas gnome-extensions gsettings; do
    if ! command -v "$tool" >/dev/null; then
        printf 'Missing dependency: %s\n' "$tool" >&2
        exit 1
    fi
done
if [[ "${1:-}" != "" && "${1:-}" != "--no-enable" ]]; then
    printf 'Usage: %s [--no-enable]\n' "$0" >&2
    exit 1
fi
export FNAF_SOURCE_DIR="$source_dir"
python3 - <<'PY'
import os
from pathlib import Path
import shutil
import subprocess

source = Path(os.environ['FNAF_SOURCE_DIR'])
data = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share'))
config = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config')) / 'fnaf-mode'
dest = data / 'gnome-shell/extensions/fnaf-mode@local'
bin_dir = Path.home() / '.local/bin'
# Merge directories; preserve existing media files.
shutil.copytree(source / 'extension', dest, dirs_exist_ok=True,
                ignore=shutil.ignore_patterns('gschemas.compiled'))
subprocess.run(['glib-compile-schemas', '--strict', str(dest / 'schemas')], check=True)
assets = data / 'fnaf-mode/assets'
for item in (source / 'assets').rglob('*'):
    target = assets / item.relative_to(source / 'assets')
    if item.is_dir():
        target.mkdir(parents=True, exist_ok=True)
    elif not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
config.mkdir(parents=True, exist_ok=True)
shutil.copy2(source / 'config.json', config / 'config.json')
bin_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(source / 'bin/fnaf-mode', bin_dir / 'fnaf-mode')
(bin_dir / 'fnaf-mode').chmod(0o755)
print(f'Extension: {dest}\nConfig:    {config / "config.json"}\nMedia:     {assets}\nCommand:   {bin_dir / "fnaf-mode"}')
PY
if ! command -v mpv >/dev/null; then
    printf '\nFor MP3 playback, install mpv: sudo apt install mpv\n'
fi
if [[ "${1:-}" != "--no-enable" ]]; then
    if ! gnome-extensions enable fnaf-mode@local; then
        printf '\nFiles installed. GNOME may need a logout/login to discover the extension.\n'
    fi
fi
printf '\nOn Wayland, log out and back in after first install or extension code updates.\n'
printf 'Then run: ~/.local/bin/fnaf-mode on\n'
printf 'If fnaf-mode is not on PATH, add: export PATH="$HOME/.local/bin:$PATH"\n'
