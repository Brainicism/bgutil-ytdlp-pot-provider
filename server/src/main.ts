import { SessionManager } from "./session_manager";
import { VERSION } from "./version";
import { Command } from "commander";
import express from "express";
import bodyParser from "body-parser";

const program = new Command().option("-p, --port <PORT>").parse();

const options = program.opts();

const PORT_NUMBER = options.port || 4416;

const httpServer = express();
httpServer.use(bodyParser.json());

httpServer.listen({
    host: "0.0.0.0",
    port: PORT_NUMBER,
});

console.log(`Started POT server (v${VERSION}) on port ${PORT_NUMBER}`);

const sessionManager = new SessionManager();
httpServer.post("/get_pot", async (request, response) => {
    if (request.body.data_sync_id) {
        console.error(
            "data_sync_id is deprecated, use content_binding instead",
        );
        process.exit(1);
    }
    if (request.body.visitor_data) {
        console.error(
            "visitor_data is deprecated, use content_binding instead",
        );
        process.exit(1);
    }
    const contentBinding: string | undefined = request.body.content_binding;
    const proxy: string = request.body.proxy;
    const bypassCache: boolean = request.body.bypass_cache || false;
    const sourceAddress: string | undefined = request.body.source_address;
    const disableTlsVerification: boolean =
        request.body.disable_tls_verification || false;

    try {
        const sessionData = await sessionManager.generatePoToken(
            contentBinding,
            proxy,
            bypassCache,
            sourceAddress,
            disableTlsVerification,
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
    response.send();
});

httpServer.get("/ping", async (request, response) => {
    response.send({
        token_ttl_hours: process.env.TOKEN_TTL || 6,
        server_uptime: process.uptime(),
        version: VERSION,
    });
});
