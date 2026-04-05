import {
    BG,
    BgConfig,
    WebPoSignalOutput,
    buildURL,
    getHeaders,
} from "bgutils-js";
import { Context as InnertubeContext } from "youtubei.js";
import { ChallengeData, ChallengeService } from "./challenge_service.ts";
import { Logger } from "./logger.ts";
import { YoutubeSessionData, YoutubeSessionDataCaches } from "./session_types.ts";

export type TokenMinter = {
    expiry: Date;
    integrityToken: string;
    minter: BG.WebPoMinter;
};

export type MinterCache = Map<string, TokenMinter>;

export class TokenMinterService {
    constructor(
        private logger: Logger,
        private challengeService: ChallengeService,
        private minterCache: MinterCache,
        private tokenTtlHours: number,
        private requestKey: string,
    ) {}

    public async generateTokenMinter(
        cacheKey: string,
        bgConfig: BgConfig,
        challenge?: ChallengeData,
        innertubeContext?: InnertubeContext,
    ): Promise<TokenMinter> {
        const descrambledChallenge =
            await this.challengeService.getDescrambledChallenge(
                bgConfig,
                challenge,
                innertubeContext,
            );

        const { program, globalName } = descrambledChallenge;
        const interpreterJavascript =
            descrambledChallenge.interpreterJavascript
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
            throw new Error(`Failed to create BG client.`, { cause: e });
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
                    body: JSON.stringify([this.requestKey, botguardResponse]),
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

            const tokenMinter: TokenMinter = {
                expiry: new Date(Date.now() + estimatedTtlSecs * 1000),
                integrityToken,
                minter: await BG.WebPoMinter.create(
                    integrityTokenData,
                    webPoSignalOutput,
                ),
            };
            this.minterCache.set(cacheKey, tokenMinter);
            return tokenMinter;
        } catch (e) {
            throw new Error(`Failed to generate an integrity token.`, {
                cause: e,
            });
        }
    }

    public async tryMintPOT(
        contentBinding: string,
        tokenMinter: TokenMinter,
        youtubeSessionDataCaches?: YoutubeSessionDataCaches,
    ): Promise<YoutubeSessionData> {
        this.logger.log(`Generating POT for ${contentBinding}`);
        try {
            const poToken =
                await tokenMinter.minter.mintAsWebsafeString(contentBinding);
            if (poToken) {
                this.logger.log(`poToken: ${poToken}`);
                const youtubeSessionData: YoutubeSessionData = {
                    contentBinding,
                    poToken,
                    expiresAt: new Date(
                        Date.now() + this.tokenTtlHours * 60 * 60 * 1000,
                    ),
                };
                if (youtubeSessionDataCaches)
                    youtubeSessionDataCaches[contentBinding] =
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
}
