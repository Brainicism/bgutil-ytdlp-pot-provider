from __future__ import annotations

__version__ = '1.1.0'

import abc
import json

from yt_dlp.extractor.youtube.pot.provider import (
    ExternalRequestFeature,
    PoTokenContext,
    PoTokenProvider,
    PoTokenProviderRejectedRequest,
    PoTokenRequest,
)
from yt_dlp.extractor.youtube.pot.utils import WEBPO_CLIENTS
from yt_dlp.networking.common import Request


class BgUtilPTPBase(PoTokenProvider, abc.ABC):
    PROVIDER_VERSION = __version__
    BUG_REPORT_LOCATION = 'https://github.com/Brainicism/bgutil-ytdlp-pot-provider/issues'
    _SUPPORTED_EXTERNAL_REQUEST_FEATURES = (
        ExternalRequestFeature.PROXY_SCHEME_HTTP,
        ExternalRequestFeature.PROXY_SCHEME_HTTPS,
        ExternalRequestFeature.PROXY_SCHEME_SOCKS4,
        ExternalRequestFeature.PROXY_SCHEME_SOCKS4A,
        ExternalRequestFeature.PROXY_SCHEME_SOCKS5,
        ExternalRequestFeature.PROXY_SCHEME_SOCKS5H,
        ExternalRequestFeature.SOURCE_ADDRESS,
        ExternalRequestFeature.DISABLE_TLS_VERIFICATION,
    )
    _SUPPORTED_CLIENTS = WEBPO_CLIENTS
    _SUPPORTED_CONTEXTS = (
        PoTokenContext.GVS,
        PoTokenContext.PLAYER,
        PoTokenContext.SUBS,
    )
    _GETPOT_TIMEOUT = 20.0
    _GET_SERVER_VSN_TIMEOUT = 5.0
    _MIN_NODE_VSN = (18, 0, 0)
    _ATT_GET_URL = 'https://www.youtube.com/youtubei/v1/att/get?prettyPrint=false'

    def _info_and_raise(self, msg, raise_from=None):
        self.logger.info(msg)
        raise PoTokenProviderRejectedRequest(msg) from raise_from

    def _warn_and_raise(self, msg, once=True, raise_from=None):
        self.logger.warning(msg, once=once)
        raise PoTokenProviderRejectedRequest(msg) from raise_from

    def _check_version(self, got_version, *, default='unknown', name):
        def _major(version):
            return version.split('.', 1)[0]
        if got_version != self.PROVIDER_VERSION:
            self.logger.warning(
                f'The provider plugin and the {name} are on different versions, '
                f'this may cause compatibility issues. '
                f'Please ensure they are on the same version. '
                f'Otherwise, help will NOT be provided for any issues that arise. '
                f'(plugin: {self.PROVIDER_VERSION}, {name}: {got_version or default})',
                once=True)
        if not got_version or _major(got_version) != _major(self.PROVIDER_VERSION):
            self._warn_and_raise(
                f'Plugin and {name} major versions are mismatched. '
                f'Update both the plugin and the {name} to the same version to proceed.')

    def _get_attestation(self, request: PoTokenRequest):
        raw_challenge_data = self.ie._search_regex(
            r'''(?sx)window\.ytAtR\s*=\s*(?P<raw_cd>(?P<q>['"])
                (?:
                    \\.|
                    (?!(?P=q)).
                )*
            (?P=q))\s*;''',
            request.video_webpage, 'raw challenge data', default=None, group='raw_cd')
        if raw_challenge_data:
            return {'raw_challenge': raw_challenge_data}
        else:
            self.logger.warning('Failed to extract initial attestation from the webpage, falling back to Innertube endpoint')
        with self._request_webpage(Request(
                self._ATT_GET_URL, data=json.dumps({
                    'context': request.innertube_context,
                    'engagementType': 'ENGAGEMENT_TYPE_UNBOUND',
                }).encode(), headers={
                    'Content-Type': 'application/json',
                }, extensions={'timeout': 5.0}), pot_request=request,
                note='Downloading attestation from API') as att_response:
            if challenge_data := json.load(att_response).get('bgChallenge'):
                return {'challenge': challenge_data}
        return {}


__all__ = ['__version__']
