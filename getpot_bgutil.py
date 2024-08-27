import json
from yt_dlp import YoutubeDL

from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import RequestError, UnsupportedRequest
from yt_dlp_plugins.extractor.getpot import GetPOTProvider, register_provider, register_preference


@register_provider
class BgUtilPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilPot'

    _SUPPORTED_CLIENTS = ('web_creator', 'web', 'web_embedded', 'web_music')

    def _validate_get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs):
        if data_sync_id:
            raise UnsupportedRequest('Fetching PO Token for accounts is not supported')

    def _get_pot(self, client: str, ydl: YoutubeDL, visitor_data=None, data_sync_id=None, player_url=None, **kwargs) -> str:
        response = ydl.urlopen(Request('http://127.0.0.1:8080/get_pot', data=json.dumps({
            'client': client,
            'visitor_data': visitor_data
        }).encode(), headers = {'Content-Type': 'application/json'}))

        response_json = json.loads(response.read().decode('utf-8'))

        if 'po_token' not in response_json:
            raise RequestError('Server did not respond with a po_token')

        self._logger.debug(f'Got PO Token: {response_json["po_token"]}')
        return response_json['po_token']
