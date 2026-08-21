import { BgError } from "bgutils-js/utils";

export const VERSION = "1.3.2";

export function strerror(e: any, update?: boolean): string {
    const msg =
        e instanceof BgError
            ? `BgError: ${e.message} (info: ${JSON.stringify(e.info)})`
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
