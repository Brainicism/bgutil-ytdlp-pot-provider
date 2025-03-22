If using the provider along with yt-dlp as intended, stop reading here. The server and script will be used automatically with no intervention required.

If you are interested in using the script/server standalone for generating your own PO token, read onwards

# Server

**Endpoints**

- **POST /get_pot**: Generate a new POT.
    - The request data should be a JSON including:
        - `content_binding`: [Content binding](#content-binding) (required).
        - `proxy`: A string indicating the proxy to use for the requests (optional).
    - Returns a JSON:
        - `po_token`: The POT.
- **GET /ping**: Ping the server. The response includes:
    - `logging`: Logging verbosity(`normal` or `verbose`).
    - `token_ttl_hours`: The current applied `TOKEN_TTL` value, defaults to 6.
    - `server_uptime`: Uptime of the server process in seconds.
    - `version`: Current server version.

# Script Method

**Options**

- `-c, --content-binding <content-binding>`: The [content binding](#content-binding), required.
- `-p, --proxy <proxy-all>`: The proxy to use for the requests, optional.
- `--version`: Print the script version and exit.
- `--verbose`: Use verbose logging.

**Environment Variables**

- **TOKEN_TTL**: The time in hours for a PO token to be considered valid. While there are no definitive answers on how long a token is valid, it has been observed to be valid for atleast a couple of days (Default: 6).
