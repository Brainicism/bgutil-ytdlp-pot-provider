from __future__ import annotations

import contextlib
import functools
import json
import os.path
import shutil
import subprocess

from yt_dlp.extractor.youtube.pot.builtin.utils import get_webpo_content_binding
from yt_dlp.utils import Popen, classproperty

with contextlib.suppress(ImportError):
    from yt_dlp_plugins.extractor.getpot_bgutil import BgUtilPTPBase

from yt_dlp.extractor.youtube.pot.provider import (
    PoTokenProviderError,
    PoTokenRequest,
    PoTokenResponse,
    register_preference,
    register_provider,
)


@register_provider
class BgUtilScriptPTP(BgUtilPTPBase):
    PROVIDER_NAME = 'bgutil:script'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._check_script = functools.cache(self._check_script_impl)
        self.script_path = os.path.expandvars(self.get_setting(
            'script_path', casesense=True, default=[self._default_script_path])[0])

    def is_available(self):
        return self._check_script(self.script_path)

    @functools.cached_property
    def _node_path(self):
        node_path = shutil.which('node')
        if node_path is None:
            self.logger.trace('node is not in PATH')
        vsn = self._check_node_version(node_path)
        if vsn:
            self.logger.trace(f'Node version: {vsn}')
            return node_path

    @classproperty(cache=True)
    def _default_script_path(cls):
        home = os.path.expanduser('~')
        return os.path.join(
            home, 'bgutil-ytdlp-pot-provider', 'server', 'build', 'generate_once.js')

    def _check_script_impl(self, script_path):
        if not os.path.isfile(script_path):
            self.logger.debug(
                f"Script path doesn't exist: {script_path}")
            return False
        if os.path.basename(script_path) != 'generate_once.js':
            self.logger.warning(
                'Incorrect script passed to extractor args. Path to generate_once.js required', once=True)
            return False
        node_path = self._node_path
        if not node_path:
            return False
        stdout, stderr, returncode = Popen.run(
            [self._node_path, script_path, '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            timeout=self._GET_SERVER_VSN_TIMEOUT)
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

    def _check_node_version(self, node_path):
        import re
        try:
            stdout, stderr, returncode = Popen.run(
                [node_path, '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                timeout=self._GET_SERVER_VSN_TIMEOUT)
            stdout = stdout.strip()
            mobj = re.match(r'v(\d+)\.(\d+)\.(\d+)', stdout)
            if returncode or not mobj:
                raise ValueError
            node_vsn = tuple(map(int, mobj.groups()))
            if node_vsn >= self._MIN_NODE_VSN:
                return node_vsn
            raise RuntimeError
        except RuntimeError:
            min_vsn_str = 'v' + '.'.join(str(v) for v in self._MIN_NODE_VSN)
            self.logger.warning(
                f'Node version too low. '
                f'(got {stdout}, but at least {min_vsn_str} is required)')
        except (subprocess.TimeoutExpired, ValueError):
            self.logger.warning(
                f'Failed to check node version. '
                f'Node returned {returncode} exit status. '
                f'Node stdout: {stdout}; Node stderr: {stderr}')

    def _real_request_pot(
        self,
        ctx: PoTokenRequest,
    ) -> PoTokenResponse:
        self.logger.debug(
            f'Generating POT via script: {self.script_path}')
        command_args = [self._node_path, self.script_path]
        if proxy := ctx.request_proxy:
            command_args.extend(['-p', proxy])

        command_args.extend(['-v', get_webpo_content_binding(ctx)[0]])
        self.logger.debug(
            f'Executing command to get POT via script: {" ".join(command_args)}')

        try:
            stdout, stderr, returncode = Popen.run(
                command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                timeout=self._GETPOT_TIMEOUT)
        except subprocess.TimeoutExpired as e:
            raise PoTokenProviderError(
                f'_get_pot_via_script failed: Timeout expired when trying to run script (caused by {e!r})')
        except Exception as e:
            raise PoTokenProviderError(
                f'_get_pot_via_script failed: Unable to run script (caused by {e!r})') from e

        msg = f'stdout:\n{stdout.strip()}'
        if stderr.strip():  # Empty strings are falsy
            msg += f'\nstderr:\n{stderr.strip()}'
        self.logger.trace(msg)
        if returncode:
            raise PoTokenProviderError(
                f'_get_pot_via_script failed with returncode {returncode}')

        try:
            # The JSON response is always the last line
            script_data_resp = json.loads(stdout.splitlines()[-1])
        except json.JSONDecodeError as e:
            raise PoTokenProviderError(
                f'Error parsing JSON response from _get_pot_via_script (caused by {e!r})') from e
        if 'poToken' not in script_data_resp:
            raise PoTokenProviderError(
                'The script did not respond with a po_token')
        return PoTokenResponse(po_token=script_data_resp['poToken'])


@register_preference(BgUtilScriptPTP)
def bgutil_script_getpot_preference(provider, request):
    return 1


__all__ = [BgUtilScriptPTP.__class__.__name__,
           bgutil_script_getpot_preference.__name__]
