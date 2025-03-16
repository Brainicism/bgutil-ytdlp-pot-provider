from __future__ import annotations

import json
import os.path
import shutil
import subprocess
import typing

if typing.TYPE_CHECKING:
    from yt_dlp import YoutubeDL
from yt_dlp.networking.exceptions import RequestError
from yt_dlp.utils import Popen, classproperty

try:
    from yt_dlp_plugins.extractor.getpot_bgutil import BgUtilBaseGetPOTRH, getpot
except ImportError:
    pass
else:
    @getpot.register_provider
    class BgUtilScriptGetPOTRH(BgUtilBaseGetPOTRH):
        @classproperty(cache=True)
        def _default_script_path(self):
            home = os.path.expanduser('~')
            return os.path.join(
                home, 'bgutil-ytdlp-pot-provider', 'server', 'build', 'generate_once.js')

        def _check_script_version(self, node_path, script_path):
            stdout, stderr, returncode = Popen.run(
                [node_path, script_path, '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                timeout=self._GET_VSN_TIMEOUT)
            if returncode:
                self._logger.warning(
                    f'Failed to check script version. '
                    f'Script returned {returncode} exit status. '
                    f'Script stdout: {stdout}; Script stderr: {stderr}',
                    once=True)
            else:
                self._check_version(stdout.strip(), name='script')

        def _real_validate_get_pot(
            self,
            client: str,
            ydl: YoutubeDL,
            visitor_data=None,
            data_sync_id=None,
            session_index=None,
            player_url=None,
            context=None,
            video_id=None,
            ytcfg=None,
            **kwargs,
        ):
            # validate script
            script_path = self._get_config_setting(
                'getpot_bgutil_script', default=self._default_script_path)
            if not os.path.isfile(script_path):
                self._warn_and_raise(
                    f"Script path doesn't exist: {script_path}")
            if os.path.basename(script_path) != 'generate_once.js':
                self._warn_and_raise(
                    'Incorrect script passed to extractor args. Path to generate_once.js required')
            if (node_path := shutil.which('node')) is None:
                self._warn_and_raise('node is not in PATH')
            self._check_script_version(node_path, script_path)
            self.script_path = script_path
            self.node_path = node_path

        def _get_pot(
            self,
            client: str,
            ydl: YoutubeDL,
            visitor_data=None,
            data_sync_id=None,
            session_index=None,
            player_url=None,
            context=None,
            video_id=None,
            ytcfg=None,
            **kwargs,
        ) -> str:
            self._logger.info(
                f'Generating POT via script: {self.script_path}')
            command_args = [self.node_path, self.script_path]
            if proxy := self._get_yt_proxy():
                command_args.extend(['-p', proxy])
            # keep compat with previous versions
            if self.content_binding is not None:
                command_args.extend(['-v', self.content_binding])
            self._logger.debug(
                f'Executing command to get POT via script: {" ".join(command_args)}')

            try:
                stdout, stderr, returncode = Popen.run(
                    command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                    timeout=self._GETPOT_TIMEOUT)
            except subprocess.TimeoutExpired as e:
                raise RequestError(
                    f'_get_pot_via_script failed: Timeout expired when trying to run script (caused by {e!r})')
            except Exception as e:
                raise RequestError(
                    f'_get_pot_via_script failed: Unable to run script (caused by {e!r})') from e

            msg = f'stdout:\n{stdout.strip()}'
            if stderr.strip():  # Empty strings are falsy
                msg += f'\nstderr:\n{stderr.strip()}'
            self._logger.debug(msg)
            if returncode:
                raise RequestError(
                    f'_get_pot_via_script failed with returncode {returncode}')

            try:
                # The JSON response is always the last line
                script_data_resp = json.loads(stdout.splitlines()[-1])
            except json.JSONDecodeError as e:
                raise RequestError(
                    f'Error parsing JSON response from _get_pot_via_script (caused by {e!r})') from e
            if 'poToken' not in script_data_resp:
                raise RequestError(
                    'The script did not respond with a po_token')
            return script_data_resp['poToken']

    @getpot.register_preference(BgUtilScriptGetPOTRH)
    def bgutil_script_getpot_preference(rh, request):
        return 100

    __all__ = [BgUtilScriptGetPOTRH.__class__.__name__,
               bgutil_script_getpot_preference.__name__]
