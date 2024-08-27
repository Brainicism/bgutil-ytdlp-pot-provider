import { SessionManager } from "./session_manager";
import fastify from "fastify";

const httpServer = fastify({});

httpServer.register(require("@fastify/formbody"));

httpServer.post("/get_pot", {}, async (request, reply) => {
  const sessionManager = new SessionManager();
  const visitorData: string = (request.body as any).visitor_data;
  const x = await sessionManager.generatePoToken(visitorData);
  await reply.code(200).send({ po_token: x.poToken });
});

(async () => {
  await httpServer.listen({
    host: "0.0.0.0",
    port: 5858,
  });
})();
