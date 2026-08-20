# HTTP Server Method

This document covers the HTTP server provider setup. Use this method for higher concurrency or when you want a long-running provider service. The server listens on port 4416 by default.

## Base Requirements

1. Docker (recommended) OR Node.js (>= 20) or Deno (>= 2.0.0).
2. git (to clone the repository) for native installs.

## Option A: Docker (Recommended)
```shell
docker run --name bgutil-provider -d --init brainicism/bgutil-ytdlp-pot-provider:latest
```

Our Docker image comes in two flavors: Node.js or Deno. The `:latest` tag defaults to Node.js, but you can specify an alternate version/flavor like so: `brainicism/bgutil-ytdlp-pot-provider:1.3.1-deno`. The `:node` tag also points to the latest Node.js image, and `:deno` points to the latest Deno image.

> [!IMPORTANT]
> Note that the docker container's network is isolated from your local network by default. If you are using a local proxy server, it will not be accessible from within the container unless you pass `--net=host` as well.

## Option B: Native HTTP Server

### Install
```shell
# Replace 1.3.1 with the latest version or the one that matches the plugin
git clone --single-branch --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git
cd bgutil-ytdlp-pot-provider/server/
# If you are using Node:
npm ci
npx tsc
# Otherwise, if you want to use Deno:
deno install --allow-scripts=npm:canvas --frozen
```

### Run

Node:

```shell
node build/main.js 
```

Deno:

```shell
cd node_modules
deno run --allow-env --allow-net --allow-ffi=. --allow-read=. ../src/main.ts
```

Make sure either `node` or `deno` is available in your `PATH`. Otherwise, use the yt-dlp option `--js-runtimes RUNTIME:PATH` to pass the path. `--no-js-runtimes` does NOT prevent the plugin from using the JavaScript runtime. The argument is only used to retrieve the path to the runtime.

### Server Command Line Options

- `-p, --port <PORT>`: The port on which the server listens.


## Usage

If using the default IP/port number (http://127.0.0.1:4416), you can use yt-dlp like normal 🙂.

If changing the port or IP used for the provider server, pass it to yt-dlp via `base_url`

```shell
--extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:8080"
```

We use a cache internally for all generated tokens when option (b) script is used. You can change the TTL (time to live) for the token cache with the environment variable `TOKEN_TTL` (in hours, defaults to 6). It's currently impossible to use different TTLs for different token contexts (can be `gvs`, `player`, or `subs`, see [Technical Details](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide#technical-details) from the PO Token Guide).  

Note that when you pass multiple extractor arguments to one provider or extractor, they are to be separated by semicolons(`;`) as shown above.

If both script and server methods are available for use, the option (a) HTTP server method will be prioritized.
