import * as fs from "fs";
import * as path from "path";

const packageJson = fs.readFileSync(
    path.resolve(process.cwd(), "package.json"),
    "utf8",
);
export const VERSION = JSON.parse(packageJson).version;
