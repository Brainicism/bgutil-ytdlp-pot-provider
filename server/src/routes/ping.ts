import type { Express } from "express";
import { VERSION } from "../utils.ts";

export function registerPingRoute(app: Express) {
    app.get("/ping", (_request, response) => {
        response.send({
            server_uptime: process.uptime(),
            version: VERSION,
        });
    });
}
