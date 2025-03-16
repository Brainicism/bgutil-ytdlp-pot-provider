from __future__ import annotations

__version__ = '0.7.4'

import typing

if typing.TYPE_CHECKING:
    from yt_dlp import YoutubeDL
# NOTE: this is internal only and may be moved in the future
from yt_dlp.networking._helper import select_proxy
from yt_dlp.networking.common import Features
from yt_dlp.networking.exceptions import UnsupportedRequest
from yt_dlp.utils import classproperty, remove_end

try:
    import yt_dlp_plugins.extractor.getpot as getpot
except ImportError as e:
    e.msg += '\nyt-dlp-get-pot is missing! See https://github.com/coletdjnz/yt-dlp-get-pot?tab=readme-ov-file#installing.'
    raise e


class BgUtilBaseGetPOTRH(getpot.GetPOTProvider):
    _SUPPORTED_CLIENTS = ('web', 'web_safari', 'web_embedded',
                          'web_music', 'web_creator', 'mweb', 'tv_embedded', 'tv')
    VERSION = __version__
    _SUPPORTED_PROXY_SCHEMES = (
        'http', 'https', 'socks4', 'socks4a', 'socks5', 'socks5h')
    _SUPPORTED_FEATURES = (Features.NO_PROXY, Features.ALL_PROXY)
    _SUPPORTED_CONTEXTS = ('gvs', 'player')
    _GETPOT_TIMEOUT = 20.0
    _GET_VSN_TIMEOUT = 5.0

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.yt_ie = None
        self.content_binding = None

    @classproperty
    def _CONFIG_NAME(cls):
        return cls.RH_NAME.lower()

    def _get_config_setting(self, key, casesense=True, default=None):
        return self.yt_ie._configuration_arg(
            key, [default], casesense=casesense)[0]

    def _warn_and_raise(self, msg, once=True, raise_from=None):
        self._logger.warning(msg, once=once)
        raise UnsupportedRequest(msg) from raise_from

    @staticmethod
    def _get_content_binding(client, context, data_sync_id=None, visitor_data=None, video_id=None):
        # https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide#po-tokens-for-player
        if context == 'gvs' or client == 'web_music':
            # web_music player or gvs is bound to data_sync_id or visitor_data
            return data_sync_id or visitor_data
        return video_id

    def _check_version(self, got_version, *, default='unknown', name):
        if got_version != self.VERSION:
            self._logger.warning(
                f'The provider plugin and the {name} are on different versions, '
                f'this may cause compatibility issues. '
                f'Please ensure they are on the same version. '
                f'(plugin: {self.VERSION}, {name}: {got_version or 'unknown'})',
                once=True)

    def _get_yt_proxy(self):
        if ((proxy := select_proxy('https://jnn-pa.googleapis.com', self.proxies))
                != select_proxy('https://youtube.com', self.proxies)):
            self._logger.warning(
                'Proxies for https://youtube.com and https://jnn-pa.googleapis.com are different. '
                'This is likely to cause subsequent errors.')
        return proxy

    def _validate_get_pot(
        self,
        client: str,
        ydl: YoutubeDL,
        visitor_data=None,
        data_sync_id=None,
        context=None,
        video_id=None,
        **kwargs,
    ):
        # sets yt_ie, content_binding
        self.yt_ie = ydl.get_info_extractor('Youtube')
        self.content_binding = self._get_content_binding(
            client=client, context=context, data_sync_id=data_sync_id,
            visitor_data=visitor_data, video_id=video_id)
        self._real_validate_get_pot(
            client=client, ydl=ydl, visitor_data=visitor_data,
            data_sync_id=data_sync_id, context=context, video_id=video_id,
            **kwargs)

    def _real_validate_get_pot(
        self,
        client: str,
        ydl: YoutubeDL,
        visitor_data=None,
        data_sync_id=None,
        context=None,
        video_id=None,
        **kwargs,
    ):
        """
        Validate and check the GetPOT request is supported.
        """

    @classproperty
    def RH_NAME(cls):
        return cls._PROVIDER_NAME or remove_end(cls.RH_KEY, 'GetPOT')


__all__ = [getpot.__name__, '__version__']
