import { SessionManager } from "./session_manager";
import { Command } from "@commander-js/extra-typings";

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
    const sessionManager = new SessionManager(verbose);

    if (dataSyncId) {
        if (verbose) {
            console.log(`Received request for data sync ID: '${dataSyncId}'`);
        }
        visitorIdentifier = dataSyncId;
    } else if (visitorData) {
        if (verbose) {
            console.log(`Received request for visitor data: '${visitorData}'`);
        }
        visitorIdentifier = visitorData;
    } else {
        if (verbose) {
            console.log(
                `Received request for visitor data, grabbing from Innertube`,
            );
        }
        const generatedVisitorData = await sessionManager.generateVisitorData();
        if (!generatedVisitorData) {
            console.error("Error generating visitor data");
            process.exit(1);
        }

        if (verbose) {
            console.log(
                `Received request for visitor data, grabbing from Innertube`,
            );
            console.log(`Generated visitor data: ${generatedVisitorData}`);
        }

        visitorIdentifier = generatedVisitorData;
    }

    const sessionData = await sessionManager.generatePoToken(visitorIdentifier);
    console.log(JSON.stringify(sessionData));
})();
