import type { Express, Request, Response } from "express";

export function registerRootRoute(app: Express) {
    app.get("/", (_request: Request, response: Response) => {
        response
            .status(400)
            .send(
                "This server is not meant to be accessed directly unless you know what you're doing. Follow the README for plugin/provider setup, and yt-dlp will automatically use the provider: https://github.com/Brainicism/bgutil-ytdlp-pot-provider#readme",
            );
    });
}
