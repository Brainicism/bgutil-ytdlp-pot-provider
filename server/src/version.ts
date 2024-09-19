import * as fs from "fs";
import * as path from "path";

const packageJson = fs.readFileSync(
    path.resolve(__dirname, "..", "package.json"),
    "utf8",
);
export const VERSION = JSON.parse(packageJson).version;
