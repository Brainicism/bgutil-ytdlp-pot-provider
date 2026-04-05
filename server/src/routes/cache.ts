import type { Express } from "express";
import { SessionManager } from "../session_manager.ts";

export function registerCacheRoutes(
    app: Express,
    sessionManager: SessionManager,
) {
    app.post("/invalidate_caches", (_request, response) => {
        sessionManager.invalidateCaches();
        response.status(204).send();
    });

    app.post("/invalidate_it", (_request, response) => {
        sessionManager.invalidateIT();
        response.status(204).send();
    });
}
