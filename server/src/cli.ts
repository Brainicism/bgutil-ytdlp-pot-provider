import { Command } from "commander";

export type ServerOptions = {
    port: number;
};

export function parseServerOptions(): ServerOptions {
    const program = new Command().option("-p, --port <PORT>").parse();
    const options = program.opts();
    const parsedPort = options.port ? parseInt(options.port, 10) : NaN;
    return {
        port: Number.isNaN(parsedPort) ? 4416 : parsedPort,
    };
}
