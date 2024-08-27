import { SessionManager } from "./session_manager";
import fastify from "fastify";

const httpServer = fastify({});

httpServer.get("/get_pot", {}, async (request, reply) => {
  const sessionManager = new SessionManager();
  const x = await sessionManager.generatePoToken(
    "Cgt4T0lhQVB6RnlqRSi0vrW2Bg%3D%3D"
  );
  await reply.code(200).send({ po_token: x.poToken });
});

(async () => {
  await httpServer.listen({
    host: "0.0.0.0",
    port: 5858,
  });
})();
