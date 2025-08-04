import { SessionManager } from "./session_manager.js";
import { VERSION } from "./version.js";
import { Command } from "commander";
import express from "express";

const program = new Command().option("-p, --port <PORT>").parse();

const options = program.opts();

const PORT_NUMBER = options.port || 4416;

const httpServer = express();
httpServer.use(express.json());
httpServer.use(express.urlencoded({ extended: true }));

httpServer.listen({
    host: "0.0.0.0",
    port: PORT_NUMBER,
});

console.log(`Started POT server (v${VERSION}) on port ${PORT_NUMBER}`);

const sessionManager = new SessionManager();
httpServer.post("/get_pot", async (request, response) => {
    const body = request.body || {};
    if (body.data_sync_id) {
        console.error(
            "data_sync_id is deprecated, use content_binding instead",
        );
        process.exit(1);
    }
    if (body.visitor_data) {
        console.error(
            "visitor_data is deprecated, use content_binding instead",
        );
        process.exit(1);
    }
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
            body.disable_innertube || false,
            body.innertube_context,
        );

        response.send(sessionData);
    } catch (e) {
        console.error(
            `Failed while generating POT. err.name = ${e.name}. err.message = ${e.message}. err.stack = ${e.stack}`,
        );
        response.status(500).send({ error: JSON.stringify(e) });
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
