import { BG } from "bgutils-js";
import { JSDOM } from "jsdom";
import { Innertube } from "youtubei.js";

interface YoutubeSessionData {
    poToken: string;
    visitIdentifier: string;
    generatedAt: Date;
}

export interface YoutubeSessionDataCaches {
    [visitIdentifier: string]: YoutubeSessionData;
}

export class SessionManager {
    shouldLog: boolean;

    private youtubeSessionDataCaches: YoutubeSessionDataCaches = {};
    private TOKEN_TTL_HOURS: number;

    constructor(
        shouldLog = true,
        youtubeSessionDataCaches: YoutubeSessionDataCaches = {},
    ) {
        this.shouldLog = shouldLog;
        this.setYoutubeSessionDataCaches(youtubeSessionDataCaches);
        this.TOKEN_TTL_HOURS = process.env.TOKEN_TTL
            ? parseInt(process.env.TOKEN_TTL)
            : 6;
    }

    invalidateCaches() {
        this.setYoutubeSessionDataCaches();
    }

    cleanupCaches() {
        for (const visitIdentifier in this.youtubeSessionDataCaches) {
            const sessionData = this.youtubeSessionDataCaches[visitIdentifier];
            if (
                sessionData &&
                sessionData.generatedAt <
                    new Date(
                        new Date().getTime() -
                            this.TOKEN_TTL_HOURS * 60 * 60 * 1000,
                    )
            )
                delete this.youtubeSessionDataCaches[visitIdentifier];
        }
    }

    getYoutubeSessionDataCaches(cleanup = false) {
        if (cleanup) this.cleanupCaches();
        return this.youtubeSessionDataCaches;
    }

    setYoutubeSessionDataCaches(
        youtubeSessionData: YoutubeSessionDataCaches = {},
    ) {
        this.youtubeSessionDataCaches = youtubeSessionData || {};
    }

    log(msg: string) {
        if (this.shouldLog) console.log(msg);
    }

    async generateVisitorData(): Promise<string | null> {
        const innertube = await Innertube.create({ retrieve_player: false });
        const visitorData = innertube.session.context.client.visitorData;
        if (!visitorData) {
            console.error("Unable to generate visitor data via Innertube");
            return null;
        }

        return visitorData;
    }

    // mostly copied from https://github.com/LuanRT/BgUtils/tree/main/examples/node
    async generatePoToken(
        visitIdentifier: string,
    ): Promise<YoutubeSessionData> {
        this.cleanupCaches();
        const sessionData = this.youtubeSessionDataCaches[visitIdentifier];
        if (sessionData) {
            this.log(
                `POT for ${visitIdentifier} still fresh, returning cached token`,
            );
            return sessionData;
        }

        this.log(
            `POT for ${visitIdentifier} stale or not yet generated, generating...`,
        );

        // hardcoded API key that has been used by youtube for years
        const requestKey = "O43z0dpjhgX20SCx4KAo";
        const dom = new JSDOM();

        globalThis.window = dom.window as any;
        globalThis.document = dom.window.document;

        const bgConfig = {
            fetch: (url: any, options: any) => fetch(url, options),
            globalObj: globalThis,
            identity: visitIdentifier,
            requestKey,
        };

        const challenge = await BG.Challenge.create(bgConfig);

        if (!challenge) throw new Error("Could not get Botguard challenge");

        if (challenge.script) {
            const script = challenge.script.find((sc) => sc !== null);
            if (script) new Function(script)();
        } else {
            this.log("Unable to load Botguard.");
        }

        const poToken = await BG.PoToken.generate({
            program: challenge.challenge,
            globalName: challenge.globalName,
            bgConfig,
        });

        this.log(`po_token: ${poToken}`);
        this.log(`visit_identifier: ${visitIdentifier}`);

        if (!poToken) {
            throw new Error("po_token unexpected undefined");
        }

        this.youtubeSessionDataCaches[visitIdentifier] = {
            visitIdentifier: visitIdentifier,
            poToken: poToken,
            generatedAt: new Date(),
        };

        return this.youtubeSessionDataCaches[visitIdentifier];
    }
}
