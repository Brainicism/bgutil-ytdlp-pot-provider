import json
import subprocess
import os.path
import shutil
from yt_dlp import YoutubeDL

from yt_dlp.networking.exceptions import RequestError, UnsupportedRequest
from yt_dlp.utils import Popen, classproperty
from yt_dlp_plugins.extractor.getpot import GetPOTProvider, register_provider, register_preference
from yt_dlp_plugins.extractor.getpot_bgutil import __version__


@register_provider
class BgUtilScriptPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilScriptPot'
    _SUPPORTED_CLIENTS = ('web_creator', 'web', 'web_embedded', 'web_music')
    VERSION = __version__

    @classproperty(cache=True)
    def _default_script_path(self):
        home = os.path.expanduser('~')
        return os.path.join(
            home, 'bgutil-ytdlp-pot-provider', 'server', 'build', 'generate_once.js')

    def _validate_get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs):
        script_path = ydl.get_info_extractor('Youtube')._configuration_arg(
            'getpot_bgutil_script', [self._default_script_path], casesense=True)[0]
        if not data_sync_id and not visitor_data:
            raise UnsupportedRequest(
                'One of [data_sync_id, visitor_data] must be passed')
        if not os.path.isfile(script_path):
            raise UnsupportedRequest(
                f"Script path doesn't exist: {script_path}")
        if os.path.basename(script_path) != 'generate_once.js':
            raise UnsupportedRequest(
                'Incorrect script passed to extractor args. Path to generate_once.js required')
        if shutil.which('node') is None:
            raise UnsupportedRequest('node is not in PATH')
        self.script_path = script_path

    def _get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs) -> str:
        self._logger.info(
            f'Generating POT via script: {self.script_path}')

        command_args = ['node', self.script_path]
        if data_sync_id:
            command_args.extend(['-d', data_sync_id])
        elif visitor_data:
            command_args.extend(['-v', visitor_data])
        else:
            raise RequestError(
                'Unexpected missing visitorData and dataSyncId in _get_pot_via_script')
        self._logger.debug(
            f'Executing command to get POT via script: {" ".join(command_args)}')

        try:
            stdout, stderr, returncode = Popen.run(
                command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except Exception as e:
            raise RequestError(
                f'_get_pot_via_script failed: Unable to run script (caused by {str(e)})') from e

        self._logger.debug(f'stdout = {stdout}')
        if returncode:
            raise RequestError(
                f'_get_pot_via_script failed with returncode {returncode}:\n{stderr.strip()}')

        # The JSON response is always the last line
        script_data_resp = stdout.splitlines()[-1]
        self._logger.debug(
            f'_get_pot_via_script response = {script_data_resp}')
        try:
            return json.loads(script_data_resp)['poToken']
        except (json.JSONDecodeError, TypeError, KeyError) as e:
            raise RequestError(
                f'Error parsing JSON response from _get_pot_via_script (caused by {str(e)})') from e


@register_preference(BgUtilScriptPotProviderRH)
def bgutil_script_getpot_preference(rh, request):
    return 100
