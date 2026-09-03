import { SessionManager } from "./session_manager.ts";
import { strerror, VERSION } from "./utils.ts";
import { Command } from "commander";
import express from "express";
import http from "node:http";
import net from "node:net";

function collectHosts(host: string, previous: string[]) {
    previous.push(
        ...host
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
    );
    return previous;
}

const program = new Command()
    .option("-p, --port <PORT>")
    .option(
        "-H, --host <HOST>",
        "Host/IP to listen on; repeat or separate with commas to bind multiple addresses",
        collectHosts,
        [],
    )
    .parse();

const cliOptions = program.opts();

const PORT_NUMBER = cliOptions.port || 4416;

const httpServer = express();
httpServer.use(express.json());

// Bind the IPv6 and IPv4 localhost addresses as separate sockets, with the
// IPv6 one restricted to IPv6 so the two never overlap. Every address is
// optional: a failure is logged, and startup only aborts if nothing could be
// bound.
const LISTEN_ADDRESSES: (net.ListenOptions & { host: string })[] = [
    { host: "::1", ipv6Only: true },
    { host: "127.0.0.1" },
];

function getListenAddresses(hosts: string[]) {
    if (hosts.length === 0) return LISTEN_ADDRESSES;
    return hosts.map((host) =>
        host.includes(":") ? { host, ipv6Only: true } : { host },
    );
}

function formatAddress(host: string) {
    return `${host.includes(":") ? `[${host}]` : host}:${PORT_NUMBER}`;
}

function listen(options: net.ListenOptions): Promise<http.Server> {
    return new Promise((resolve, reject) => {
        const server = http.createServer(httpServer);
        server.once("error", reject);
        server.listen({ ...options, port: PORT_NUMBER }, () => {
            server.removeListener("error", reject);
            resolve(server);
        });
    });
}

async function startServer() {
    const bound: string[] = [];
    for (const listenOptions of getListenAddresses(cliOptions.host)) {
        const address = formatAddress(listenOptions.host);
        try {
            await listen(listenOptions);
            bound.push(address);
        } catch (err) {
            // Deno ignores `ipv6Only` (and on Windows leaves the OS default of
            // IPv6-only, #244), so with a dual-stack "::1" socket the 127.0.0.1
            // bind collides with it. That only means IPv4 is already served.
            if (err?.code === "EADDRINUSE" && bound.length > 0) continue;
            console.error(
                `Could not listen on ${address} (Caused by ${strerror(err)})`,
            );
        }
    }
    if (bound.length === 0) {
        console.error(`Could not listen on port ${PORT_NUMBER}`);
        process.exit(1);
    }
    console.log(
        `Started POT server (v${VERSION}) on address ${bound.join(", ")}`,
    );
}

startServer();

const sessionManager = new SessionManager();
httpServer.get("/", async (request, response) => {
    response
        .status(400)
        .send(
            "This server is not meant to be accessed directly unless you know what you're doing. Follow the README for plugin/provider setup, and yt-dlp will automatically use the provider: https://github.com/Brainicism/bgutil-ytdlp-pot-provider#readme",
        );
});

httpServer.post("/get_pot", async (request, response) => {
    const body = request.body || {};
    if (body.data_sync_id)
        return response.status(400).send({
            error: "data_sync_id is deprecated, use content_binding instead",
        });
    if (body.visitor_data)
        return response.status(400).send({
            error: "visitor_data is deprecated, use content_binding instead",
        });
    if (body.disable_innertube)
        return response.status(400).send({
            error: "disable_innertube is deprecated because the /Create endpoint doesn't work anymore",
        });

    const contentBinding: string | undefined = body.content_binding;
    const proxy: string = body.proxy;
    const bypassCache: boolean = body.bypass_cache || false;
    const sourceAddress: string | undefined = body.source_address;
    const disableTlsVerification: boolean =
        body.disable_tls_verification || false;

    try {
        const sessionData = await sessionManager.generatePoToken(
            contentBinding,
            proxy,
            bypassCache,
            sourceAddress,
            disableTlsVerification,
            body.challenge,
            body.innertube_context,
        );

        response.send(sessionData);
    } catch (e) {
        const msg = strerror(e, /*update=*/ true);
        console.error(e.stack);
        response.status(500).send({ error: msg });
    }
});

httpServer.post("/invalidate_caches", async (request, response) => {
    sessionManager.invalidateCaches();
    response.status(204).send();
});

httpServer.post("/invalidate_it", async (request, response) => {
    sessionManager.invalidateIT();
    response.status(204).send();
});

httpServer.get("/ping", async (request, response) => {
    response.send({
        server_uptime: process.uptime(),
        version: VERSION,
    });
});

httpServer.get("/minter_cache", async (request, response) => {
    console.debug(sessionManager.minterCache);
    response.send(Array.from(sessionManager.minterCache.keys()));
});
