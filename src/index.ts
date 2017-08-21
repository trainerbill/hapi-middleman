import * as glue from "glue";
import * as hapi from "hapi";
import * as mongoose from "mongoose";
import { manifest } from "./manifest";

export interface IWozuServer extends hapi.Server {
    wozu(): [{}];
}

async function start() {
    try {
        const server = await glue.compose(manifest);
        await server.start();
        server.log(
            "info",
            // tslint:disable-next-line:max-line-length
            `Servers running at:  ${server.connections.map((connection: any) => connection.info.uri).join(", ")}`,
        );
    } catch (err) {
        throw err;
    }
}

try {
    start();
} catch (err) {
    throw err;
}

// export let server: IWozuServer;
