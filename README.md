# BgUtils POT Provider

[![Docker Image Version (tag)](https://img.shields.io/docker/v/brainicism/bgutil-ytdlp-pot-provider/latest?style=for-the-badge&label=docker)](https://hub.docker.com/r/brainicism/bgutil-ytdlp-pot-provider)
[![GitHub Release](https://img.shields.io/github/v/release/Brainicism/bgutil-ytdlp-pot-provider?style=for-the-badge)](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases)
[![PyPI - Version](https://img.shields.io/pypi/v/bgutil-ytdlp-pot-provider?style=for-the-badge)](https://pypi.org/project/bgutil-ytdlp-pot-provider/)

A proof-of-origin token (POT) provider to be used alongside [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot). We use [LuanRT's Botguard interfacing library](https://github.com/LuanRT/BgUtils) to generate the token.

This is used to bypass the 'Sign in to confirm you're not a bot' message when invoking yt-dlp from an IP address flagged by YouTube. See https://github.com/yt-dlp/yt-dlp-wiki/pull/40/files for more details.

The provider comes in two parts:

1. **Provider**: Two options -
   - (a) An HTTP server that generates the POT, and has interfaces for the plugin to retrieve data from (easy setup + docker image provided)
   - (b) A POT generation script supplied via extractor arguments
2. **Provider plugin**: uses POT plugin framework to retrieve data from the provider, allowing yt-dlp to simulate having passed the 'bot check'

## Installation

> [!CAUTION]
> This plugin is not ready for general use and is awaiting changes to be merged in yt-dlp for it to be functional.
> Follow https://github.com/yt-dlp/yt-dlp/pull/10648 for updates.

Default port number is 4416. If you want to change this, be sure to change it in both the provider and plugin code.

### Base Requirements

If using Docker image for option (a) for the provider, the Docker runtime is required.

Otherwise, Node.js and Yarn are required. You will also need to clone the repository.

### 1. Set up the provider

There are two options for the provider, an always running POT generation HTTP server, and a POT generation script invoked when needed. The HTTP server option is simpler, and comes with a prebuilt Docker image. **You only need to choose one option.**

#### (a) HTTP Server Option

The provider is a Node.js HTTP server. You have two options of running it: as a prebuilt docker image, or manually as a node application.

**Docker:**

```shell
docker run --name bgutil-provider -d -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider
```

**Native:**

```shell
cd server/
yarn install --frozen-lockfile
npx tsc
node build/main.js
```

<details>
  <summary>Server Endpoints/Environment Variables</summary>

**Environment Variables**

- **TOKEN_TTL**: The time in hours for a PO token to be considered valid. While there are no definitive answers on how long a token is valid, it has been observed to be valid for atleast a couple of days. Default: 6

**Endpoints**

- **POST /get_pot**: Accepts a `visitor_data` (unauthenticated), `data_sync_id` (authenticated) or an empty body in the request body. If no identifier is passed, a new unauthenticated `visitor_data` will be generated. Returns `po_token` and the associated identifier `visit_identifier`.
- **POST /invalidate_caches**: Resets the PO token cache, forcing new tokens to be generated on next fetch
</details>

#### (b) Generation Script Option

The generation script needs to be transpiled to Javascript before it can be used by the plugin.

```shell
cd server/
yarn install --frozen-lockfile
npx tsc
```

Make sure `node` is available in your `PATH`.

### 2. Install the plugin

#### PyPI:

```shell
python3 -m pip install -U bgutil-ytdlp-pot-provider
```

This will automatically install [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot) if haven't installed it yet.

#### Manual:

1. Make sure you have [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot) installed already (must be at least version 0.0.2 or newer).
2. Download the latest release zip from [releases](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases). Install it by placing the zip into one of the [plugin folders](https://github.com/yt-dlp/yt-dlp#installing-plugins).

## Usage

If using option (a) HTTP Server for the provider, use yt-dlp like normal 🙂.

If using option (b) script for the provider, you need to pass extractor arguments including the path to the generation script for each yt-dlp call. Make sure to point to the transpiled version, `server/build/generate_once.js`

```shell
./yt-dlp --extractor-args "youtube:getpot_bgutil_script=/home/user/bgutil-ytdlp-pot-provider/server/build/generate_once.js"
```
