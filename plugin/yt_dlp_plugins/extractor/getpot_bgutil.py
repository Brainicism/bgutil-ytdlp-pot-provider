import json
import subprocess
import os.path
import shutil
from yt_dlp import YoutubeDL

from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import RequestError, UnsupportedRequest
from yt_dlp.utils import Popen
from yt_dlp_plugins.extractor.getpot import GetPOTProvider, register_provider, register_preference


__version__ = '0.4.0'


@register_provider
class BgUtilScriptPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilScriptPot'
    _SUPPORTED_CLIENTS = ('web_creator', 'web', 'web_embedded', 'web_music')
    VERSION = __version__

    def _validate_get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs):
        script_path = ydl.get_info_extractor('Youtube')._configuration_arg(
            'getpot_bgutil_script', [None], casesense=True)[0]
        # TODO: Add default script path
        if not data_sync_id and not visitor_data:
            raise UnsupportedRequest(
                'One of [data_sync_id, visitor_data] must be passed')
        if not os.path.isfile(script_path):
            raise RequestError(f"Script path doesn't exist: {script_path}")
        if os.path.basename(script_path) != 'generate_once.js':
            raise RequestError(
                'Incorrect script passed to extractor args. Path to generate_once.js required')
        if shutil.which('node') is None:
            raise RequestError('node is not in PATH')
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
            # After invoking _validate_get_pot, do we still need this?
        self._logger.debug(
            f'Executing command to get POT via script: {" ".join(command_args)}')

        try:
            stdout, stderr, returncode = Popen.run(
                command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except Exception as e:
            raise RequestError(
                f'_get_pot_via_script failed: Unable to run script (caused by {str(e)})')

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
                f'Error parsing JSON response from _get_pot_via_script (caused by {str(e)})')

@register_preference(BgUtilScriptPotProviderRH)
def bgutil_script_getpot_peference(rh, request):
    return 100

@register_provider
class BgUtilHTTPPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilHTTPPot'
    _SUPPORTED_CLIENTS = ('web_creator', 'web', 'web_embedded', 'web_music')
    VERSION = __version__

    def _validate_get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs):
        base_url = ydl.get_info_extractor('Youtube')._configuration_arg(
            'getpot_bgutil_baseurl', ['http://127.0.0.1:4416'], casesense=True)[0]
        if not data_sync_id and not visitor_data:
            raise UnsupportedRequest(
                'One of [data_sync_id, visitor_data] must be passed')
        # TODO: Ping the server
        self.base_url = base_url

    def _get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs) -> str:
        self._logger.info('Generating POT via HTTP server')

        try:
            response = ydl.urlopen(Request(f'{self.base_url}/get_pot', data=json.dumps({
                'client': client,
                'visitor_data': visitor_data,
                'data_sync_id': data_sync_id,
            }).encode(), headers={'Content-Type': 'application/json'}))
        except Exception as e:
            raise RequestError(f'Error reaching POST /get_pot: {str(e)}')

        try:
            response_json = json.load(response)
        except Exception as e:
            raise RequestError(
                f'Error parsing response JSON (caused by {str(e)}). response = {response.read().decode()}')

        if error_msg := response_json.get('error'):
            raise RequestError(error_msg)
        if 'po_token' not in response_json:
            raise RequestError('Server did not respond with a po_token')
            # Should we return None here?

        return response_json['po_token']

@register_preference(BgUtilHTTPPotProviderRH)
def bgutil_HTTP_getpot_peference(rh, request):
    return 0
