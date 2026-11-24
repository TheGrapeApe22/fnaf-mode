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
# Update extension files, then mirror repository media into the installed library.
shutil.copytree(source / 'extension', dest, dirs_exist_ok=True,
                ignore=shutil.ignore_patterns('gschemas.compiled'))
subprocess.run(['glib-compile-schemas', '--strict', str(dest / 'schemas')], check=True)
assets = data / 'fnaf-mode/assets'
source_assets = source / 'assets'
if not source_assets.is_dir():
    raise SystemExit(f'Missing source assets directory: {source_assets}')
if (source_assets.resolve() == assets.resolve() or
        source_assets.resolve() in assets.resolve().parents or
        assets.resolve() in source_assets.resolve().parents):
    raise SystemExit('Source and installed assets directories must not overlap')

def remove_asset(path):
    # Never follow a destination symlink when deleting or replacing an entry.
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink()

def mirror_assets(src, dst):
    if dst.is_symlink() or (dst.exists() and not dst.is_dir()):
        remove_asset(dst)
    dst.mkdir(parents=True, exist_ok=True)
    entries = {item.name: item for item in src.iterdir()}
    for existing in dst.iterdir():
        if existing.name not in entries:
            remove_asset(existing)
    for name, item in entries.items():
        target = dst / name
        if item.is_symlink():
            if target.exists() or target.is_symlink():
                remove_asset(target)
            target.symlink_to(os.readlink(item))
        elif item.is_dir():
            mirror_assets(item, target)
        else:
            if target.is_symlink() or target.is_dir():
                remove_asset(target)
            shutil.copy2(item, target)

mirror_assets(source_assets, assets)
config.mkdir(parents=True, exist_ok=True)
for name in ['default.json', 'config.json']:
    shutil.copy2(source / name, config / name)
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
