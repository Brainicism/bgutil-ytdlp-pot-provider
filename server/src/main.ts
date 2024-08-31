import { SessionManager } from "./session_manager";
import express from "express";
import bodyParser from "body-parser";

const PORT_NUMBER = 4416;

const httpServer = express();
httpServer.use(bodyParser.json());

httpServer.listen({
    host: "0.0.0.0",
    port: PORT_NUMBER,
});

console.log(`Started POT server on port ${PORT_NUMBER}`);

const sessionManager = new SessionManager();
httpServer.post("/get_pot", async (request, response) => {
    const visitorData = request.body.visitor_data as string;
    const dataSyncId = request.body.data_sync_id as string;

    let visitorIdentifier: string;

    // prioritize data sync id for authenticated requests, if passed
    if (dataSyncId) {
        console.log(`Received request for data sync ID: '${dataSyncId}'`);
        visitorIdentifier = dataSyncId;
    } else {
        console.log(`Received request for visitor data: '${visitorData}'`);
        visitorIdentifier = visitorData;
    }

    const sessionData = await sessionManager.generatePoToken(visitorIdentifier);
    response.send({ po_token: sessionData.poToken });
});

httpServer.post("/invalidate_caches", async (request, response) => {
    sessionManager.invalidateCaches();
    response.send();
});
