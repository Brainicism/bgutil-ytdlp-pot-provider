# BgUtils POT Provider

> [!CAUTION]
> Providing a PO token does not guarantee bypassing 403 errors or bot checks, but it _may_ help your traffic seem more legitimate.

[![Docker Image Version (tag)](https://img.shields.io/docker/v/brainicism/bgutil-ytdlp-pot-provider/latest?style=for-the-badge&label=docker)](https://hub.docker.com/r/brainicism/bgutil-ytdlp-pot-provider)
[![GitHub Release](https://img.shields.io/github/v/release/Brainicism/bgutil-ytdlp-pot-provider?style=for-the-badge)](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases)
[![PyPI - Version](https://img.shields.io/pypi/v/bgutil-ytdlp-pot-provider?style=for-the-badge)](https://pypi.org/project/bgutil-ytdlp-pot-provider/)
[![CI Status](https://img.shields.io/github/actions/workflow/status/Brainicism/bgutil-ytdlp-pot-provider/test.yml?branch=master&label=Tests&style=for-the-badge)](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/actions/workflows/test.yml)

[Frequently Asked Questions](https://github.com/Brainicism/bgutil-ytdlp-pot-provider?tab=readme-ov-file#faq)

A proof-of-origin token (POT) provider for yt-dlp. We use [LuanRT's Botguard interfacing library](https://github.com/LuanRT/BgUtils) to generate the token.
This project was used to bypass the 'Sign in to confirm you're not a bot' message when invoking yt-dlp from an IP address flagged by YouTube. See _[PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)_ for more details.

The provider comes in two parts:

1. **Provider**: Two options -
   - (a) An HTTP server that generates the POT, and has interfaces for the plugin to retrieve data from (much faster, easy setup + docker image provided with Deno/Node.js support)
   - (b) A POT generation script, and has command line options for the plugin to invoke (needs to transpile the script)
2. **Provider plugin**: retrieves tokens from the provider and provides the token for yt-dlp using _[PO Token Provider Framework](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/pot/README.md)_.

## Installation

### 1. Set up the provider
**Requirements**: Node.js (>= 20) or Deno (>= 2.0.0).

Download the code, install dependencies, and transpile
```shell
# Replace 1.3.1 with the latest version or the one that matches the plugin
git clone --single-branch --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git ~/bgutil-ytdlp-pot-provider

cd ~/bgutil-ytdlp-pot-provider/server/
# If you are using Node:
npm ci
npx tsc
# Otherwise, if you want to use Deno:
deno install --allow-scripts=npm:canvas --frozen
```

And we're done! 

> [!NOTE]
> If you have high concurrency use cases, use the HTTP server method instead. See [README.provider-options.md](README.provider-options.md) for the server setup.

## Install the plugin

### PyPI

If yt-dlp is installed through `pip` or `pipx`, you can install the plugin with the following:

```shell
python3 -m pip install -U bgutil-ytdlp-pot-provider
```

### Manual

1. Download [`bgutil-ytdlp-pot-provider.zip`](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip) from [the latest release](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest).
2. Install it by placing the zip into one of the [yt-dlp plugin folders](https://github.com/yt-dlp/yt-dlp#installing-plugins).

## Usage
If you installed the script in the default location (`~/bgutil-ytdlp-pot-provider`) like the instructions earlier, you're good to go! `yt-dlp` will now automatically invoke the script to grab a PO token when needed.

If you installed the script to a different location, pass the location as the extractor argument `server_home` to `youtube-bgutilscript` for each yt-dlp call.

```shell
--extractor-args "youtubepot-bgutilscript:server_home=/path/to/bgutil-ytdlp-pot-provider/server"
```

Note that when you pass multiple extractor arguments to one provider or extractor, they are to be separated by semicolons(`;`) as shown above.



### Verification

To check if the plugin was installed correctly, you should see the `bgutil` providers in yt-dlp's verbose output: `yt-dlp -v YOUTUBE_URL`.

```
[debug] [youtube] [pot] PO Token Providers: bgutil:http-1.3.1 (external), bgutil:script-node-1.3.1 (external), bgutil:script-deno-1.3.1 (external, unavailable)
```

## FAQ

### I'm getting errors during `npm ci` on Termux

For provider versions >=1.2.0, you may have issues while installing the `canvas` dependency on Termux. The Termux environment is missing a `android_ndk_path` and two packages by default. Run the following commands to setup the dependencies correctly.

```shell
mkdir ~/.gyp && echo "{'variables':{'android_ndk_path':''}}" > ~/.gyp/include.gypi
pkg install libvips xorgproto
```
