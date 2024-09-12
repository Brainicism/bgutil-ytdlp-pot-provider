import json

from yt_dlp import YoutubeDL
from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import RequestError, UnsupportedRequest

from yt_dlp_plugins.extractor.getpot import GetPOTProvider, register_preference, register_provider
from yt_dlp_plugins.extractor.getpot_bgutil import __version__


@register_provider
class BgUtilHTTPPotProviderRH(GetPOTProvider):
    _PROVIDER_NAME = 'BgUtilHTTPPot'
    _SUPPORTED_CLIENTS = ('web', 'web_safari',
                          'web_embedded', 'web_music', 'web_creator')
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
            raise RequestError(
                f'Error reaching POST /get_pot (caused by {str(e)})') from e

        try:
            response_json = json.load(response)
        except Exception as e:
            raise RequestError(
                f'Error parsing response JSON (caused by {str(e)}). response = {response.read().decode()}') from e

        if error_msg := response_json.get('error'):
            raise RequestError(error_msg)
        if 'po_token' not in response_json:
            raise RequestError('Server did not respond with a po_token')

        return response_json['po_token']


@register_preference(BgUtilHTTPPotProviderRH)
def bgutil_HTTP_getpot_preference(rh, request):
    return 0
