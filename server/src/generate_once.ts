import { SessionManager, YoutubeSessionDataCaches } from "./session_manager";
import { Command } from "@commander-js/extra-typings";
import * as fs from "fs";
import * as path from "path";

const CACHE_PATH = path.resolve(__dirname, "..", "cache.json");
const program = new Command()
    .option("-v, --visitor-data <visitordata>")
    .option("-d, --data-sync-id <data-sync-id>")
    .option("-p, --proxy <proxy-all>")
    .option("--verbose");

program.parse();
const options = program.opts();

(async () => {
    const visitorData = options.visitorData;
    const dataSyncId = options.dataSyncId;
    const proxy = options.proxy || "";
    const verbose = options.verbose || false;
    let visitIdentifier: string;
    const cache: YoutubeSessionDataCaches = {};
    if (fs.existsSync(CACHE_PATH)) {
        try {
            const parsedCaches = JSON.parse(
                fs.readFileSync(CACHE_PATH, "utf8"),
            );
            for (const visitIdentifier in parsedCaches) {
                const parsedCache = parsedCaches[visitIdentifier];
                if (parsedCache) {
                    cache[visitIdentifier] = {
                        poToken: parsedCache.poToken,
                        generatedAt: new Date(parsedCache.generatedAt),
                        visitIdentifier,
                    };
                }
            }
        } catch (e) {
            console.warn(`Error parsing cache. e = ${e}`);
        }
    }

    const sessionManager = new SessionManager(verbose, cache);
    function log(msg: string) {
        if (verbose) console.log(msg);
    }

    if (dataSyncId) {
        log(`Received request for data sync ID: '${dataSyncId}'`);
        visitIdentifier = dataSyncId;
    } else if (visitorData) {
        log(`Received request for visitor data: '${visitorData}'`);
        visitIdentifier = visitorData;
    } else {
        log(`Received request for visitor data, grabbing from Innertube`);
        const generatedVisitorData = await sessionManager.generateVisitorData();
        if (!generatedVisitorData) process.exit(1);
        log(`Generated visitor data: ${generatedVisitorData}`);
        visitIdentifier = generatedVisitorData;
    }

    const sessionData = await sessionManager.generatePoToken(
        visitIdentifier,
        proxy,
    );

    try {
        fs.writeFileSync(
            CACHE_PATH,
            JSON.stringify(sessionManager.getYoutubeSessionDataCaches(true)),
            "utf8",
        );
    } catch (e) {
        console.warn(`Error writing cache. e = ${e}`);
    } finally {
        console.log(JSON.stringify(sessionData));
    }
})();
