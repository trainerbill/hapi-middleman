import * as glue from "glue";
import * as hapi from "hapi";
import * as mongoose from "mongoose";
import { manifest } from "./manifest";

export interface IWozuServer extends hapi.Server {
    wozu(): [{}];
}

async function startDatabase() {
    try {
        (mongoose as any).Promise = Promise;
        mongoose.set("debug", process.env.MONGOOSE_DEBUG ? true : false);
        await mongoose.connect(process.env.MONGOOSE_URI, { useMongoClient: true });
    } catch (err) {
        throw err;
    }
}

async function start() {
    try {
        // await startDatabase();
        server = await glue.compose(manifest);
        await server.start();
        server.log("info", `Database running at: ${process.env.MONGOOSE_URI}`);
        server.log("info", `Server running at: ${server.info.uri}`);
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
