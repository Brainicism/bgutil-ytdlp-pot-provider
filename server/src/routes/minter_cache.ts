import type { Express } from "express";
import { SessionManager } from "../session_manager.ts";

export function registerMinterCacheRoute(
    app: Express,
    sessionManager: SessionManager,
) {
    app.get("/minter_cache", (_request, response) => {
        console.debug(sessionManager.minterCache);
        response.send(Array.from(sessionManager.minterCache.keys()));
    });
}
