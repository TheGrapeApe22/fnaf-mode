#!/usr/bin/env python3
"""Isolated installation and real audio decoding; never touches the live session."""
import array
import contextlib
import io
import json
import math
import os
import runpy
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def run(args, env=None):
    try:
        return subprocess.run([str(a) for a in args], cwd=ROOT, env=env,
                              check=True, text=True, capture_output=True)
    except subprocess.CalledProcessError as error:
        print(error.stdout or '')
        print(error.stderr or '')
        raise


cli_main = runpy.run_path(str(ROOT / 'bin/fnaf-mode'))['main']
for active, shell_state, expected, code in [
    (False, 'ACTIVE', 'FNAF mode OFF', 0),
    (True, 'ACTIVE', 'FNAF mode ON', 0),
    (True, 'ERROR', 'FNAF mode OFF (requested ON; GNOME extension state: ERROR)', 0),
    (True, None, 'FNAF mode UNKNOWN (requested ON); GNOME status unavailable', 1),
]:
    def shell_info(*args, **kwargs):
        if shell_state is None:
            raise subprocess.CalledProcessError(2, args[0])
        return subprocess.CompletedProcess(args[0], 0, stdout=f'  State: {shell_state}\n')
    output = io.StringIO()
    with patch.dict(cli_main.__globals__, run=shell_info, setting=lambda *a: str(active).lower()), \
            patch('pathlib.Path.exists', return_value=True), \
            patch('sys.argv', ['fnaf-mode', 'status']), contextlib.redirect_stdout(output):
        assert cli_main() == code
    assert output.getvalue().strip() == expected
print('PASS: CLI status reports ON, OFF, inactive extension and unavailable GNOME')


with tempfile.TemporaryDirectory(prefix='fnaf-integration-') as tmp:
    home = Path(tmp)
    env = dict(os.environ, HOME=tmp, XDG_DATA_HOME=str(home / 'data'),
               XDG_CONFIG_HOME=str(home / 'config'), GSETTINGS_BACKEND='memory')
    run(['bash', 'deploy.sh', '--no-enable'], env)
    command = home / '.local/bin/fnaf-mode'
    config = home / 'config/fnaf-mode/config.json'
    assets = home / 'data/fnaf-mode/assets'
    assert run([command, 'config'], env).stdout.strip() == str(config)
    assert run([command, 'assets'], env).stdout.strip() == str(assets)
    # Re-deployment replaces installed config while preserving original media.
    config.write_text('{"soundVolume": 17}')
    (assets / 'images/keep.png').write_bytes(b'personal media')
    run(['bash', 'deploy.sh', '--no-enable'], env)
    assert config.read_bytes() == (ROOT / 'config.json').read_bytes()
    assert (assets / 'images/keep.png').read_bytes() == b'personal media'
    print('PASS: isolated deployment, CLI paths, config overwrite, media preservation')
    custom_assets = home / 'custom media'
    config.write_text(json.dumps({'assets': {'directory': str(custom_assets)}}))
    assert run([command, 'assets'], env).stdout.strip() == str(custom_assets)
    shutil.copyfile(ROOT / 'config.json', config)

    ffmpeg, mpv = shutil.which('ffmpeg'), shutil.which('mpv')
    if not ffmpeg or not mpv:
        raise SystemExit('Integration checks require ffmpeg and mpv')
    # Also tests CLI conversion, including filenames containing shell punctuation.
    gif = home / 'input with spaces;$.gif'
    run([ffmpeg, '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=32x32:r=12:d=2',
         '-threads', '1', gif])
    run([command, 'import-gif', gif, 'converted-right'], env)
    assert len(list((assets / 'animations/converted-right/frames').glob('*.png'))) == 24
    duplicate = subprocess.run([str(command), 'import-gif', str(gif), 'converted-right'],
                               env=env, capture_output=True)
    assert duplicate.returncode != 0
    print('PASS: GIF decoding, frame import, refusal to overwrite')

    # A fake player captures the extension's exact arguments without making sound.
    fake_bin = home / 'bin'
    fake_bin.mkdir()
    capture = home / 'audio-argv.jsonl'
    player = fake_bin / 'mpv'
    player.write_text('#!/usr/bin/env python3\nimport json, os, sys, time\n'
                      'with open(os.environ["FNAF_AUDIO_CAPTURE"], "a") as f:\n'
                      '    f.write(json.dumps(sys.argv[1:]) + "\\n")\n'
                      'time.sleep(10)\n')
    player.chmod(0o755)
    env.update(PATH=str(fake_bin) + os.pathsep + os.environ['PATH'],
               FNAF_AUDIO_CAPTURE=str(capture))
    run([ffmpeg, '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
         assets / 'sounds/a.mp3'])
    shutil.copyfile(assets / 'sounds/a.mp3', assets / 'sounds/b.mp3')
    # Keep lifecycle selection deterministic even when the repo contains personal media.
    fixture_assets = home / 'fixture-assets'
    shutil.copytree(assets / 'animations/converted-right', fixture_assets / 'animations/converted-right')
    for folder in ['images', 'sounds']:
        (fixture_assets / folder).mkdir(parents=True)
    shutil.copyfile(next((fixture_assets / 'animations/converted-right/frames').glob('*.png')),
                    fixture_assets / 'images/plain.png')
    for name in ['a.mp3', 'b.mp3']:
        shutil.copyfile(assets / 'sounds' / name, fixture_assets / 'sounds' / name)
    associated = fixture_assets / 'animations/converted-right/FNAF 2 Jumpscare Sound.mp3'
    shutil.copyfile(assets / 'sounds/a.mp3', associated)
    config.write_text(json.dumps({'timing': {'intervalMinSeconds': 0.5, 'intervalMaxSeconds': 0.5,
                                           'eventMinSeconds': 2, 'eventMaxSeconds': 2},
                                 'audio': {'minTracks': 2, 'maxTracks': 2},
                                 'visuals': {'flashSeconds': 0, 'blackoutSeconds': 0, 'fadeBackSeconds': 0},
                                 'assets': {'directory': str(fixture_assets)}}))
    # Load the actual extension with just compositor-specific imports substituted.
    module = (ROOT / 'extension/extension.js').read_text()
    module = module.replace("import Clutter from 'gi://Clutter';", '')
    module = module.replace("import St from 'gi://St';", '')
    mocks = (ROOT / 'tests/shell-mocks.js').as_uri()
    module = module.replace("import * as Main from 'resource:///org/gnome/shell/ui/main.js';",
                            f"import * as Main from '{mocks}';\nimport {{St, Clutter}} from '{mocks}';")
    module = module.replace("'resource:///org/gnome/shell/extensions/extension.js'", repr(mocks))
    module = module.replace("'./core.js'", repr((ROOT / 'extension/core.js').as_uri()))
    test_module = home / 'extension-under-test.js'
    test_module.write_text(module)
    print(run(['gjs', '-m', 'tests/lifecycle.js', test_module.as_uri()], env).stdout.strip())
    argv = json.loads(capture.read_text().splitlines()[0])
    assert '--volume=45' in argv and '--length=2' in argv
    assert argv[-1] == str(associated), 'Animation uses its own MP3, not global random tracks'
    commands = [json.loads(line) for line in capture.read_text().splitlines()]
    assert any(Path(args[-1]).parent == fixture_assets / 'sounds' for args in commands), \
        'Still images keep random global audio fallback'
    output = home / 'render.wav'
    # Render captured mpv audio filters to disk, never to a sound device.
    run([mpv, '--ao=pcm', '--audio-format=s16', f'--ao-pcm-file={output}', *argv])
    with wave.open(str(output), 'rb') as wav:
        assert wav.getsampwidth() == 2
        rate, channels = wav.getframerate(), wav.getnchannels()
        samples = array.array('h', wav.readframes(wav.getnframes()))
    def rms(start, end):
        segment = samples[int(start * rate) * channels:int(end * rate) * channels]
        return math.sqrt(sum(s * s for s in segment) / len(segment))
    middle = rms(0.7, 1.0)
    assert middle > 0 and rms(0.0, 0.04) < middle * 0.2 and rms(1.95, 1.99) < middle * 0.2
    print('PASS: actual mpv arguments decode MP3 with audible middle and quiet fade endpoints')
