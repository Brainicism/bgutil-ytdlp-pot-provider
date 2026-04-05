import { BGError } from "bgutils-js";
import * as fs from "node:fs";
import * as path from "node:path";

const packageJson = JSON.parse(
    fs.readFileSync(
        path.resolve(import.meta.dirname, "..", "package.json"),
        "utf-8",
    ),
);
export const VERSION: string = packageJson.version;

export function strerror(e: any, update?: boolean): string {
    const msg =
        e instanceof BGError
            ? `BGError(${e.code}): ${e.message} (info: ${JSON.stringify(e.info)})`
            : e instanceof Error
              ? `${e.name}: ${e.message}` +
                (e.cause && e.cause !== e
                    ? ` (caused by ${strerror(e.cause)})`
                    : "")
              : `Unknown error: ${JSON.stringify(e)}`;
    if (update) {
        const idx = msg.indexOf(": ");
        e.message = idx == -1 ? msg : msg.slice(idx + 2);
    }
    return msg;
}
