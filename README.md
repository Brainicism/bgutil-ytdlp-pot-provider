# BgUtils POT Provider

> [!CAUTION]
> Providing a PO token does not guarantee bypassing 403 errors or bot checks, but it _may_ help your traffic seem more legitimate.

[![Docker Image Version (tag)](https://img.shields.io/docker/v/brainicism/bgutil-ytdlp-pot-provider/latest?style=for-the-badge&label=docker)](https://hub.docker.com/r/brainicism/bgutil-ytdlp-pot-provider)
[![GitHub Release](https://img.shields.io/github/v/release/Brainicism/bgutil-ytdlp-pot-provider?style=for-the-badge)](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases)
[![PyPI - Version](https://img.shields.io/pypi/v/bgutil-ytdlp-pot-provider?style=for-the-badge)](https://pypi.org/project/bgutil-ytdlp-pot-provider/)
[![CI Status](https://img.shields.io/github/actions/workflow/status/Brainicism/bgutil-ytdlp-pot-provider/test.yml?branch=master&label=Tests&style=for-the-badge)](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/actions/workflows/test.yml)

A proof-of-origin token (POT) provider to be used alongside [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot). We use [LuanRT's Botguard interfacing library](https://github.com/LuanRT/BgUtils) to generate the token.

This is used to bypass the 'Sign in to confirm you're not a bot' message when invoking yt-dlp from an IP address flagged by YouTube. See _[What is a PO Token?](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#po-token-guide)_ for more details.

The provider comes in two parts:

1. **Provider**: Two options -
   - (a) An HTTP server that generates the POT, and has interfaces for the plugin to retrieve data from (easy setup + docker image provided)
   - (b) A POT generation script, and has command line options for the plugin to invoke (needs to transpile the script)
2. **Provider plugin**: uses POT plugin framework to retrieve data from the provider, allowing yt-dlp to simulate having passed the 'bot check'.

## Installation

### Base Requirements

1. Requires yt-dlp `2024.09.27` or above.

2. If using Docker image for option (a) for the provider, the Docker runtime is required.  
   Otherwise, Node.js (>= 18) and Yarn are required. You will also need git to clone the repository.

### 1. Set up the provider

There are two options for the provider, an always running POT generation HTTP server, and a POT generation script invoked when needed. The HTTP server option is simpler, and comes with a prebuilt Docker image. **You only need to choose one option.**

#### (a) HTTP Server Option

The provider is a Node.js HTTP server. You have two options for running it: as a prebuilt docker image, or manually as a node application.

**Docker:**

```shell
docker run --name bgutil-provider -d -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider
```

**Native:**

```shell
# Replace 0.7.4 with the latest version or the one that matches the plugin
git clone --single-branch --branch 0.7.4 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git
cd bgutil-ytdlp-pot-provider/server/
yarn install --frozen-lockfile
npx tsc
node build/main.js
```

<details>
  <summary>Server Command Line Options/Endpoints</summary>

**Options**
- `-p, --port <PORT>`: The port on which the server listens.
- `--verbose`: Use verbose logging

**Endpoints**

- **POST /get_pot**: Generate a new POT.
  - The request data should be a JSON including:
    - `visitor_data`: Content binding (required).
    - `proxy`: A string indicating the proxy to use for the requests (optional).
  - Returns a JSON:
    - `po_token`: The POT.
    - `visit_identifier`: The passed or generated content binding.
- **GET /ping**: Ping the server. The response includes:
  - `logging`: Logging verbosity(`normal` or `verbose`).
  - `server_uptime`: Uptime of the server process in seconds.
  - `version`: Current server version.

</details>

#### (b) Generation Script Option

1. Transpile the generation script to Javascript:

```shell
# If you want to use this method without specifying `getpot_bgutil_script` extractor argument
# on each yt-dlp invocation, clone/extract the source code into your home directory.
# Replace `~` with `%USERPROFILE%` if using Windows
cd ~
# Replace 0.7.4 with the latest version or the one that matches the plugin
git clone --single-branch --branch 0.7.4 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git
cd bgutil-ytdlp-pot-provider/server/
yarn install --frozen-lockfile
npx tsc
```

2. Make sure `node` is available in your `PATH`.

<details>
  <summary>Script options</summary>

- `-v, --visitor-data <visitordata>`: The content binding, required.
- `-p, --proxy <proxy-all>`: The proxy to use for the requests, optional.
- `--version`: Print the script version and exit
- `--verbose`: Use verbose logging

</details>

### 2. Install the plugin

#### PyPI:

```shell
python3 -m pip install -U bgutil-ytdlp-pot-provider
```

This will automatically install [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot) if haven't installed it yet.

#### Manual:

1. Make sure you have [coletdjnz's POT plugin framework](https://github.com/coletdjnz/yt-dlp-get-pot) installed already (must be at least version 0.1.1 or newer).
2. Download the latest release zip from [releases](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases). Install it by placing the zip into one of the [plugin folders](https://github.com/yt-dlp/yt-dlp#installing-plugins).

## Usage

If using option (a) HTTP Server for the provider, and the default IP/port number, you can use yt-dlp like normal 🙂.

If you want to change the port number used by the provider server, use the `--port` option.

```shell
node build/main.js --port 8080
```

If changing the port or IP used for the provider server, pass it to yt-dlp via `getpot_bgutil_baseurl`

```shell
--extractor-args "youtube:getpot_bgutil_baseurl=http://127.0.0.1:8080"
```

---

If using option (b) script for the provider, with the default script location in your home directory (i.e: `~/bgutil-ytdlp-pot-provider` or `%USERPROFILE%\bgutil-ytdlp-pot-provider`), you can also use yt-dlp like normal.

If you installed the script in a different location, pass it as the extractor argument `getpot_bgutil_script` to `youtube` for each yt-dlp call.

```shell
--extractor-args "youtube:getpot_bgutil_script=$WORKSPACE/bgutil-ytdlp-pot-provider/server/build/generate_once.js"
```

We use a cache internally for all generated tokens. You can change the TTL (time to live) for the token cache with an extractor argument called `{provider_name}_{context}_ttl`, where `{provider_name}` is the provider's name in lower case and `{context}` denotes the token context (can be `gvs` or `player`). The TTL extractor arguments are in seconds.  
The default cache TTL is 6 hours for gvs and 10 minutes for player.  
For example if you want to change the gvs token TTL to 1 day when using the script method, you can pass the following to yt-dlp:  
```shell
--extractor-args "youtube:bgutilscript_gvs_ttl=86400"
```

If you want to disable caching, pass 0 to all TTLs like this:
```shell
--extractor-args "youtube:bgutilscript_gvs_ttl=0;bgutilscript_player_ttl=0;youtube:bgutilhttp_gvs_ttl=0;bgutilhttp_player_ttl=0"
```
This only prevents **new cache from being written to the disk**. The old cache can still be read. Currently, there isn't an option to tell the plugin to ignore the old cache.

Note that if you want to pass multiple arguments to a GetPOT provider, use a `;` seperated list.  
For example, you can use `--extractor-args "youtube:bgutilscript_gvs_ttl=0;getpot_bgutil_script=/path/to/bgutil-ytdlp-pot-provider/server/build/generate_once.js"` if you want to disable caching for gvs tokens and have a custom script path.

---

If both methods are available for use, the option (b) script will be prioritized.
