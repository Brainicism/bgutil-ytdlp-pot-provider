import axios, { AxiosRequestConfig } from "axios";
import { FetchFunction } from "bgutils-js";
import { Logger } from "./logger.ts";
import { ProxySpec } from "./proxy_spec.ts";

export class NetworkClient {
    constructor(private logger: Logger) {}

    public getFetch(
        proxySpec: ProxySpec,
        maxRetries: number,
        intervalMs: number,
    ): FetchFunction {
        return async (url: any, options: any): Promise<any> => {
            const method = (options?.method || "GET").toUpperCase();
            for (let attempts = 1; attempts <= maxRetries; attempts++) {
                try {
                    const axiosOpt: AxiosRequestConfig = {
                        headers: options?.headers,
                        params: options?.params,
                        httpsAgent: proxySpec.asDispatcher(this.logger),
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
                            `Error reaching ${method} ${url}: All ${attempts} retries failed.`,
                            { cause: e },
                        );
                    await new Promise((resolve) =>
                        setTimeout(resolve, intervalMs),
                    );
                }
            }
        };
    }
}
