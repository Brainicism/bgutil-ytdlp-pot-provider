import type { Express, Request, Response } from "express";
import { SessionManager } from "../session_manager.ts";
import { strerror } from "../utils.ts";

export function registerPotRoutes(
    app: Express,
    sessionManager: SessionManager,
) {
    app.post("/get_pot", async (request: Request, response: Response) => {
        const body = request.body || {};
        if (body.data_sync_id)
            return response.status(400).send({
                error: "data_sync_id is deprecated, use content_binding instead",
            });
        if (body.visitor_data)
            return response.status(400).send({
                error: "visitor_data is deprecated, use content_binding instead",
            });
        if (body.disable_innertube)
            return response.status(400).send({
                error: "disable_innertube is deprecated because the /Create endpoint doesn't work anymore",
            });

        const contentBinding: string | undefined = body.content_binding;
        const proxy: string = body.proxy;
        const bypassCache: boolean = body.bypass_cache || false;
        const sourceAddress: string | undefined = body.source_address;
        const disableTlsVerification: boolean =
            body.disable_tls_verification || false;

        try {
            const sessionData = await sessionManager.generatePoToken(
                contentBinding,
                proxy,
                bypassCache,
                sourceAddress,
                disableTlsVerification,
                body.challenge,
                body.innertube_context,
            );

            response.send(sessionData);
        } catch (e) {
            const msg = strerror(e, /*update=*/ true);
            console.error(e.stack);
            response.status(500).send({ error: msg });
        }
    });
}
