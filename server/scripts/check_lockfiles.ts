// https://github.com/yt-dlp/ejs/blob/main/check.py
import * as path from "node:path";
import * as fs from "node:fs";

const serverHome = path.resolve(import.meta.dirname, "..");

// Returns true if the lockfile was updated, false otherwise
function downgradeLock(lockfile): boolean {
    const { version } = lockfile;
    if (version === "4") return true;
    if (version !== "5")
        throw new Error(`Invalid deno.lock version: ${version}`);
    console.log("blindly downgrading deno.lock from v5 to v4");
    lockfile.version = "4";
    return false;
}

function getDenoPkgs(lockfile) {
    const pkgs: Record<string, string> = {};
    const { version, npm } = lockfile;
    if (version !== "4" && version !== "5")
        throw new Error(`Unsupported deno.lock lockfile version ${version}`);

    for (const name in npm) {
        const { integrity } = npm[name];
        const other = pkgs[integrity];
        if (other && other !== name)
            throw new Error(
                `Duplicate integrity for ${name} and ${other}: ${integrity}`);
        pkgs[integrity] = name;
    }
    return pkgs;
}

function getNodePkgs(lockfile) {
    const pkgs: Record<string, string> = {};
    const { lockfileVersion: version , packages: npm } = lockfile;
    if (version !== 3)
        throw new Error(
            `Unsupported package-lock.json lockfile version ${version}`);

    for (const name in npm) {
        if (!name.length) continue;
        const module = name.split("node_modules/").pop();
        const { version, integrity } = npm[name];
        const pkgSpec = `${module}@${version}`;
        const other = pkgs[integrity];
        if (other && other !== pkgSpec)
            throw new Error(
                `Duplicate integrity for ${pkgSpec} and ${other}: ${integrity}`);
        pkgs[integrity] = pkgSpec;
    }
    return pkgs;
}

let exitCode = 0;
try {
    const denoPath = path.resolve(serverHome, "deno.lock");
    const denoLock = JSON.parse(fs.readFileSync(denoPath).toString());
    if (!downgradeLock(denoLock)) {
        fs.writeFileSync(denoPath, JSON.stringify(denoLock, null, 2) + "\n");
        exitCode = 1;
    }

    const denoPkgs = getDenoPkgs(denoLock);
    const nodePkgs = getNodePkgs(JSON.parse(fs.readFileSync(path.resolve(
        serverHome, "package-lock.json")).toString()));

    for (const denoIt in denoPkgs)
        if (!(denoIt in nodePkgs)) {
            exitCode = 1;
            console.log(`Deno extra: ${denoPkgs[denoIt]}, integrity ${denoIt}`);
        }

    for (const nodeIt in nodePkgs)
        if (!(nodeIt in denoPkgs)) {
            exitCode = 1;
            console.log(`Node extra: ${nodePkgs[nodeIt]}, integrity ${nodeIt}`);
        }
} catch (e) {
    console.error(`error checking lockfiles: ${e.message}`);
    exitCode = 1;
} finally {
    process.exit(exitCode);
}
