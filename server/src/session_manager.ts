import { BG } from "bgutils-js";
import { JSDOM } from "jsdom";

interface YoutubeSessionData {
    poToken: string;
    visitIdentifier: string;
    generatedAt: Date;
}

export class SessionManager {
    private youtubeSessionData: {
        [visitIdentifier: string]: YoutubeSessionData;
    } = {};

    // mostly copied from https://github.com/LuanRT/BgUtils/tree/main/examples/node
    async generatePoToken(
        visitIdentifier: string,
    ): Promise<YoutubeSessionData> {
        const sessionData = this.youtubeSessionData[visitIdentifier];
        if (
            sessionData &&
            sessionData.generatedAt >
                new Date(new Date().getTime() - 6 * 60 * 60 * 1000)
        ) {
            console.info(
                `POT for ${visitIdentifier} still fresh, returning cached token`,
            );
            return sessionData;
        }

        console.info(
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
            console.warn("Unable to load Botguard.");
        }

        const poToken = await BG.PoToken.generate({
            program: challenge.challenge,
            globalName: challenge.globalName,
            bgConfig,
        });

        console.info("po_token:", poToken);
        console.info("visit_identifier:", visitIdentifier);

        if (!poToken) {
            throw new Error("po_token unexpected undefined");
        }

        this.youtubeSessionData[visitIdentifier] = {
            visitIdentifier: visitIdentifier,
            poToken: poToken,
            generatedAt: new Date(),
        };

        return this.youtubeSessionData[visitIdentifier];
    }
}
