import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const serverHome = path.resolve(import.meta.dirname, "..");

let exitCode = 0;

function getVersion(filePath: string, extract: (content: string) => string | null, label: string): string | null {
    const content = fs.readFileSync(filePath, "utf-8");
    const version = extract(content);
    if (!version) {
        console.error(`Could not extract version from ${label} (${filePath})`);
        exitCode = 1;
    }
    return version;
}

// 1. plugin/yt_dlp_plugins/extractor/getpot_bgutil.py — __version__
const pyVersion = getVersion(
    path.resolve(repoRoot, "plugin/yt_dlp_plugins/extractor/getpot_bgutil.py"),
    (content) => content.match(/__version__\s*=\s*'([^']+)'/)?.[1] ?? null,
    "Python plugin __version__",
);

// 2. server/package.json — version
const pkgVersion = getVersion(
    path.resolve(serverHome, "package.json"),
    (content) => JSON.parse(content).version ?? null,
    "server/package.json",
);

// 3. README.md — git clone --single-branch --branch <version>
const readmeVersion = getVersion(
    path.resolve(repoRoot, "README.md"),
    (content) =>
        content.match(
            /git clone --single-branch --branch ([^\s]+)/,
        )?.[1] ?? null,
    "README.md (branch tag)",
);

const versions = [
    { label: "Python plugin (__version__)", version: pyVersion },
    { label: "server/package.json", version: pkgVersion },
    { label: "README.md (branch tag)", version: readmeVersion },
];

console.log("Version sources:");
for (const { label, version } of versions) {
    console.log(`  ${label}: ${version ?? "NOT FOUND"}`);
}

const found = versions.filter((v) => v.version !== null);
const unique = new Set(found.map((v) => v.version));
if (unique.size > 1) {
    console.error("\nVersion mismatch detected!");
    exitCode = 1;
} else if (unique.size === 1) {
    console.log(`\nAll versions match: ${[...unique][0]}`);
} else {
    console.error("\nNo versions could be extracted.");
    exitCode = 1;
}

process.exit(exitCode);
