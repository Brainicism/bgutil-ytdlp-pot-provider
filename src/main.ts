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

httpServer.post("/get_pot", async (request, response) => {
    const sessionManager = new SessionManager();
    const visitorData = request.body.visitor_data;
    console.log(`Received request for visitor data: '${visitorData}'`);
    const sessionData = await sessionManager.generatePoToken(visitorData);
    response.send({ po_token: sessionData.poToken });
});
