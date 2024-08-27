import { SessionManager } from "./session_manager";
import express from "express";
import bodyParser from "body-parser";

const httpServer = express();
httpServer.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

httpServer.listen({
  host: "0.0.0.0",
  port: 8080,
});

httpServer.post("/get_pot", async (request, response) => {
  const sessionManager = new SessionManager();
  console.log("Headers:", request.headers);
  console.log("Content-Type:", request.headers["content-type"]);

  console.log(request.body);
  const visitorData: string = request.body.visitor_data;
  console.log(`Received request for ${visitorData}`);
  const x = await sessionManager.generatePoToken(visitorData);
  console.log(`Po token response: ${visitorData}`);
  response.send({ po_token: x.poToken });
});
