import { Agent } from "node:https";
import { ProxyAgent } from "proxy-agent";
import { Logger } from "./logger.ts";

export class ProxySpec {
    public proxyUrl?: URL;
    public sourceAddress?: string;
    public disableTlsVerification: boolean = false;
    public readonly ipFamily?: number;

    constructor({ sourceAddress, disableTlsVerification }: Partial<ProxySpec>) {
        this.sourceAddress = sourceAddress;
        this.disableTlsVerification = disableTlsVerification || false;
        if (!this.sourceAddress) {
            this.ipFamily = undefined;
        } else {
            this.ipFamily = this.sourceAddress?.includes(":") ? 6 : 4;
        }
    }

    public get proxy(): string | undefined {
        return this.proxyUrl?.href;
    }

    public set proxy(newProxy: string | undefined) {
        if (newProxy) {
            // Normalize and sanitize the proxy URL
            try {
                this.proxyUrl = new URL(newProxy);
            } catch {
                newProxy = `http://${newProxy}`;
                try {
                    this.proxyUrl = new URL(newProxy);
                } catch (e) {
                    throw new Error(`Invalid proxy URL: ${newProxy}`, {
                        cause: e,
                    });
                }
            }
        }
    }

    public asDispatcher(
        this: Readonly<this>,
        logger: Logger,
    ): Agent | undefined {
        const { proxyUrl, sourceAddress, disableTlsVerification } = this;
        if (!proxyUrl) {
            return new Agent({
                localAddress: sourceAddress,
                family: this.ipFamily,
                rejectUnauthorized: !disableTlsVerification,
            });
        }
        // Proxy must be a string as long as the URL is truthy
        const pxyStr = this.proxy!;
        const { password } = proxyUrl;

        const loggedProxy = password
            ? pxyStr.replace(password, "****")
            : pxyStr;

        logger.log(`Using proxy: ${loggedProxy}`);
        try {
            return new ProxyAgent({
                getProxyForUrl: () => pxyStr,
                localAddress: sourceAddress,
                family: this.ipFamily,
                rejectUnauthorized: !disableTlsVerification,
            });
        } catch (e) {
            throw new Error(`Failed to create proxy agent for ${loggedProxy}`, {
                cause: e,
            });
        }
    }
}
