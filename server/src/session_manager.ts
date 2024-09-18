import { BG, BgConfig, DescrambledChallenge } from "bgutils-js";
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

class Logger {
    private shouldLog: boolean;

    constructor(shouldLog = true) {
        this.shouldLog = shouldLog;
    }

    debug(msg: string) {
        if (this.shouldLog) console.debug(msg);
    }

    log(msg: string) {
        if (this.shouldLog) console.log(msg);
    }

    warn(msg: string) {
        if (this.shouldLog) console.warn(msg);
    }

    error(msg: string) {
        if (this.shouldLog) console.error(msg);
    }
}

export class SessionManager {
    private youtubeSessionDataCaches: YoutubeSessionDataCaches = {};
    private TOKEN_TTL_HOURS: number;
    private logger: Logger;

    constructor(
        shouldLog = true,
        youtubeSessionDataCaches: YoutubeSessionDataCaches = {},
    ) {
        this.logger = new Logger(shouldLog);
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

    async generateVisitorData(): Promise<string | null> {
        const innertube = await Innertube.create({ retrieve_player: false });
        const visitorData = innertube.session.context.client.visitorData;
        if (!visitorData) {
            this.logger.error("Unable to generate visitor data via Innertube");
            return null;
        }

        return visitorData;
    }

    getProxyDispatcher(proxy: string): Agent | undefined {
        if (!proxy) return undefined;
        let protocol: string;
        try {
            const parsedUrl = new URL(proxy);
            protocol = parsedUrl.protocol.replace(":", "");
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            // assume http if no protocol was passed
            protocol = "http";
            proxy = `http://${proxy}`;
        }

        switch (protocol) {
            case "http":
            case "https":
                this.logger.log(`Using HTTP/HTTPS proxy: ${proxy}`);
                return new HttpsProxyAgent(proxy);
            case "socks":
            case "socks4":
            case "socks4a":
            case "socks5":
            case "socks5h":
                this.logger.log(`Using SOCKS proxy: ${proxy}`);
                return new SocksProxyAgent(proxy);
            default:
                this.logger.warn(`Unsupported proxy protocol: ${proxy}`);
                return undefined;
        }
    }
    // mostly copied from https://github.com/LuanRT/BgUtils/tree/main/examples/node
    async generatePoToken(
        visitIdentifier: string,
        proxy: string = "",
    ): Promise<YoutubeSessionData> {
        this.cleanupCaches();
        const sessionData = this.youtubeSessionDataCaches[visitIdentifier];
        if (sessionData) {
            this.logger.log(
                `POT for ${visitIdentifier} still fresh, returning cached token`,
            );
            return sessionData;
        }

        this.logger.log(
            `POT for ${visitIdentifier} stale or not yet generated, generating...`,
        );

        // hardcoded API key that has been used by youtube for years
        const requestKey = "O43z0dpjhgX20SCx4KAo";
        const dom = new JSDOM();

        globalThis.window = dom.window as any;
        globalThis.document = dom.window.document;

        let dispatcher: Agent | undefined;
        let proxies: any;
        if (proxy) {
            dispatcher = this.getProxyDispatcher(proxy);
        } else {
            proxies = {
                http: process.env.HTTP_PROXY,
                https: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
                ftp: process.env.FTP_PROXY,
            };
        }

        const bgConfig: BgConfig = {
            fetch: async (url: any, options: any): Promise<any> => {
                if (proxies) {
                    const parsedUrl = new URL(url);
                    dispatcher = this.getProxyDispatcher(
                        proxies[parsedUrl.protocol.replace(":", "") || "http"],
                    );
                }

                try {
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
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (e) {
                    return {
                        ok: false,
                        json: async () => {
                            return null;
                        },
                    };
                }
            },
            globalObj: globalThis,
            identity: visitIdentifier,
            requestKey,
        };

        let challenge: DescrambledChallenge | undefined;
        try {
            challenge = await BG.Challenge.create(bgConfig);
        } catch (e) {
            throw new Error(
                `Error while attempting to retrieve BG challenge. err = ${e}`,
            );
        }
        if (!challenge) throw new Error("Could not get Botguard challenge");
        if (challenge.script) {
            const script = challenge.script.find((sc) => sc !== null);
            if (script) new Function(script)();
        } else {
            this.logger.log("Unable to load Botguard.");
        }

        let poToken: string | undefined;
        try {
            poToken = await BG.PoToken.generate({
                program: challenge.challenge,
                globalName: challenge.globalName,
                bgConfig,
            });
        } catch (e) {
            throw new Error(
                `Error while trying to generate PO token. e = ${e}`,
            );
        }

        this.logger.log(`po_token: ${poToken}`);
        this.logger.log(`visit_identifier: ${visitIdentifier}`);

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
