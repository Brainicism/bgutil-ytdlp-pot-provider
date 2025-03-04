from __future__ import annotations

import json
import typing

if typing.TYPE_CHECKING:
    from yt_dlp import YoutubeDL

from yt_dlp.networking._helper import select_proxy
from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import RequestError

try:
    from yt_dlp_plugins.extractor.getpot_bgutil import BgUtilBaseGetPOTRH, getpot
except ImportError:
    pass
else:
    @getpot.register_provider
    class BgUtilHTTPGetPOTRH(BgUtilBaseGetPOTRH):
        def _validate_get_pot(
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
            base_url = ydl.get_info_extractor('Youtube')._configuration_arg(
                'getpot_bgutil_baseurl', ['http://127.0.0.1:4416'], casesense=True)[0]
            if not data_sync_id and not visitor_data:
                self.warn_and_raise(
                    'One of [data_sync_id, visitor_data] must be passed')
            try:
                response = ydl.urlopen(Request(
                    f'{base_url}/ping', extensions={'timeout': 5.0}, proxies={'all': None}))
            except Exception as e:
                self.warn_and_raise(
                    f'Error reaching GET /ping (caused by {e.__class__.__name__})', raise_from=e)
            try:
                response = json.load(response)
            except json.JSONDecodeError as e:
                self.warn_and_raise(
                    f'Error parsing response JSON (caused by {e!r})'
                    f', response: {response.read()}', raise_from=e)
            if response.get('version') != self.VERSION:
                self._logger.warning(
                    f'The provider plugin and the HTTP server are on different versions, '
                    f'this may cause compatibility issues. '
                    f'Please ensure they are on the same version. '
                    f'(plugin: {self.VERSION}, server: {response.get("version", "unknown")})',
                    once=True)
            self.base_url = base_url

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
            self._logger.info('Generating POT via HTTP server')
            if ((proxy := select_proxy('https://jnn-pa.googleapis.com', self.proxies))
                    != select_proxy('https://youtube.com', self.proxies)):
                self._logger.warning(
                    'Proxies for https://youtube.com and https://jnn-pa.googleapis.com are different. '
                    'This is likely to cause subsequent errors.')

            try:
                response = ydl.urlopen(Request(
                    f'{self.base_url}/get_pot', data=json.dumps({
                        'client': client,
                        'visitor_data': visitor_data,
                        'data_sync_id': data_sync_id,
                        'proxy': proxy,
                    }).encode(), headers={'Content-Type': 'application/json'},
                    extensions={'timeout': self._GETPOT_TIMEOUT}, proxies={'all': None}))
            except Exception as e:
                raise RequestError(
                    f'Error reaching POST /get_pot (caused by {e!r})') from e

            try:
                response_json = json.load(response)
            except Exception as e:
                raise RequestError(
                    f'Error parsing response JSON (caused by {e!r}). response = {response.read().decode()}') from e

            if error_msg := response_json.get('error'):
                raise RequestError(error_msg)
            if 'po_token' not in response_json:
                raise RequestError('Server did not respond with a po_token')

            return response_json['po_token']

    @getpot.register_preference(BgUtilHTTPGetPOTRH)
    def bgutil_HTTP_getpot_preference(rh, request):
        return 0

    __all__ = [BgUtilHTTPGetPOTRH.__class__.__name__, bgutil_HTTP_getpot_preference.__name__]
