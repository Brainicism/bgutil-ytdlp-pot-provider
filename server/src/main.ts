import { parseServerOptions } from "./cli.ts";
import { SessionManager } from "./session_manager.ts";
import { createHttpServer, startHttpServer } from "./server.ts";

const options = parseServerOptions();
const sessionManager = new SessionManager();
const httpServer = createHttpServer(sessionManager);

startHttpServer(httpServer, options.port);
