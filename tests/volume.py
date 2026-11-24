#!/usr/bin/env python3
"""Check activation volume without touching the desktop or audio server."""
import contextlib
import io
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
CLI = runpy.run_path(str(ROOT / 'bin/fnaf-mode'))
GLOBALS = CLI['main'].__globals__


class ActivationVolumeTests(unittest.TestCase):
    def test_on_and_toggle_set_once_off_leaves_volume_alone(self):
        for command, active, count in [('on', False, 1), ('on', True, 1),
                                       ('toggle', False, 1), ('toggle', True, 0),
                                       ('off', True, 0)]:
            with self.subTest(command=command, active=active):
                volume = Mock()
                performance = Mock()
                def setting(*args):
                    if args[0] == 'get' and args[1] == CLI['SCHEMA']:
                        return str(active).lower()
                    return 'false'
                with patch.dict(GLOBALS, setting=setting, run=Mock(),
                                activation_volume=lambda: 37, set_output_volume=volume,
                                set_performance_profile=performance), \
                        patch('pathlib.Path.exists', return_value=True), \
                        patch('sys.argv', ['fnaf-mode', command]), \
                        contextlib.redirect_stdout(io.StringIO()):
                    CLI['main']()
                self.assertEqual(volume.call_count, count)
                self.assertEqual(performance.call_count, count)
                if count:
                    volume.assert_called_once_with(37)

    def test_config_default_override_and_validation(self):
        with tempfile.TemporaryDirectory(prefix='fnaf-volume-') as tmp:
            path = Path(tmp) / 'config.json'
            defaults = json.loads((ROOT / 'default.json').read_text())
            defaults['audio']['systemVolumePercent'] = 64
            defaults['assets']['directory'] = str(Path(tmp) / 'library')
            path.with_name('default.json').write_text(json.dumps(defaults))
            with patch.dict(GLOBALS, CONFIG=path):
                self.assertEqual(CLI['activation_volume'](), 64)
                self.assertEqual(CLI['asset_root'](), Path(tmp) / 'library')
                path.write_text('{}')
                self.assertEqual(CLI['activation_volume'](), 64)
                path.write_text('{"audio":{"enabled":false}}')
                self.assertEqual(CLI['activation_volume'](), 64)
                for value in [0, 35.5, 50, 100]:
                    path.write_text(json.dumps({'audio': {'systemVolumePercent': value}}))
                    self.assertEqual(CLI['activation_volume'](), value)
                for value in [-1, 101, True, '50', None, float('nan')]:
                    path.write_text(json.dumps({'audio': {'systemVolumePercent': value}}))
                    with self.assertRaises(ValueError):
                        CLI['activation_volume']()

    def test_wpctl_and_pactl_fallback(self):
        for backend, expected in [
            ('wpctl', ['/mock/wpctl', 'set-volume', '@DEFAULT_AUDIO_SINK@', '50%']),
            ('pactl', ['/mock/pactl', 'set-sink-volume', '@DEFAULT_SINK@', '50%']),
        ]:
            with self.subTest(backend=backend):
                execute = Mock()
                with patch.dict(GLOBALS, run=execute), \
                        patch('shutil.which', side_effect=lambda tool: f'/mock/{tool}' if tool == backend else None):
                    CLI['set_output_volume'](50)
                execute.assert_called_once_with(expected, capture_output=True)

    def test_volume_failure_does_not_activate_mode(self):
        settings = Mock(return_value='false')
        with patch.dict(GLOBALS, setting=settings, run=Mock(), activation_volume=lambda: 50,
                        set_performance_profile=Mock(),
                        set_output_volume=Mock(side_effect=ValueError('Audio unavailable'))), \
                patch('pathlib.Path.exists', return_value=True), \
                patch('sys.argv', ['fnaf-mode', 'on']):
            with self.assertRaisesRegex(ValueError, 'Audio unavailable'):
                CLI['main']()
        self.assertFalse(any(call.args[0] == 'set' for call in settings.call_args_list))

    def test_backend_failure_is_explained(self):
        error = subprocess.CalledProcessError(1, ['wpctl'], stderr='No default sink')
        with patch.dict(GLOBALS, run=Mock(side_effect=error)), \
                patch('shutil.which', return_value='/mock/wpctl'):
            with self.assertRaisesRegex(ValueError, 'No default sink'):
                CLI['set_output_volume'](50)

    def test_performance_command_and_failures(self):
        execute = Mock()
        with patch.dict(GLOBALS, run=execute), patch('shutil.which', return_value='/mock/powerprofilesctl'):
            CLI['set_performance_profile']()
        execute.assert_called_once_with(['/mock/powerprofilesctl', 'set', 'performance'], capture_output=True)
        with patch('shutil.which', return_value=None):
            with self.assertRaisesRegex(ValueError, 'requires powerprofilesctl'):
                CLI['set_performance_profile']()
        error = subprocess.CalledProcessError(1, ['powerprofilesctl'], stderr='Performance unavailable')
        with patch.dict(GLOBALS, run=Mock(side_effect=error)), \
                patch('shutil.which', return_value='/mock/powerprofilesctl'):
            with self.assertRaisesRegex(ValueError, 'Performance unavailable'):
                CLI['set_performance_profile']()

    def test_performance_failure_does_not_activate_mode(self):
        settings, volume = Mock(return_value='false'), Mock()
        with patch.dict(GLOBALS, setting=settings, run=Mock(), activation_volume=lambda: 50,
                        set_output_volume=volume,
                        set_performance_profile=Mock(side_effect=ValueError('Performance unavailable'))), \
                patch('pathlib.Path.exists', return_value=True), \
                patch('sys.argv', ['fnaf-mode', 'on']):
            with self.assertRaisesRegex(ValueError, 'Performance unavailable'):
                CLI['main']()
        volume.assert_not_called()
        self.assertFalse(any(call.args[0] == 'set' for call in settings.call_args_list))


if __name__ == '__main__':
    unittest.main()
