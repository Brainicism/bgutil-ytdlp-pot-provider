export interface YoutubeSessionData {
    poToken: string;
    contentBinding: string;
    expiresAt: Date;
}

export interface YoutubeSessionDataCaches {
    [contentBinding: string]: YoutubeSessionData;
}
