const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const TARGET_VERSION = "v20.18.0";

const WIN_NODE_WRAPPER = "@echo off\r\n" +
    `if "%~1"=="--version" (echo ${TARGET_VERSION} & exit /b 0)\r\n` +
    "deno run -A %*";

const POSIX_NODE_WRAPPER = "#!/usr/bin/env sh\n" +
    `if [ "1:--version" = "$#:$1" ]; then echo "${TARGET_VERSION}"; exit 0; fi\n` +
    "exec deno run -A \"$@\"";

const isWin = "win32" === process.platform;
const args = process.argv.slice(2);
const tool = args[0];

function writeNodeWrapper(wrapperPath) {
    let shouldUpdate = !fs.existsSync(wrapperPath);

    if (!shouldUpdate) {
        const content = fs.readFileSync(wrapperPath, "utf8");
        if (!content.includes(TARGET_VERSION)) {
            shouldUpdate = true;
        }
    }

    if (shouldUpdate) {
        const content = isWin ? WIN_NODE_WRAPPER : POSIX_NODE_WRAPPER;
        fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
    }
}

function setupEnv() {
    process.env.NO_COLOR = "1";
    process.env.DO_NOT_TRACK = "1";
    process.env.DENO_NO_UPDATE_CHECK = "1";
    process.env.DENO_NO_PROMPT = "1";
    process.env.NO_UPDATE_NOTIFIER = "1";
    process.env.NPM_CONFIG_UPDATE_NOTIFIER = "false";

    const wrapperDir = path.join(process.cwd(), "node_modules", ".wrapper");
    if (!fs.existsSync(wrapperDir)) {
        fs.mkdirSync(wrapperDir, { recursive: true });
    }

    const nodeWrapperPath = path.join(wrapperDir, isWin ? "node.cmd" : "node");
    writeNodeWrapper(nodeWrapperPath);

    const sep = isWin ? ";" : ":";
    process.env.PATH = `${process.env.PATH}${sep}${wrapperDir}`;
}

function findLocalBin(startPath, toolName) {
    let current = path.resolve(startPath);
    const root = path.parse(current).root;

    while (true) {
        const binDir = path.join(current, "node_modules", ".bin");
        const binPath = path.join(binDir, toolName);
        const winBinPath = `${binPath}.cmd`;

        if (fs.existsSync(binPath)) return binPath;
        if (isWin && fs.existsSync(winBinPath)) return winBinPath;

        if (root === current) break;
        current = path.dirname(current);
    }
    return null;
}

function runLocalFallback() {
    const localBin = findLocalBin(process.cwd(), tool);

    if (localBin) {
        return exit(exec(localBin, args.slice(1)));
    }

    if (canRun(tool)) {
        return exit(exec(tool, args.slice(1)));
    }

    process.exit(1);
}

function run() {
    if (!tool) return;
    setupEnv();

    // 1. Priority: System npx
    if (canRun("npx")) return exit(exec("npx", args));

    // 2. Registry Fallbacks
    if (canRun("pnpm")) return exit(exec("pnpm", ["dlx", "npx", ...args]));

    if ("undefined" !== typeof Bun || canRun("bun")) {
        return exit(exec("bun", ["x", "--bun", "npx", ...args]));
    }

    if ("undefined" !== typeof Deno || canRun("deno")) {
        return exit(exec("deno", ["run", "-A", "npm:npx", ...args]));
    }

    // 3. Local/Monorepo Search -> Global PATH
    runLocalFallback();
}

function canRun(cmd) {
    try {
        const checkCmd = isWin ? "where" : "which";
        return (
            0 ===
            spawnSync(checkCmd, [cmd], { stdio: "ignore", shell: isWin }).status
        );
    } catch {
        return false;
    }
}

function exec(cmd, params) {
    return spawnSync(cmd, params, {
        env: process.env,
        shell: isWin,
        stdio: "inherit",
    });
}

function exit(result) {
    process.exit(result.status ?? 0);
}

run();
