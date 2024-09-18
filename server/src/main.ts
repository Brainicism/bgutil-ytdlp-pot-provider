import { SessionManager } from "./session_manager";
import { VERSION } from "./version";
import { Command } from "@commander-js/extra-typings";
import express from "express";
import bodyParser from "body-parser";

const program = new Command().option("-p, --port <PORT>").option("--verbose");

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

const sessionManager = new SessionManager(options.verbose || false);
httpServer.post("/get_pot", async (request, response) => {
    const visitorData = request.body.visitor_data as string;
    const dataSyncId = request.body.data_sync_id as string;
    const proxies: string[] = request.body.proxies;
    let visitIdentifier: string;

    // prioritize data sync id for authenticated requests, if passed
    if (dataSyncId) {
        console.log(`Received request for data sync ID: '${dataSyncId}'`);
        visitIdentifier = dataSyncId;
    } else if (visitorData) {
        console.log(`Received request for visitor data: '${visitorData}'`);
        visitIdentifier = visitorData;
    } else {
        console.log(
            `Received request for visitor data, grabbing from Innertube`,
        );

        const generatedVisitorData = await sessionManager.generateVisitorData();
        if (!generatedVisitorData) {
            response.status(500);
            response.send({ error: "Error generating visitor data" });
            return;
        }

        console.log(`Generated visitor data: ${generatedVisitorData}`);
        visitIdentifier = generatedVisitorData;
    }

    const sessionData = await sessionManager.generatePoToken(
        visitIdentifier,
        proxies,
    );
    response.send({
        po_token: sessionData.poToken,
        visit_identifier: sessionData.visitIdentifier,
    });
});

httpServer.post("/invalidate_caches", async (request, response) => {
    sessionManager.invalidateCaches();
    response.send();
});

httpServer.get("/ping", async (request, response) => {
    response.send({
        logging: options.verbose ? "verbose" : "normal",
        token_ttl_hours: process.env.TOKEN_TTL || 6,
        server_uptime: process.uptime(),
        version: VERSION,
    });
});
