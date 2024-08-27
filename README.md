# BgUtils POT Provider

A proof-of-origin token (POT) provider to be used alongside [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot). We use [LuanRT's Botguard interfacing library](https://github.com/LuanRT/BgUtils) to generate the token.

This is used to bypass the 'Sign in to confirm you're not a bot' message when invoking yt-dlp from an IP address flagged by YouTube. See https://github.com/yt-dlp/yt-dlp-wiki/pull/40/files for more details.

The provider comes in two parts:

1. **Provider**: An HTTP server that generates the POT, and has interfaces for the plugin to retrieve data from
2. **Provider plugin**: uses POT plugin framework to retrieve data from the provider, allowing yt-dlp to simulate having passed the 'bot check'

## Usage

Default port number is 4416. If you want to change this, be sure to change it in both the provider and plugin code.

### 1. Set up the provider

Native:

```
yarn install --frozen-lockfile
npx tsc
node build/main.js
```

Docker:

```
docker build --tag bgutil-provider .
docker run --name bgutil-provider -d -p 4416:4416 bgutil-provider
```

TODO: provide docker images

### 2. Install the plugin

Drop the plugin zip file into one of the yt-dlp plugin installation directories. **Ensure that you have the [plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot) installed as well**. See [Installing Plugins](https://github.com/yt-dlp/yt-dlp?tab=readme-ov-file#installing-plugins) for more details.

TODO: provide zip release
