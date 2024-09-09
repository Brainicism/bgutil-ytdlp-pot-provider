import json
import subprocess
import os.path
import shutil
from os.path import expanduser
from yt_dlp import YoutubeDL

from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import RequestError, UnsupportedRequest
from yt_dlp.utils import Popen
from yt_dlp_plugins.extractor.getpot import GetPOTProvider, register_provider


@register_provider
class BgUtilPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilPot'
    _SUPPORTED_CLIENTS = ('web_creator', 'web', 'web_embedded', 'web_music')

    def _validate_get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs):
        if not data_sync_id and not visitor_data:
            raise UnsupportedRequest('One of [data_sync_id, visitor_data] must be passed')

    def _get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs) -> str:
        generate_pot_script_path = ydl.get_info_extractor('Youtube')._configuration_arg('getpot_bgutil_script', [None], casesense=True)[0]
        http_base_url = ydl.get_info_extractor('Youtube')._configuration_arg('getpot_bgutil_baseurl', ['http://127.0.0.1:4416'], casesense=True)[0]
        self._logger.info(f'Generating POT via script: {generate_pot_script_path}')
        po_token = self._get_pot_via_script(generate_pot_script_path, visitor_data, data_sync_id)
        
        if not po_token:
            self._logger.info('Generating POT via HTTP server')
            po_token = self._get_pot_via_http(ydl, client, visitor_data, data_sync_id, http_base_url)

        return po_token

    def _get_pot_via_http(self, ydl, client, visitor_data, data_sync_id, base_url):
        try:
            response = ydl.urlopen(Request('http://127.0.0.1:4416/get_pot', data=json.dumps({
                'client': client,
                'visitor_data': visitor_data,
                'data_sync_id': data_sync_id
            }).encode(), headers={'Content-Type': 'application/json'}))
        except Exception as e:
            raise RequestError(f'Error reaching POST /get_pot: {str(e)}')

        try:
            response_json = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            raise RequestError(f'Error parsing response JSON. response = {response.read().decode("utf-8")}', cause=e)

        if error_msg := response_json.get('error'):
            raise RequestError(error_msg)
        if 'po_token' not in response_json:
            raise RequestError('Server did not respond with a po_token')

        return response_json['po_token']

    def _get_pot_via_script(self, script_path, visitor_data, data_sync_id):
        if not script_path:
            script_path = os.path.join(expanduser("~"), "bgutils-ytdlp-pot-provider/server/build/generate_once.js")
            self._logger.debug(f"Script path was not provided, trying default: {script_path}")
        if not os.path.isfile(script_path):
            self._logger.warn(f"Script path doesn't exist: {script_path}")
            return None
        if os.path.basename(script_path) != 'generate_once.js':
            self._logger.warn(f'Incorrect script passed to extractor args. Path to generate_once.js required')
            return None
        if shutil.which('node') is None:
            self._logger.warn(f'node is not in PATH')
            return None

        # possibly vulnerable to shell injection here? but risk is low
        command_args = ['node', script_path]
        if data_sync_id:
            command_args.extend(['-d', data_sync_id])
        elif visitor_data:
            command_args.extend(['-v', visitor_data])
        else:
            self._logger.warn('Unexpected missing visitorData/dataSyncId in _get_pot_via_script')
            return None

        self._logger.debug(f'Executing command to get POT via script: {" ".join(command_args)}')

        try:
            stdout, stderr, returncode = Popen.run(
                command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except Exception as e:
            self._logger.warn(f'_get_pot_via_script failed: Unable to run script. cause = {str(e)}')
            return None

        self._logger.debug(f'stdout = {stdout}')
        if returncode:
            self._logger.warn(f'_get_pot_via_script failed with returncode {returncode}:\n{stderr.strip()}')
            return None

        # the JSON response is always the last line
        script_data_resp = stdout.splitlines()[-1]
        self._logger.debug(f'_get_pot_via_script response = {script_data_resp}')
        try:
            return json.loads(script_data_resp)['poToken']
        except (json.JSONDecodeError, TypeError, KeyError) as e:
            self._logger.warn(f'Error parsing JSON response from _get_pot_via_script. cause = {str(e)}')
