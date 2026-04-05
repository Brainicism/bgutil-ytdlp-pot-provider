import { ProxySpec } from "./proxy_spec.ts";

export class CacheSpec {
    constructor(
        public pxySpec: ProxySpec,
        public ip: string | null,
    ) {}

    public get key(): string {
        return JSON.stringify(
            this.ip || [this.pxySpec.proxy, this.pxySpec.sourceAddress],
        );
    }
}
