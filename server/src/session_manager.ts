import { BgConfig, FetchFunction, USER_AGENT } from "bgutils-js";
import { JSDOM } from "jsdom";
import { Innertube, Context as InnertubeContext } from "youtubei.js";
import { CacheSpec } from "./cache_spec.ts";
import { CacheStore } from "./cache_store.ts";
import { ChallengeData, ChallengeService } from "./challenge_service.ts";
import { Logger } from "./logger.ts";
import { NetworkClient } from "./network_client.ts";
import { ProxySpec } from "./proxy_spec.ts";
import { MinterCache, TokenMinterService } from "./token_minter_service.ts";
import {
    YoutubeSessionData,
    YoutubeSessionDataCaches,
} from "./session_types.ts";

export class SessionManager {
    // hardcoded API key that has been used by youtube for years
    private static readonly REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
    private static hasDom = false;
    private TOKEN_TTL_HOURS: number;
    private logger: Logger;
    private caches: CacheStore;
    private networkClient: NetworkClient;
    private challengeService: ChallengeService;
    private tokenMinterService: TokenMinterService;

    constructor(
        shouldLog = true,
        // This needs to be reworked as POTs are IP-bound
        youtubeSessionDataCaches?: YoutubeSessionDataCaches,
    ) {
        this.logger = new Logger(shouldLog);
        this.caches = new CacheStore(youtubeSessionDataCaches);
        this.networkClient = new NetworkClient(this.logger);
        this.challengeService = new ChallengeService(this.logger);
        this.TOKEN_TTL_HOURS = process.env.TOKEN_TTL
            ? parseInt(process.env.TOKEN_TTL)
            : 6;
        this.tokenMinterService = new TokenMinterService(
            this.logger,
            this.challengeService,
            this.caches.minterCache,
            this.TOKEN_TTL_HOURS,
            SessionManager.REQUEST_KEY,
        );
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
        this.caches.invalidateCaches();
    }

    public invalidateIT() {
        this.caches.invalidateIT();
    }

    public cleanupCaches() {
        this.caches.cleanupCaches();
    }

    public getYoutubeSessionDataCaches(cleanup = false) {
        return this.caches.getYoutubeSessionDataCaches(cleanup);
    }

    public setYoutubeSessionDataCaches(
        youtubeSessionData?: YoutubeSessionDataCaches,
    ) {
        this.caches.setYoutubeSessionDataCaches(youtubeSessionData);
    }

    public get minterCache(): MinterCache {
        return this.caches.minterCache;
    }

    private getFetch(
        proxySpec: ProxySpec,
        maxRetries: number,
        intervalMs: number,
    ): FetchFunction {
        return this.networkClient.getFetch(proxySpec, maxRetries, intervalMs);
    }

    async generatePoToken(
        contentBinding: string | undefined,
        proxy: string = "",
        bypassCache = false,
        sourceAddress: string | undefined = undefined,
        disableTlsVerification: boolean = false,
        challenge: ChallengeData | undefined = undefined,
        innertubeContext?: InnertubeContext,
    ): Promise<YoutubeSessionData> {
        this.cleanupCaches();

        const pxySpec = new ProxySpec({
            sourceAddress,
            disableTlsVerification,
        });
        if (proxy) {
            pxySpec.proxy = proxy;
        } else {
            pxySpec.proxy =
                process.env.HTTPS_PROXY ||
                process.env.HTTP_PROXY ||
                process.env.ALL_PROXY;
        }

        const cacheSpec = new CacheSpec(
            pxySpec,
            innertubeContext?.client.remoteHost || null,
        );

        const bgFetch = this.getFetch(pxySpec, 3, 5000);
        let innertube: Innertube | undefined = undefined;
        if (!contentBinding && innertubeContext) {
            this.logger.warn(
                "No content binding provided, using the one from the supplied Innertube context...",
            );
            contentBinding = innertubeContext.client.visitorData;
        }

        if (!contentBinding) {
            this.logger.warn(
                "No content binding provided, generating visitor data via Innertube...",
            );
            innertube = await Innertube.create({
                retrieve_player: false,
                fetch: bgFetch,
            });
            contentBinding = innertube.session.context.client.visitorData;
        }

        if (!contentBinding) throw new Error("Unable to generate visitor data");

        if (!innertubeContext) innertubeContext = innertube?.session.context;

        const bgConfig: BgConfig = {
            fetch: bgFetch,
            globalObj: globalThis,
            identifier: contentBinding,
            requestKey: SessionManager.REQUEST_KEY,
        };

        if (!bypassCache) {
            const caches = this.caches.getYoutubeSessionDataCaches();
            if (caches) {
                const sessionData = caches[contentBinding];
                if (sessionData) {
                    this.logger.log(
                        `POT for ${contentBinding} still fresh, returning cached token`,
                    );
                    return sessionData;
                }
            }
            let tokenMinter = this.caches.minterCache.get(cacheSpec.key);
            if (tokenMinter) {
                // Replace minter if expired
                if (new Date() >= tokenMinter.expiry) {
                    this.logger.log("POT minter expired, getting a new one");
                    tokenMinter =
                        await this.tokenMinterService.generateTokenMinter(
                            cacheSpec.key,
                            bgConfig,
                            challenge,
                            innertubeContext,
                        );
                }
                return await this.tokenMinterService.tryMintPOT(
                    contentBinding,
                    tokenMinter,
                    this.caches.getYoutubeSessionDataCaches(),
                );
            }
        }

        const tokenMinter = await this.tokenMinterService.generateTokenMinter(
            cacheSpec.key,
            bgConfig,
            challenge,
            innertubeContext,
        );
        return await this.tokenMinterService.tryMintPOT(
            contentBinding,
            tokenMinter,
            this.caches.getYoutubeSessionDataCaches(),
        );
    }
}
