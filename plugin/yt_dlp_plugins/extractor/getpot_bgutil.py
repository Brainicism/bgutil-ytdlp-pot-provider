import json
import subprocess
from yt_dlp import YoutubeDL

from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import RequestError, UnsupportedRequest
from yt_dlp_plugins.extractor.getpot import GetPOTProvider, register_provider, register_preference


@register_provider
class BgUtilPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilPot'
    _SUPPORTED_CLIENTS = ('web_creator', 'web', 'web_embedded', 'web_music')

    def _validate_get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs):
        if not data_sync_id and not visitor_data:
            raise UnsupportedRequest('One of [data_sync_id, visitor_data] must be passed')

    def _get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs) -> str:
        generate_pot_script_path = ydl.get_info_extractor('Youtube')._configuration_arg('getpot_bgutil_script', [None], casesense=True)[0]
        if generate_pot_script_path:
            self._logger.info(f"Generating POT via script: {generate_pot_script_path}")
            po_token = self._get_pot_via_script(generate_pot_script_path, visitor_data, data_sync_id)
            return po_token
        else:
            self._logger.info(f"Generating POT via HTTP server")
            po_token = self._get_pot_via_http(ydl, client, visitor_data, data_sync_id)

        return po_token
    
    def _get_pot_via_http(self, ydl, client, visitor_data, data_sync_id):
        response = ydl.urlopen(Request('http://127.0.0.1:4416/get_pot', data=json.dumps({
            'client': client,
            'visitor_data': visitor_data,
            'data_sync_id': data_sync_id
        }).encode(), headers = {'Content-Type': 'application/json'}))

        response_json = json.loads(response.read().decode('utf-8'))

        if 'po_token' not in response_json:
            raise RequestError('Server did not respond with a po_token')

        return response_json["po_token"]

    def _get_pot_via_script(self, script_path, visitor_data, data_sync_id):
        # possibly vulnerable to shell injection here? but risk is low
        command_args = ['node', script_path]
        if data_sync_id:
            command_args.extend(["-d", data_sync_id])
        elif visitor_data:
            command_args.extend(["-v", visitor_data])
        else:
            raise RequestError("Unexpected missing visitorData/dataSyncId in _get_pot_via_script")
        self._logger.debug(f"Executing command to get POT via script: {' '.join(command_args)}")

        result = subprocess.run(command_args,stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        self._logger.debug(f"stdout = {result.stdout}")
        if result.stderr or result.returncode != 0:
            raise RequestError(f"_get_pot_via_script failed with return code {result.returncode}. stderr = {result.stderr}")
        
        script_data_resp = result.stdout.splitlines()[-1]
        self._logger.debug(f"_get_pot_via_script response = {script_data_resp}")
        response = json.loads(script_data_resp)
        return response['poToken']
