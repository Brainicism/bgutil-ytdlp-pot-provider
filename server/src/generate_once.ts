import { SessionManager, YoutubeSessionDataCaches } from "./session_manager";
import { Command } from "@commander-js/extra-typings";
import * as fs from "fs";
import * as path from "path";

const CACHE_PATH = path.resolve(process.cwd(), "cache.json");
const program = new Command()
    .option("-v, --visitor-data <visitordata>")
    .option("-d, --data-sync-id <data-sync-id>")
    .option("--verbose");

program.parse();
const options = program.opts();

(async () => {
    const dataSyncId = options.dataSyncId;
    const visitorData = options.visitorData;
    const verbose = options.verbose || false;
    let visitorIdentifier: string;
    let cache: YoutubeSessionDataCaches;
    try {
        const parsedCaches: YoutubeSessionDataCaches = JSON.parse(
            fs.readFileSync(CACHE_PATH, "utf8"),
        );
        for (const visitIdentifier in parsedCaches) {
            if (parsedCaches[visitIdentifier]) {
                const parsedDate = parsedCaches[visitIdentifier]
                    .generatedAt as string;
                parsedCaches[visitIdentifier].generatedAt = new Date(
                    parsedDate,
                );
            }
        }
        cache = parsedCaches;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
        cache = {};
    }

    const sessionManager = new SessionManager(verbose, cache);
    function log(msg: string) {
        sessionManager.log(msg);
    }

    if (dataSyncId) {
        log(`Received request for data sync ID: '${dataSyncId}'`);
        visitorIdentifier = dataSyncId;
    } else if (visitorData) {
        log(`Received request for visitor data: '${visitorData}'`);
        visitorIdentifier = visitorData;
    } else {
        log(`Received request for visitor data, grabbing from Innertube`);
        const generatedVisitorData = await sessionManager.generateVisitorData();
        if (!generatedVisitorData) process.exit(1);
        log(`Generated visitor data: ${generatedVisitorData}`);
        visitorIdentifier = generatedVisitorData;
    }

    const sessionData = await sessionManager.generatePoToken(visitorIdentifier);
    try {
        fs.writeFileSync(
            CACHE_PATH,
            JSON.stringify(sessionManager.getYoutubeSessionDataCaches(true)),
            "utf8",
        );
    } finally {
        console.log(JSON.stringify(sessionData));
    }
})();
