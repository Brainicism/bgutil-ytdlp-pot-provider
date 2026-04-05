import { BgConfig, DescrambledChallenge, getHeaders } from "bgutils-js";
import { Context as InnertubeContext } from "youtubei.js";
import { Logger } from "./logger.ts";

export type ChallengeData = {
    interpreterUrl: {
        privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string;
    };
    interpreterHash: string;
    program: string;
    globalName: string;
    clientExperimentsStateBlob: string;
};

export class ChallengeService {
    constructor(private logger: Logger) {}

    public async getDescrambledChallenge(
        bgConfig: BgConfig,
        challenge?: ChallengeData,
        innertubeContext?: InnertubeContext,
    ): Promise<DescrambledChallenge> {
        try {
            if (!challenge) {
                this.logger.debug("Using challenge from /att/get");
                const attGetResponse = await bgConfig.fetch(
                    "https://www.youtube.com/youtubei/v1/att/get?prettyPrint=false",
                    {
                        method: "POST",
                        headers: {
                            ...getHeaders(),
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            context: innertubeContext || {
                                client: {
                                    clientName: "WEB",
                                    clientVersion: "2.20260227.01.00",
                                },
                            },
                            engagementType: "ENGAGEMENT_TYPE_UNBOUND",
                        }),
                    },
                );
                const attestation = await attGetResponse.json();
                if (!attestation)
                    throw new Error("Failed to get challenge from /att/get");
                challenge = attestation.bgChallenge as ChallengeData;
            } else {
                this.logger.debug("Using challenge from the webpage");
            }
            const { program, globalName, interpreterHash } = challenge;
            const { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue } =
                challenge.interpreterUrl;
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
        } catch (e) {
            throw new Error("Could not get BotGuard challenge", { cause: e });
        }
    }
}
