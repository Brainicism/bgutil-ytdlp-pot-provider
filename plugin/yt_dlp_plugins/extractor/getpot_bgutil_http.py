from __future__ import annotations

import json
import time

from yt_dlp.extractor.youtube.pot.builtin.utils import get_webpo_content_binding
from yt_dlp.networking.common import Request
from yt_dlp.networking.exceptions import HTTPError, TransportError

try:
    from yt_dlp_plugins.extractor.getpot_bgutil import BgUtilPTPBase
except ImportError:
    pass

from yt_dlp.extractor.youtube.pot.provider import (
    PoTokenProviderError,
    PoTokenProviderRejectedRequest,
    PoTokenRequest,
    PoTokenResponse,
    register_preference,
    register_provider,
)


@register_provider
class BgUtilHTTPPTP(BgUtilPTPBase):

    PROVIDER_NAME = 'bgutil:http'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_server_check = 0
        self._server_available = True
        self.base_url = self.get_setting(
            'base_url', default=['http://127.0.0.1:4416'])[0]

    def _check_server_availability(self, ctx: PoTokenRequest):
        if self._last_server_check + 60 > time.time():
            return self._server_available

        self._last_server_check = time.time()
        try:
            self.logger.trace('Checking server availability')
            response = json.load(self._urlopen(ctx, Request(
                f'{self.base_url}/ping', extensions={'timeout': self._GET_VSN_TIMEOUT}, proxies={'all': None})))
        except TransportError as e:
            # the server may be down
            self._server_available = False
            self._warn_and_raise(
                f'Error reaching GET /ping (caused by {e.__class__.__name__})')
            return
        except HTTPError as e:
            # may be an old server, don't raise
            self._server_available = False
            self.logger.warning(
                f'HTTP Error reaching GET /ping (caused by {e!r})', once=True)
            return
        except json.JSONDecodeError as e:
            # invalid server
            self._server_available = False
            self._warn_and_raise(
                f'Error parsing ping response JSON (caused by {e!r})')
            return
        except Exception as e:
            self._server_available = False
            self._warn_and_raise(
                f'Unknown error reaching GET /ping (caused by {e!r})', raise_from=e)
            return

        self._check_version(response.get('version'), name='HTTP server')
        self._server_available = True
        return True

    def is_available(self):
        return self._server_available or self._last_server_check + 60 < int(time.time())

    def _real_request_pot(
        self,
        ctx: PoTokenRequest,
    ) -> PoTokenResponse:

        self.logger.debug('Generating POT via HTTP server')
        if not self._check_server_availability(ctx):
            raise PoTokenProviderRejectedRequest(
                f'{self.PROVIDER_NAME} server is not available')

        proxy = ctx.request_proxy

        try:
            response = self._urlopen(ctx, Request(
                f'{self.base_url}/get_pot', data=json.dumps({
                    'content_binding': get_webpo_content_binding(ctx)[0],
                    'proxy': proxy,
                }).encode(), headers={'Content-Type': 'application/json'},
                extensions={'timeout': self._GETPOT_TIMEOUT}, proxies={'all': None}))
        except Exception as e:
            raise PoTokenProviderError(
                f'Error reaching POST /get_pot (caused by {e!r})') from e

        try:
            response_json = json.load(response)
        except Exception as e:
            raise PoTokenProviderError(
                f'Error parsing response JSON (caused by {e!r}). response = {response.read().decode()}') from e

        if error_msg := response_json.get('error'):
            raise PoTokenProviderError(error_msg)
        if 'po_token' not in response_json:
            raise PoTokenProviderError(
                'Server did not respond with a po_token')

        po_token = response_json['po_token']
        self.logger.trace(f'Generated POT: {po_token}')
        return PoTokenResponse(po_token=po_token)


@register_preference(BgUtilHTTPPTP)
def bgutil_HTTP_getpot_preference(provider, request):
    return 1


__all__ = [BgUtilHTTPPTP.__class__.__name__,
           bgutil_HTTP_getpot_preference.__name__]
