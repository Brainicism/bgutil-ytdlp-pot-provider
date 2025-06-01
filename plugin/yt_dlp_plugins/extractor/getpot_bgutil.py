from __future__ import annotations

__version__ = '1.0.0'

import abc

import yt_dlp.extractor.youtube.pot.provider as provider
from yt_dlp.extractor.youtube.pot.utils import WEBPO_CLIENTS


class BgUtilPTPBase(provider.PoTokenProvider, abc.ABC):
    _SUPPORTED_CLIENTS = WEBPO_CLIENTS
    PROVIDER_VERSION = __version__
    _SUPPORTED_EXTERNAL_REQUEST_FEATURES = (
        provider.ExternalRequestFeature.PROXY_SCHEME_HTTP,
        provider.ExternalRequestFeature.PROXY_SCHEME_HTTPS,
        provider.ExternalRequestFeature.PROXY_SCHEME_SOCKS4,
        provider.ExternalRequestFeature.PROXY_SCHEME_SOCKS4A,
        provider.ExternalRequestFeature.PROXY_SCHEME_SOCKS5,
        provider.ExternalRequestFeature.PROXY_SCHEME_SOCKS5H,
    )
    _SUPPORTED_CONTEXTS = (
        provider.PoTokenContext.GVS,
        provider.PoTokenContext.PLAYER,
        provider.PoTokenContext.SUBS,
    )
    BUG_REPORT_LOCATION = 'https://github.com/Brainicism/bgutil-ytdlp-pot-provider/issues'
    _GETPOT_TIMEOUT = 20.0
    _GET_SERVER_VSN_TIMEOUT = 5.0
    _MIN_NODE_VSN = (18, 0, 0)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.yt_ie = None

    def _info_and_raise(self, msg, raise_from=None):
        self.logger.info(msg)
        raise provider.PoTokenProviderRejectedRequest(msg) from raise_from

    def _warn_and_raise(self, msg, once=True, raise_from=None):
        self.logger.warning(msg, once=once)
        raise provider.PoTokenProviderRejectedRequest(msg) from raise_from

    def _check_version(self, got_version, *, default='unknown', name):
        if got_version != self.PROVIDER_VERSION:
            self.logger.warning(
                f'The provider plugin and the {name} are on different versions, '
                f'this may cause compatibility issues. '
                f'Please ensure they are on the same version. '
                f'(plugin: {self.PROVIDER_VERSION}, {name}: {got_version or default})',
                once=True)


__all__ = ['__version__']
