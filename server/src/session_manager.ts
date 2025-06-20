import {
    BG,
    BgConfig,
    DescrambledChallenge,
    WebPoSignalOutput,
    FetchFunction,
    buildURL,
    getHeaders,
    USER_AGENT,
} from "bgutils-js";
import { JSDOM } from "jsdom";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios, { AxiosRequestConfig } from "axios";
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

class ProxySpec {
    public proxy?: string;
    public sourceAddress?: string;
    public disableTlsVerification: boolean = false;
    constructor({
        proxy,
        sourceAddress,
        disableTlsVerification,
    }: Partial<ProxySpec>) {
        this.proxy = proxy;
        this.sourceAddress = sourceAddress;
        this.disableTlsVerification = disableTlsVerification || false;
    }
    toString(): string {
        return JSON.stringify([this.proxy, this.sourceAddress]);
    }
    asDispatcher(logger: Logger): Agent | undefined {
        const { proxy, sourceAddress, disableTlsVerification } = this;
        let sanitizedProxy = proxy;
        if (!sanitizedProxy) {
            return new Agent({
                localAddress: sourceAddress,
                rejectUnauthorized: !disableTlsVerification,
            });
        }
        let protocol: string;
        try {
            const parsedUrl = new URL(sanitizedProxy);
            protocol = parsedUrl.protocol.replace(":", "");
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            // assume http if no protocol was passed
            protocol = "http";
            sanitizedProxy = `http://${sanitizedProxy}`;
        }

        let loggedProxy: string = sanitizedProxy;
        try {
            const parsedUrl = new URL(sanitizedProxy);
            if (parsedUrl.password) {
                loggedProxy = sanitizedProxy.replace(
                    parsedUrl.password,
                    "****",
                );
            }
        } catch (e) {
            logger.warn(`Fail to parse proxy url ${sanitizedProxy}: ${e}`);
            return undefined;
        }

        switch (protocol) {
            case "http":
            case "https":
                logger.log(`Using HTTP/HTTPS proxy: ${loggedProxy}`);
                return new HttpsProxyAgent(sanitizedProxy, {
                    rejectUnauthorized: !disableTlsVerification,
                    localAddress: sourceAddress,
                });
            case "socks":
            case "socks4":
            case "socks4a":
            case "socks5":
            case "socks5h": {
                logger.log(`Using SOCKS proxy: ${loggedProxy}`);
                const agent = new SocksProxyAgent(sanitizedProxy);
                agent.options.localAddress = sourceAddress;
                agent.options.rejectUnauthorized = !disableTlsVerification;
                return agent;
            }
            default:
                logger.warn(`Unsupported proxy protocol: ${loggedProxy}`);
                return undefined;
        }
    }
}

type CachedTokenMinter = {
    expiry: Date;
    integrityToken: string;
    minter: BG.WebPoMinter;
};

type MinterCache = Map<string, CachedTokenMinter>;

export type ChallengeData = {
    interpreterUrl: {
        privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string;
    };
    interpreterHash: string;
    program: string;
    globalName: string;
    clientExperimentsStateBlob: string;
};

export class SessionManager {
    // hardcoded API key that has been used by youtube for years
    private static readonly REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
    private static hasDom = false;
    private _minterCache: MinterCache = new Map();
    // This needs to be reworked as POTs are IP-bound
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
        if (!SessionManager.hasDom) {
            const dom = new JSDOM(
                '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
                {
                    url: "https://www.youtube.com/",
                    referrer: "https://www.youtube.com/",
                    userAgent: USER_AGENT,
                },
            );

            Object.assign(globalThis, {
                window: dom.window,
                document: dom.window.document,
                location: dom.window.location,
                origin: dom.window.origin,
            });

            if (!Reflect.has(globalThis, "navigator")) {
                Object.defineProperty(globalThis, "navigator", {
                    value: dom.window.navigator,
                });
            }
            SessionManager.hasDom = true;
        }
    }

    public invalidateCaches() {
        this.setYoutubeSessionDataCaches();
        this._minterCache.clear();
    }

    public invalidateIT() {
        this._minterCache.forEach((minterCache) => {
            minterCache.expiry = new Date(0);
        });
    }

    public cleanupCaches() {
        for (const contentBinding in this.youtubeSessionDataCaches) {
            const sessionData = this.youtubeSessionDataCaches[contentBinding];
            if (sessionData && new Date() > sessionData.expiresAt)
                delete this.youtubeSessionDataCaches[contentBinding];
        }
    }

    public getYoutubeSessionDataCaches(cleanup = false) {
        if (cleanup) this.cleanupCaches();
        return this.youtubeSessionDataCaches;
    }

    public setYoutubeSessionDataCaches(
        youtubeSessionData: YoutubeSessionDataCaches = {},
    ) {
        this.youtubeSessionDataCaches = youtubeSessionData || {};
    }

    public async generateVisitorData(): Promise<string | null> {
        const innertube = await Innertube.create({ retrieve_player: false });
        const visitorData = innertube.session.context.client.visitorData;
        if (!visitorData) {
            this.logger.error("Unable to generate visitor data via Innertube");
            return null;
        }

        return visitorData;
    }

    public get minterCache(): MinterCache {
        return this._minterCache;
    }

    private async getAttestation(
        bgConfig: BgConfig,
        attestation?: ChallengeData,
    ): Promise<DescrambledChallenge> {
        if (attestation) {
            const { program, globalName, interpreterHash } = attestation;
            const { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue } =
                attestation.interpreterUrl;
            const interpreterJSResponse = await bgConfig.fetch(
                `https:${privateDoNotAccessOrElseTrustedResourceUrlWrappedValue}`,
            );
            const interpreterJS = await interpreterJSResponse.text();
            return {
                program,
                globalName,
                interpreterHash,
                interpreterJavascript: {
                    privateDoNotAccessOrElseSafeScriptWrappedValue:
                        interpreterJS,
                    privateDoNotAccessOrElseTrustedResourceUrlWrappedValue,
                },
            };
        } else {
            try {
                const challenge = await BG.Challenge.create(bgConfig);
                if (challenge) return challenge;
            } catch (e) {
                throw new Error(
                    `Error while attempting to retrieve BG challenge. err = ${JSON.stringify(e)}`,
                    { cause: e },
                );
            }
            throw new Error("Could not get Botguard challenge");
        }
    }

    private async generateTokenMinter(
        pxySpec: ProxySpec,
        bgConfig: BgConfig,
        attestation?: ChallengeData,
    ): Promise<CachedTokenMinter> {
        const challenge = await this.getAttestation(bgConfig, attestation);

        const { program, globalName } = challenge;
        const interpreterJavascript =
            challenge.interpreterJavascript
                .privateDoNotAccessOrElseSafeScriptWrappedValue;

        if (interpreterJavascript) {
            new Function(interpreterJavascript)();
        } else throw new Error("Could not load VM");

        let bgClient: BG.BotGuardClient;
        try {
            bgClient = await BG.BotGuardClient.create({
                program,
                globalName,
                globalObj: bgConfig.globalObj,
            });
        } catch (e) {
            throw new Error(
                `Failed to create BG client. err.name = ${e.name}. err.message = ${e.message}. err.stack = ${e.stack}`,
                { cause: e },
            );
        }
        try {
            const webPoSignalOutput: WebPoSignalOutput = [];
            const botguardResponse = await bgClient.snapshot({
                webPoSignalOutput,
            });
            const integrityTokenResp = await bgConfig.fetch(
                buildURL("GenerateIT"),
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify([
                        SessionManager.REQUEST_KEY,
                        botguardResponse,
                    ]),
                },
            );

            const [
                integrityToken,
                estimatedTtlSecs,
                mintRefreshThreshold,
                websafeFallbackToken,
            ] = (await integrityTokenResp.json()) as [
                string,
                number,
                number,
                string,
            ];

            const integrityTokenData = {
                integrityToken,
                estimatedTtlSecs,
                mintRefreshThreshold,
                websafeFallbackToken,
            };

            if (!integrityToken)
                throw new Error(
                    `Unexpected empty integrity token, response: ${JSON.stringify(integrityTokenData)}`,
                );
            this.logger.debug(
                `Generated IntegrityToken: ${JSON.stringify(integrityTokenData)}`,
            );

            const cachedTokenMinter: CachedTokenMinter = {
                expiry: new Date(Date.now() + estimatedTtlSecs * 1000),
                integrityToken,
                minter: await BG.WebPoMinter.create(
                    integrityTokenData,
                    webPoSignalOutput,
                ),
            };
            this._minterCache.set(pxySpec.toString(), cachedTokenMinter);
            return cachedTokenMinter;
        } catch (e) {
            throw new Error(
                `Failed to generate an integrity token: ${e.message}`,
                {
                    cause: e,
                },
            );
        }
    }

    private async tryMintPOT(
        contentBinding: string,
        cachedTokenMinter: CachedTokenMinter,
    ): Promise<YoutubeSessionData> {
        this.logger.log(`Generating POT for ${contentBinding}`);
        try {
            const poToken =
                await cachedTokenMinter.minter.mintAsWebsafeString(
                    contentBinding,
                );
            if (poToken) {
                this.logger.log(`poToken: ${poToken}`);
                const youtubeSessionData: YoutubeSessionData = {
                    contentBinding,
                    poToken,
                    expiresAt: new Date(
                        Date.now() + this.TOKEN_TTL_HOURS * 60 * 60 * 1000,
                    ),
                };
                this.youtubeSessionDataCaches[contentBinding] =
                    youtubeSessionData;
                return youtubeSessionData;
            } else throw new Error("Unexpected empty POT");
        } catch (e) {
            throw new Error(
                `Failed to mint POT for ${contentBinding}: ${e.message}`,
                { cause: e },
            );
        }
    }

    private getFetch(
        proxySpec: ProxySpec,
        maxRetries: number,
        intervalMs: number,
    ): FetchFunction {
        const { logger } = this;
        return async (url: any, options: any): Promise<any> => {
            const method = (options?.method || "GET").toUpperCase();
            for (let attempts = 1; attempts <= maxRetries; attempts++) {
                try {
                    const axiosOpt: AxiosRequestConfig = {
                        headers: options?.headers,
                        params: options?.params,
                        httpsAgent: proxySpec.asDispatcher(logger),
                    };
                    const response = await (method === "GET"
                        ? axios.get(url, axiosOpt)
                        : axios.post(url, options?.body, axiosOpt));

                    return {
                        ok: response.status >= 200 && response.status < 300,
                        status: response.status,
                        json: async () => response.data,
                        text: async () =>
                            typeof response.data === "string"
                                ? response.data
                                : JSON.stringify(response.data),
                    };
                } catch (e) {
                    if (attempts >= maxRetries)
                        throw new Error(
                            `Error reaching ${method} ${url}: All ${attempts} retries failed: ${e}`,
                        );
                    await new Promise((resolve) =>
                        setTimeout(resolve, intervalMs),
                    );
                }
            }
        };
    }

    async generatePoToken(
        contentBinding: string | undefined,
        proxy: string = "",
        bypassCache = false,
        sourceAddress: string | undefined = undefined,
        disableTlsVerification: boolean = false,
        attestation: ChallengeData | undefined = undefined,
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

        let pxySpec: ProxySpec;
        if (proxy) {
            pxySpec = new ProxySpec({
                proxy,
                sourceAddress,
                disableTlsVerification,
            });
        } else {
            pxySpec = new ProxySpec({
                proxy:
                    process.env.HTTPS_PROXY ||
                    process.env.HTTP_PROXY ||
                    process.env.ALL_PROXY,
                sourceAddress,
                disableTlsVerification,
            });
        }

        const bgConfig: BgConfig = {
            fetch: this.getFetch(pxySpec, 3, 5000),
            globalObj: globalThis,
            identifier: contentBinding,
            requestKey: SessionManager.REQUEST_KEY,
        };

        if (!bypassCache) {
            const sessionData = this.youtubeSessionDataCaches[contentBinding];
            if (sessionData) {
                this.logger.log(
                    `POT for ${contentBinding} still fresh, returning cached token`,
                );
                return sessionData;
            }
            let cachedTokenMinter = this._minterCache.get(pxySpec.toString());
            if (cachedTokenMinter) {
                // Replace minter if expired
                if (new Date() >= cachedTokenMinter.expiry) {
                    this.logger.log("POT minter expired, getting a new one");
                    cachedTokenMinter = await this.generateTokenMinter(
                        pxySpec,
                        bgConfig,
                        attestation,
                    );
                }
                return await this.tryMintPOT(contentBinding, cachedTokenMinter);
            }
        }

        const tokenMinter = await this.generateTokenMinter(
            pxySpec,
            bgConfig,
            attestation,
        );
        return await this.tryMintPOT(contentBinding, tokenMinter);
    }
}
