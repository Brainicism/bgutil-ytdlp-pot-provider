import { SessionManager } from "./session_manager";
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

    let visitorIdentifier: string;

    // prioritize data sync id for authenticated requests, if passed
    if (dataSyncId) {
        console.log(`Received request for data sync ID: '${dataSyncId}'`);
        visitorIdentifier = dataSyncId;
    } else if (visitorData) {
        console.log(`Received request for visitor data: '${visitorData}'`);
        visitorIdentifier = visitorData;
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
        visitorIdentifier = generatedVisitorData;
    }

    const sessionData = await sessionManager.generatePoToken(visitorIdentifier);
    response.send({
        po_token: sessionData.poToken,
        visit_identifier: sessionData.visitIdentifier,
    });
});

httpServer.post("/invalidate_caches", async (request, response) => {
    sessionManager.invalidateCaches();
    response.send();
});
