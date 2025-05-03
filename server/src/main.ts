import { SessionManager } from "./session_manager";
import { VERSION } from "./version";
import { Command } from "commander";
import express from "express";
import bodyParser from "body-parser";

const program = new Command().option("-p, --port <PORT>");

program.parse();
const options = program.opts();

const PORT_NUMBER = options.port || 4416;

const httpServer = express();
httpServer.use(bodyParser.json());

httpServer.listen({
    host: "0.0.0.0",
    port: PORT_NUMBER,
});

console.log(`Started POT server on port ${PORT_NUMBER}`);

const sessionManager = new SessionManager();
httpServer.post("/get_pot", async (request, response) => {
    const proxy: string = request.body.proxy;
    const contentBinding: string | undefined =
        request.body.content_binding ||
        request.body.data_sync_id ||
        request.body.visitor_data;
    if (request.body.data_sync_id)
        console.warn(
            "Passing data_sync_id is deprecated, use content_binding instead",
        );

    try {
        const sessionData = await sessionManager.generatePoToken(
            contentBinding,
            proxy,
        );

        response.send({
            po_token: sessionData.poToken,
            visit_identifier: sessionData.visitIdentifier,
            generated_at: sessionData.generatedAt,
        });
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
