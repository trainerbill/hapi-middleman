import * as glue from "glue";
import * as hapi from "hapi";
import * as mongoose from "mongoose";
import { manifest } from "./manifest";

export interface IWozuServer extends hapi.Server {
    wozu(): [{}];
}

async function start() {
    try {
        // await startDatabase();
        server = await glue.compose(manifest);
        await server.start();
        server.log("info", `Servers running at: ${server.connections}`);
        server.log("info", JSON.stringify(server.wozu(), null, 2));
    } catch (err) {
        throw err;
    }
}

try {
    start();
} catch (err) {
    throw err;
}

export let server: IWozuServer;
