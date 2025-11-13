from __future__ import annotations

import abc
import functools
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Iterable, TypeVar

from yt_dlp.extractor.youtube.pot.provider import (
    PoTokenProviderError,
    PoTokenRequest,
    PoTokenResponse,
    register_preference,
    register_provider,
)
from yt_dlp.extractor.youtube.pot.utils import get_webpo_content_binding
from yt_dlp.utils import Popen, int_or_none

from yt_dlp_plugins.extractor.getpot_bgutil import BgUtilPTPBase

T = TypeVar('T')


def getenv(key, default=None, /, *, integer=False, string=True):
    args = dict(key=key, default=default, integer=integer, string=string) # noqa: C408
    supported_types = dict(zip(args.keys(), (
        (str,),  # key
        (
            bool,
            float,
            int,
            str,
            None.__class__,
        ),  # default
        (bool,) * (len(args.keys()) - 2),
    )))
    unsupported_type_msg = 'Unsupported type for positional argument, "{}": {}'
    for k, t in supported_types.items():
        v = args[k]
        assert isinstance(v, t), unsupported_type_msg.format(k, type(v))

    d = str(default) if default is not None else None

    r = os.getenv(key, d)
    if r is None:
        if string:
            r = str() # noqa: UP018
        if integer:
            r = int() # noqa: UP018
    elif integer:
        r = int(float(r))
    return r


class BgUtilScriptPTPBase(BgUtilPTPBase, abc.ABC):
    _SCRIPT_BASENAME: str
    _JSRT_NAME: str
    _JSRT_EXEC: str
    _JSRT_VSN_REGEX: str
    _JSRT_MIN_VER: tuple[int, ...]

    @abc.abstractmethod
    def _script_path_impl(self) -> str:
        raise NotImplementedError

    def _jsrt_args(self) -> Iterable[str]:
        return ()

    def _jsrt_path_impl(self) -> str | None:
        jsrt_path = shutil.which(self._JSRT_EXEC)
        if jsrt_path is None:
            # TODO: test if root dir works
            self.logger.warning(
                f'{self._JSRT_NAME} executable not found. Please ensure {self._JSRT_NAME} is installed and available '
                'in PATH or the root directory of yt-dlp.')
            return None
        try:
            stdout, stderr, returncode = Popen.run(
                [jsrt_path, '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                timeout=int(self._GET_SERVER_VSN_TIMEOUT))
        except subprocess.TimeoutExpired:
            self.logger.warning(
                f'Failed to check {self._JSRT_NAME} version: {self._JSRT_NAME} process '
                'did not finish in {int(self._GET_SERVER_VSN_TIMEOUT)} seconds')
            return None
        mobj = re.search(self._JSRT_VSN_REGEX, stdout)
        if returncode or not mobj:
            self.logger.warning(
                f'Failed to check {self._JSRT_NAME} version. '
                f'{self._JSRT_NAME} returned {returncode} exit status. '
                f'Process stdout: {stdout}; stderr: {stderr}')
            return None
        if self._jsrt_has_support(mobj.group(1)):
            return jsrt_path

    def _jsrt_has_support(self, v: str) -> bool:
        if self._jsrt_vsn_tup(v) >= self._JSRT_MIN_VER:
            self.logger.trace(f'{self._JSRT_NAME} version: {v}')
            return True
        else:
            min_vsn_str = '.'.join(str(v_) for v_ in self._JSRT_MIN_VER)
            self.logger.warning(
                f'{self._JSRT_NAME} version too low. '
                f'(got {v}, but at least {min_vsn_str} is required)')
            return False

    @functools.cached_property
    def _script_path(self) -> str:
        return self._script_path_impl()

    @functools.cached_property
    def _jsrt_path(self) -> str | None:
        return self._jsrt_path_impl()

    _HOMEDIR = os.path.expanduser('~')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._check_script = functools.cache(self._check_script_impl)

    @staticmethod
    def _jsrt_vsn_tup(v: str):
        return tuple(int_or_none(x, default=0) for x in v.split('.'))

    def _base_config_arg(self, key: str, default: T = None) -> str | T:
        return self.ie._configuration_arg(
            ie_key='youtubepot-bgutilscript', key=key, default=[default])[0]

    @property
    def _server_home(self) -> str:
        if script_path := self._base_config_arg('script_path'):
            return os.path.abspath(os.path.join(
                os.path.expandvars(script_path), os.pardir, os.pardir))

        # TODO: an base cfg arg for server home
        # default if no arg was passed
        default_home = os.path.join(
            self._HOMEDIR, 'bgutil-ytdlp-pot-provider', 'server')
        self.logger.debug(
            f'No script path passed, defaulting to {default_home}')
        return default_home

    def is_available(self) -> bool:
        return self._check_script(self._script_path)

    def _check_script_impl(self, script_path) -> bool:
        if not os.path.isfile(script_path):
            self.logger.debug(
                f"Script path doesn't exist: {script_path}")
            return False
        if os.path.basename(script_path) != self._SCRIPT_BASENAME:
            self.logger.warning(
                f'The script path passed in the extractor argument '
                f'has a wrong base name, expected {self._SCRIPT_BASENAME}.', once=True)
            return False
        if not self._jsrt_path:
            return False
        stdout, stderr, returncode = Popen.run(
            [self._jsrt_path, *self._jsrt_args(), script_path, '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            timeout=int(self._GET_SERVER_VSN_TIMEOUT))
        if returncode:
            self.logger.warning(
                f'Failed to check script version. '
                f'Script returned {returncode} exit status. '
                f'Script stdout: {stdout}; Script stderr: {stderr}',
                once=True)
            return False
        else:
            self._check_version(stdout.strip(), name='script')
            return True

    def _real_request_pot(
        self,
        request: PoTokenRequest,
    ) -> PoTokenResponse:
        # used for CI check
        self.logger.trace(
            f'Generating POT via script: {self._script_path}')

        command_args = [self._jsrt_path, *self._jsrt_args(), self._script_path]
        if proxy := request.request_proxy:
            command_args.extend(['-p', proxy])
        command_args.extend(['-c', get_webpo_content_binding(request)[0]])
        if request.bypass_cache:
            command_args.append('--bypass-cache')
        if request.request_source_address:
            command_args.extend(
                ['--source-address', request.request_source_address])
        if request.request_verify_tls is False:
            command_args.append('--disable-tls-verification')

        self.logger.info(
            f'Generating a {request.context.value} PO Token for '
            f'{request.internal_client_name} client via bgutil script',
        )
        self.logger.debug(
            f'Executing command to get POT via script: {" ".join(command_args)}')

        try:
            stdout, stderr, returncode = Popen.run(
                command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                timeout=int(self._GETPOT_TIMEOUT))
        except subprocess.TimeoutExpired as e:
            raise PoTokenProviderError(
                f'_get_pot_via_script failed: Timeout expired when trying to run script (caused by {e!r})')
        except Exception as e:
            raise PoTokenProviderError(
                f'_get_pot_via_script failed: Unable to run script (caused by {e!r})') from e

        msg = ''
        if stdout_extra := stdout.strip().splitlines()[:-1]:
            msg = f'stdout:\n{stdout_extra}\n'
        if stderr_stripped := stderr.strip():  # Empty strings are falsy
            msg += f'stderr:\n{stderr_stripped}\n'
        msg = msg.strip()
        if msg:
            self.logger.trace(msg)
        if returncode:
            raise PoTokenProviderError(
                f'_get_pot_via_script failed with returncode {returncode}')

        try:
            json_resp = stdout.splitlines()[-1]
            self.logger.trace(f'JSON response:\n{json_resp}')
            # The JSON response is always the last line
            script_data_resp = json.loads(json_resp)
        except json.JSONDecodeError as e:
            raise PoTokenProviderError(
                f'Error parsing JSON response from _get_pot_via_script (caused by {e!r})') from e
        if 'poToken' not in script_data_resp:
            raise PoTokenProviderError(
                'The script did not respond with a po_token')
        return PoTokenResponse(po_token=script_data_resp['poToken'])


@register_provider
class BgUtilScriptNodePTP(BgUtilScriptPTPBase):
    PROVIDER_NAME = 'bgutil:script-node'
    _SCRIPT_BASENAME = 'generate_once.js'
    _JSRT_NAME = 'Node.js'
    _JSRT_EXEC = 'node'
    _JSRT_VSN_REGEX = r'^v(\S+)'
    _JSRT_MIN_VER = (20, 0, 0)

    def _script_path_impl(self) -> str:
        return os.path.join(
            self._server_home, 'build', self._SCRIPT_BASENAME)


@register_preference(BgUtilScriptNodePTP)
def bgutil_script_node_getpot_preference(provider: BgUtilScriptNodePTP, request):
    return 10 if provider._base_config_arg('prefer_node', 'false') != 'false' else 1


@register_provider
class BgUtilScriptDenoPTP(BgUtilScriptPTPBase):
    PROVIDER_NAME = 'bgutil:script-deno'
    _SCRIPT_BASENAME = 'generate_once.ts'
    _JSRT_NAME = 'Deno'
    _JSRT_EXEC = 'deno'
    _JSRT_VSN_REGEX = r'^deno (\S+)'
    _JSRT_MIN_VER = (2, 0, 0)

    def _script_path_impl(self) -> str:
        return os.path.join(
            self._server_home, 'src', self._SCRIPT_BASENAME)

    def _jsrt_args(self) -> Iterable[str]:
        # TODO: restrict permissions!
        _cache_dir = getenv('XDG_CACHE_HOME')
        _home_path = Path(self._HOMEDIR).resolve()
        if _home_path.is_dir() and not _cache_dir:
            _cache_dir = _home_path / '.cache'
        elif not _cache_dir:
            _cache_dir = '.'
        _cache_dir = Path(_cache_dir).resolve() / 'bgutil-ytdlp-pot-provider'
        _cache_dir.mkdir(parents=True, exist_ok=True)
        return ('-A', '--unstable-sloppy-imports')


@register_preference(BgUtilScriptDenoPTP)
def bgutil_script_deno_getpot_preference(provider: BgUtilScriptDenoPTP, request):
    return 1 if provider._base_config_arg('prefer_node', 'false') != 'false' else 10


__all__ = [
    BgUtilScriptNodePTP.__name__,
    bgutil_script_node_getpot_preference.__name__,
    BgUtilScriptDenoPTP.__name__,
    bgutil_script_deno_getpot_preference.__name__,
]
