import {
    BG,
    BgConfig,
    DescrambledChallenge,
    WebPoSignalOutput,
    FetchFunction,
    buildURL,
    getHeaders,
} from "bgutils-js";
import { JSDOM } from "jsdom";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import { Agent } from "https";
import { SocksProxyAgent } from "https-socks-proxy";
import { Innertube } from "youtubei.js";

interface YoutubeSessionData {
    poToken: string;
    contentBinding: string;
    expiresAt: Date;
}

export interface YoutubeSessionDataCaches {
    [contentBinding: string]: YoutubeSessionData;
}

type IntegrityTokenCache = {
    expiry: Date;
    integrityToken?: string;
    minter?: BG.WebPoMinter;
};

type BGSnapshotResult = {
    snapshot: string;
    webPoSignalOutput: WebPoSignalOutput;
};

class Logger {
    readonly debug: (msg: string) => void;
    readonly log: (msg: string) => void;
    readonly warn: (msg: string) => void;
    readonly error: (msg: string) => void;

    constructor(shouldLog = true) {
        if (shouldLog) {
            this.debug = (msg: string) => {
                console.debug(msg);
            };
            this.log = (msg: string) => {
                console.log(msg);
            };
        } else {
            this.debug = this.log = () => {};
        }
        this.warn = (msg: string) => {
            console.warn(msg);
        };
        this.error = (msg: string) => {
            console.error(msg);
        };
    }
}

export class SessionManager {
    private youtubeSessionDataCaches: YoutubeSessionDataCaches = {};
    private TOKEN_TTL_HOURS: number;
    private logger: Logger;
    private integrityTokenCache: IntegrityTokenCache = { expiry: new Date() };
    private bgResp: BGSnapshotResult | undefined;
    // hardcoded API key that has been used by youtube for years
    private static readonly REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

    constructor(
        shouldLog = true,
        youtubeSessionDataCaches: YoutubeSessionDataCaches = {},
    ) {
        this.logger = new Logger(shouldLog);
        this.setYoutubeSessionDataCaches(youtubeSessionDataCaches);
        this.TOKEN_TTL_HOURS = process.env.TOKEN_TTL
            ? parseInt(process.env.TOKEN_TTL)
            : 6;
        const dom = new JSDOM();
        globalThis.window = dom.window as any;
        globalThis.document = dom.window.document;
    }

    invalidateCaches() {
        this.setYoutubeSessionDataCaches();
    }

    cleanupCaches() {
        for (const contentBinding in this.youtubeSessionDataCaches) {
            const sessionData = this.youtubeSessionDataCaches[contentBinding];
            if (sessionData && new Date() > sessionData.expiresAt)
                delete this.youtubeSessionDataCaches[contentBinding];
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

    private getProxyDispatcher(
        proxy: string | undefined,
        sourceAddress: string | undefined,
        disableTlsVerification: boolean = false,
    ): Agent | undefined {
        if (!proxy) {
            return new Agent({
                localAddress: sourceAddress,
                rejectUnauthorized: !disableTlsVerification,
            });
        }
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
                return new HttpsProxyAgent(proxy, {
                    rejectUnauthorized: !disableTlsVerification,
                    localAddress: sourceAddress,
                });
            case "socks":
            case "socks4":
            case "socks4a":
            case "socks5":
            case "socks5h": {
                this.logger.log(`Using SOCKS proxy: ${loggedProxy}`);
                const agent = new SocksProxyAgent(proxy);
                agent.options.localAddress = sourceAddress;
                agent.options.rejectUnauthorized = !disableTlsVerification;
                return agent;
            }
            default:
                this.logger.warn(`Unsupported proxy protocol: ${loggedProxy}`);
                return undefined;
        }
    }

    private getFetch(dispatcher: Agent | undefined): FetchFunction {
        return async (url: any, options: any): Promise<any> => {
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
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
        };
    }

    // Precondition: bgResp is valid
    private async genIT(doFetch: FetchFunction): Promise<void> {
        try {
            const { snapshot, webPoSignalOutput } = this.bgResp as BGSnapshotResult;
            const ITResp = await doFetch(buildURL("GenerateIT"), {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify([SessionManager.REQUEST_KEY, snapshot]),
            });
            const ITJson = (await ITResp.json()) as [
                string,
                number,
                number,
                string,
            ];
            const [
                integrityToken,
                estimatedTtlSecs,
                mintRefreshThreshold,
                websafeFallbackToken,
            ] = ITJson;
            const ITData = {
                integrityToken,
                estimatedTtlSecs,
                mintRefreshThreshold,
                websafeFallbackToken,
            };
            if (!integrityToken)
                throw new Error(
                    `Unexpected empty IT, IT Response: ${JSON.stringify(ITData)}`,
                );
            this.integrityTokenCache = {
                expiry: new Date(Date.now() + estimatedTtlSecs),
                integrityToken,
                minter: await BG.WebPoMinter.create(ITData, webPoSignalOutput),
            };
        } catch (e) {
            throw new Error(`Failed to generate an IT: ${e.message}`, {
                cause: e,
            });
        }
    }

    // Precondition: valid minter
    private async tryMintPOT(
        contentBinding: string,
    ): Promise<YoutubeSessionData> {
        try {
            const minter = this.integrityTokenCache.minter as BG.WebPoMinter;
            const poToken = await minter.mintAsWebsafeString(contentBinding);
            if (poToken) {
                this.logger.log(`poToken: ${poToken}`);
                const youtubeSessionData: YoutubeSessionData = {
                    contentBinding,
                    poToken,
                    expiresAt: new Date(
                        Date.now() + this.TOKEN_TTL_HOURS * 60 * 60 * 1000,
                    ),
                };
                this.youtubeSessionDataCaches[contentBinding] = youtubeSessionData;
                return youtubeSessionData;
            } else throw new Error("Unexpected empty POT");
        } catch (e) {
            throw new Error(
                `Failed to mint POT for ${contentBinding}: ${e.message}`,
                { cause: e },
            );
        }
    }

    async generatePoToken(
        contentBinding: string | undefined,
        proxy: string = "",
        bypassCache = false,
        sourceAddress: string | undefined = undefined,
        disableTlsVerification: boolean = false,
    ): Promise<YoutubeSessionData> {
        if (!contentBinding) {
            this.logger.error(
                "No content binding provided, generating visitor data via Innertube...",
            );
            const visitorData = await this.generateVisitorData();
            if (!visitorData) {
                this.logger.error(
                    "Unable to generate visitor data via Innertube",
                );
                throw new Error("Unable to generate visitor data");
            }
            contentBinding = visitorData;
        }

        this.cleanupCaches();
        let dispatcher: Agent | undefined;

        if (proxy) {
            dispatcher = this.getProxyDispatcher(
                proxy,
                sourceAddress,
                disableTlsVerification,
            );
        } else {
            dispatcher = this.getProxyDispatcher(
                process.env.HTTPS_PROXY ||
                    process.env.HTTP_PROXY ||
                    process.env.ALL_PROXY,
                sourceAddress,
                disableTlsVerification,
            );
        }
        const doFetch = this.getFetch(dispatcher);

        if (!bypassCache) {
            const sessionData = this.youtubeSessionDataCaches[contentBinding];
            if (sessionData) {
                this.logger.log(
                    `POT for ${contentBinding} still fresh, returning cached token`,
                );
                return sessionData;
            } else if (this.integrityTokenCache.expiry > new Date()) {
                this.logger.log(
                    `Integrity token is still fresh, minting POT for ${contentBinding}`,
                );
                return await this.tryMintPOT(contentBinding);
            } else if (this.bgResp) {
                this.logger.log("bgResp is available, generating a new IT");
                await this.genIT(doFetch);
                return await this.tryMintPOT(contentBinding);
            }
        }

        this.logger.log(`Generating POT for ${contentBinding}`);

        const bgConfig: BgConfig = {
            fetch: doFetch,
            globalObj: globalThis,
            identifier: contentBinding,
            requestKey: SessionManager.REQUEST_KEY,
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

        try {
            const bgClient = await BG.BotGuardClient.create({
                program: challenge.program,
                globalName: challenge.globalName,
                globalObj: bgConfig.globalObj,
            });
            const webPoSignalOutput: WebPoSignalOutput = [];
            const snapshot = await bgClient.snapshot({ webPoSignalOutput });
            this.bgResp = { snapshot, webPoSignalOutput };
        } catch (e) {
            throw new Error(
                `Failed to get botguard response. err.name = ${e.name}. err.message = ${e.message}. err.stack = ${e.stack}`,
                { cause: e },
            );
        }

        await this.genIT(doFetch);
        return await this.tryMintPOT(contentBinding);
    }
}
