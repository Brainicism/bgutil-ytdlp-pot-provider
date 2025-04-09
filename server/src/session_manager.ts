import { BG, BgConfig, DescrambledChallenge } from "bgutils-js";
import { JSDOM } from "jsdom";
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
        // stderr should always be shown
        console.warn(msg);
    }

    error(msg: string) {
        console.error(msg);
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

    getProxyDispatcher(proxy: string | undefined): Agent | undefined {
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

        let loggedProxy: string = proxy;
        try {
            const parsedUrl = new URL(proxy);
            if (parsedUrl.password) {
                loggedProxy = proxy.replace(parsedUrl.password, "****");
            }
        } catch (e) {
            this.logger.warn(`Fail to parse proxy url ${proxy}: ${e}`);
            return undefined;
        }

        switch (protocol) {
            case "http":
            case "https":
                this.logger.log(`Using HTTP/HTTPS proxy: ${loggedProxy}`);
                return new HttpsProxyAgent(proxy);
            case "socks":
            case "socks4":
            case "socks4a":
            case "socks5":
            case "socks5h":
                this.logger.log(`Using SOCKS proxy: ${loggedProxy}`);
                return new SocksProxyAgent(proxy);
            default:
                this.logger.warn(`Unsupported proxy protocol: ${loggedProxy}`);
                return undefined;
        }
    }
    // mostly copied from https://github.com/LuanRT/BgUtils/tree/main/examples/node
    async generatePoToken(
        contentBinding: string,
        proxy: string = "",
    ): Promise<YoutubeSessionData> {
        this.logger.log(`Generating POT for ${contentBinding}`);
        this.cleanupCaches();
        const sessionData = this.youtubeSessionDataCaches[contentBinding];
        if (sessionData) {
            this.logger.log(
                `POT for ${contentBinding} still fresh, returning cached token`,
            );
            return sessionData;
        }

        this.logger.log(
            `POT for ${contentBinding} stale or not yet generated, generating...`,
        );

        // hardcoded API key that has been used by youtube for years
        const requestKey = "O43z0dpjhgX20SCx4KAo";
        const dom = new JSDOM();

        globalThis.window = dom.window as any;
        globalThis.document = dom.window.document;

        let dispatcher: Agent | undefined;
        if (proxy) {
            dispatcher = this.getProxyDispatcher(proxy);
        } else {
            dispatcher = this.getProxyDispatcher(
                process.env.HTTPS_PROXY ||
                    process.env.HTTP_PROXY ||
                    process.env.ALL_PROXY,
            );
        }

        const bgConfig: BgConfig = {
            fetch: async (url: any, options: any): Promise<any> => {
                const maxRetries = 3;
                for (let attempts = 1; attempts <= maxRetries; attempts++) {
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
                    } catch (e) {
                        if (attempts >= maxRetries) {
                            return {
                                ok: false,
                                json: async () => {
                                    return null;
                                },
                                status: e.response?.status || e.code,
                            };
                        }
                        await new Promise((resolve) =>
                            setTimeout(resolve, 5000),
                        );
                    }
                }
            },
            globalObj: globalThis,
            identifier: contentBinding,
            requestKey,
        };

        let challenge: DescrambledChallenge | undefined;
        try {
            challenge = await BG.Challenge.create(bgConfig);
        } catch (e) {
            throw new Error(
                `Error while attempting to retrieve BG challenge. err = ${JSON.stringify(e)}`,
                { cause: e },
            );
        }
        if (!challenge) throw new Error("Could not get Botguard challenge");

        const interpreterJavascript =
            challenge.interpreterJavascript
                .privateDoNotAccessOrElseSafeScriptWrappedValue;

        if (interpreterJavascript) {
            new Function(interpreterJavascript)();
        } else throw new Error("Could not load VM");

        let poToken: string | undefined;
        try {
            const poTokenResult = await BG.PoToken.generate({
                program: challenge.program,
                globalName: challenge.globalName,
                bgConfig,
            });

            poToken = poTokenResult.poToken;
        } catch (e) {
            throw new Error(
                `Error while trying to generate PO token. err.name = ${e.name}. err.message = ${e.message}. err.stack = ${e.stack}`,
                { cause: e },
            );
        }

        if (!poToken) {
            throw new Error("poToken unexpected undefined");
        }

        this.logger.log(`poToken: ${poToken}`);
        const youtubeSessionData = {
            visitIdentifier: contentBinding,
            poToken: poToken,
            generatedAt: new Date(),
        };

        this.youtubeSessionDataCaches[contentBinding] = youtubeSessionData;

        return youtubeSessionData;
    }
}
