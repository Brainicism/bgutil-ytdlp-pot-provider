import { BG, BgConfig } from "bgutils-js";
import { JSDOM } from "jsdom";
import { Innertube } from "youtubei.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import { Agent } from "https";
import { SocksProxyAgent } from "socks-proxy-agent";

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

    warn(msg: string) {
        if (this.shouldLog) console.warn(msg);
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

    getProxyDispatcher(proxy: string): Agent | undefined {
        let protocol: string;
        try {
            const parsedUrl = new URL(proxy);

            if (!parsedUrl.protocol) {
                protocol = "https";
            }

            protocol = parsedUrl.protocol.replace(":", "");
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            // assume http if no protocol was passed
            protocol = "https";
        }

        switch (protocol) {
            case "http":
            case "https":
                this.log(`Using HTTPS proxy: ${proxy}`);
                return new HttpsProxyAgent(proxy);
            case "socks":
            case "socks4":
            case "socks4a":
            case "socks5":
            case "socks5h":
                this.log(`Using SOCKS proxy: ${proxy}`);
                return new SocksProxyAgent(proxy);
            default:
                this.warn(`Unsupported proxy protocol: ${proxy}`);
                return undefined;
        }
    }
    // mostly copied from https://github.com/LuanRT/BgUtils/tree/main/examples/node
    async generatePoToken(
        visitIdentifier: string,
        proxies: string[] = [],
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

        let dispatcher: Agent | undefined;
        if (proxies.length) {
            dispatcher = this.getProxyDispatcher(proxies[0]!);
        }

        const bgConfig: BgConfig = {
            fetch: async (url: any, options: any): Promise<any> => {
                const response = await axios.post(url, options.body, {
                    headers: options.headers,
                    httpsAgent: dispatcher,
                });

                return {
                    ok: true,
                    json: async () => {
                        return response.data;
                    },
                };
            },
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
