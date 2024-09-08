# BgUtils POT Provider

A proof-of-origin token (POT) provider to be used alongside [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot). We use [LuanRT's Botguard interfacing library](https://github.com/LuanRT/BgUtils) to generate the token.

This is used to bypass the 'Sign in to confirm you're not a bot' message when invoking yt-dlp from an IP address flagged by YouTube. See https://github.com/yt-dlp/yt-dlp-wiki/pull/40/files for more details.

The provider comes in two parts:

1. **Provider**: An HTTP server that generates the POT, and has interfaces for the plugin to retrieve data from
2. **Provider plugin**: uses POT plugin framework to retrieve data from the provider, allowing yt-dlp to simulate having passed the 'bot check'

## Installation

> [!CAUTION]
> This plugin is not ready for general use and is awaiting changes to be merged in yt-dlp for it to be functional.
> Follow https://github.com/yt-dlp/yt-dlp/pull/10648 for updates.

Default port number is 4416. If you want to change this, be sure to change it in both the provider and plugin code.

### 1. Set up the provider
The provider is a Node.js HTTP server. You have two options of running it: as a prebuilt docker image, or manually as a node application.

#### Docker:

```shell
docker run --name bgutil-provider -d -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider
```

#### Native:

```shell
cd server/
yarn install --frozen-lockfile
npx tsc
node build/main.js
```

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
### Environment Variables
- **TOKEN_TTL**: The time in hours for a PO token to be considered valid. While there are no definitive answers on how long a token is valid, it has been observed to be valid for atleast a couple of days. Default: 6

### Endpoints
- **POST /get_pot**: Accepts either a `visitor_data` (unauthenticated) or `data_sync_id` (authenticated) in the request body, returns a respective `po_token`
- **POST /invalidate_caches**: Resets the PO token cache, forcing new tokens to be generated on next fetch
