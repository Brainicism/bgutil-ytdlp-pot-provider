const fs = require("node:fs");
const path = require("node:path");

// Extract arguments after 'node' and 'script-name'
const rawArgs = process.argv.slice(2);

// Find the position of the double-dash
const dashIndex = rawArgs.indexOf("--");

// Arguments before -- are flags; arguments after are always targets
const flagArgs =
    -1 !== dashIndex
        ? rawArgs.slice(0, dashIndex)
        : rawArgs.filter((a) => a.startsWith("-"));
const targetArgs =
    -1 !== dashIndex
        ? rawArgs.slice(1 + dashIndex)
        : rawArgs.filter((a) => !a.startsWith("-"));

const isRecursive = flagArgs.some((f) => f.includes("r"));
const isForce = flagArgs.some((f) => f.includes("f"));

// Refuse to run without an argument
if (targetArgs.length === 0) {
    console.error("Hint: At least one target directory or file is required.");
    console.error("rmv: missing operand");
    process.exit(1);
}

function rmv(p, topLevel = true) {
    if (!fs.existsSync(p)) {
        if (!isForce && topLevel) {
            console.error(
                `rmv: cannot remove '${p}': No such file or directory`,
            );
            process.exit(1);
        }
        return;
    }

    const stats = fs.lstatSync(p);
    if (stats.isDirectory()) {
        if (!isRecursive) {
            console.error(`rmv: cannot remove '${p}': Is a directory`);
            process.exit(1);
        }
        // Walk tree for verbose logging matching 'rm -v'
        fs.readdirSync(p).forEach((file) => rmv(path.join(p, file), false));
    }

    // Final removal and verbose log:
    // This mimics 'rm -v' by logging immediately before removal
    console.log(`removed '${p}'`);
    // Synchronous removal for build script reliability
    fs.rmSync(p, { recursive: isRecursive, force: isForce });
}

// Support multiple arguments like a real CLI tool
targetArgs.forEach((t) => rmv(t));
