import { MinterCache } from "./token_minter_service.ts";
import { YoutubeSessionDataCaches } from "./session_types.ts";

export class CacheStore {
    private _minterCache: MinterCache = new Map();

    constructor(private youtubeSessionDataCaches?: YoutubeSessionDataCaches) {}

    public invalidateCaches() {
        this.youtubeSessionDataCaches = undefined;
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
        youtubeSessionData?: YoutubeSessionDataCaches,
    ) {
        this.youtubeSessionDataCaches = youtubeSessionData;
    }

    public get minterCache(): MinterCache {
        return this._minterCache;
    }
}
