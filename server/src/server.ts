import express from "express";
import { SessionManager } from "./session_manager.ts";
import { strerror, VERSION } from "./utils.ts";
import { registerCacheRoutes } from "./routes/cache.ts";
import { registerMinterCacheRoute } from "./routes/minter_cache.ts";
import { registerPingRoute } from "./routes/ping.ts";
import { registerPotRoutes } from "./routes/pot.ts";
import { registerRootRoute } from "./routes/root.ts";

export function createHttpServer(sessionManager: SessionManager) {
    const httpServer = express();
    httpServer.use(express.json());
    httpServer.use(express.urlencoded({ extended: true }));

    registerRootRoute(httpServer);
    registerPotRoutes(httpServer, sessionManager);
    registerCacheRoutes(httpServer, sessionManager);
    registerPingRoute(httpServer);
    registerMinterCacheRoute(httpServer, sessionManager);

    return httpServer;
}

export function startHttpServer(
    httpServer: ReturnType<typeof createHttpServer>,
    port: number,
) {
    httpServer
        .listen(
            {
                host: "::",
                port,
            },
            (err) => {
                if (err) {
                    console.error(
                        `Could not listen on [::]:${port}, falling back to 0.0.0.0 (Caused by ${strerror(err)})`,
                    );
                } else {
                    console.log(
                        `Started POT server (v${VERSION}) on on address [::]:${port}`,
                    );
                }
            },
        )
        .on("error", () => {
            // ipv4 only systems might not be able to bind to "::", so we try 0.0.0.0 instead
            // this is temporary as we plan to bind to localhost in the next major version
            httpServer.listen(
                {
                    host: "0.0.0.0",
                    port,
                },
                (err) => {
                    if (err) {
                        console.error(
                            `Could not listen on [::]:${port} (Caused by ${strerror(err)})`,
                        );
                    } else {
                        console.log(
                            `Started POT server (v${VERSION}) on address 0.0.0.0:${port}`,
                        );
                    }
                },
            );
        });
}
