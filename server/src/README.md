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

### Content Binding

Content binding refers to the data used to generate a PO Token.

GVS tokens (See [PO Tokens for GVS](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide#po-tokens-for-gvs) from the PO Token Guide) are all session-bound so the content binding for a GVS token is either a Visitor ID (also known as `visitorData`, `VISITOR_INFO1_LIVE`, used when not logged in) or the account Session ID (first part of the Data Sync ID, used when logged in).

Player tokens are mostly content-bound and their content bindings are the video IDs. Note that the `web_music` client uses the session token instead of video ID to generate player tokens.
