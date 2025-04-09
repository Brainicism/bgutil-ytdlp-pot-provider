from __future__ import annotations

__version__ = '0.8.2'

import typing

if typing.TYPE_CHECKING:
    from yt_dlp import YoutubeDL

import abc

import yt_dlp.extractor.youtube.pot.provider as provider
from yt_dlp.extractor.youtube.pot.builtin.utils import WEBPO_CLIENTS
from yt_dlp.networking.common import Features


class BgUtilPTPBase(provider.PoTokenProvider, abc.ABC):
    _SUPPORTED_CLIENTS = WEBPO_CLIENTS
    PROVIDER_VERSION = __version__
    _SUPPORTED_PROXY_SCHEMES = (
        'http', 'https', 'socks4', 'socks4a', 'socks5', 'socks5h')
    _SUPPORTED_CONTEXTS = (provider.PoTokenContext.GVS,
                           provider.PoTokenContext.PLAYER)
    BUG_REPORT_LOCATION = 'https://github.com/Brainicism/bgutil-ytdlp-pot-provider/issues'
    _GETPOT_TIMEOUT = 20.0
    _GET_VSN_TIMEOUT = 5.0
    _MIN_NODE_VSN = (18, 0, 0)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.yt_ie = None

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
