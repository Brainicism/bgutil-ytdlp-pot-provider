from __future__ import annotations

import json
import typing

if typing.TYPE_CHECKING:
    from yt_dlp import YoutubeDL

from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import HTTPError, RequestError, TransportError

try:
    from yt_dlp_plugins.extractor.getpot_bgutil import BgUtilBaseGetPOTRH, getpot
except ImportError:
    pass
else:
    @getpot.register_provider
    class BgUtilHTTPGetPOTRH(BgUtilBaseGetPOTRH):
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
            base_url = self._get_config_setting(
                'getpot_bgutil_baseurl', default='http://127.0.0.1:4416')
            try:
                response = json.load(ydl.urlopen(Request(
                    f'{base_url}/ping', extensions={'timeout': self._GET_VSN_TIMEOUT}, proxies={'all': None})))
            except TransportError as e:
                # the server may be down
                script_path_provided = self._get_config_setting(
                    'getpot_bgutil_script', default=None) is not None
                warning_base = f'Error reaching GET {base_url}/ping (caused by {e.__class__.__name__}). '
                if script_path_provided:  # server down is expected, log info
                    self._info_and_raise(warning_base + 'This is expected if you are using the script method.')
                else:
                    self._warn_and_raise(warning_base + f'Please make sure that the server is reachable at {base_url}.')
            except HTTPError as e:
                # may be an old server, don't raise
                self._logger.warning(
                    f'HTTP Error reaching GET /ping (caused by {e!r})', once=True)
            except json.JSONDecodeError as e:
                # invalid server
                self._warn_and_raise(
                    f'Error parsing ping response JSON (caused by {e!r})')
            except Exception as e:
                self._warn_and_raise(
                    f'Unknown error reaching GET /ping (caused by {e!r})', raise_from=e)
            else:
                self._check_version(response.get(
                    'version'), name='HTTP server')
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
            proxy = self._get_yt_proxy()

            try:
                response = ydl.urlopen(Request(
                    f'{self.base_url}/get_pot', data=json.dumps({
                        'client': client,
                        # keep compat with previous versions
                        'visitor_data': self.content_binding,
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

            po_token = response_json['po_token']
            self._logger.debug(f'Generated POT: {po_token}')
            return po_token

    @getpot.register_preference(BgUtilHTTPGetPOTRH)
    def bgutil_HTTP_getpot_preference(rh, request):
        return 0

    __all__ = [BgUtilHTTPGetPOTRH.__class__.__name__,
               bgutil_HTTP_getpot_preference.__name__]
