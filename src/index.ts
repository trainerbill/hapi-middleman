import * as dotenv from "dotenv";
import * as Hapi from "hapi";
import * as mongoose from "mongoose";
import initPlugins from "./plugins";

interface IWozuServer extends Hapi.Server {
    wozu(): [{}];
}

async function startDatabase() {
    try {
        (mongoose as any).Promise = Promise;
        mongoose.set("debug", process.env.MONGOOSE_DEBUG ? true : false);
        await mongoose.connect(process.env.MONGOOSE_URI, { useMongoClient: true });
        server.log(`Mongoose Connected | ${process.env.MONGOOSE_URI}`);
    } catch (err) {
        throw err;
    }
}

async function start() {
    try {
        await startDatabase();
        await server.register(initPlugins(server));
        server.route({
            handler: (request, reply) => reply("ok"),
            method: "get",
            path: "/test",
        });
        server.start((err) => {
            const temp: IWozuServer = server as any;
            if (err) {
                throw err;
            }
            server.log("info", `Server running at: ${server.info.uri}`);
            server.log("info", JSON.stringify(temp.wozu(), null, 2));
        });
    } catch (err) {
        throw err;
    }
}

dotenv.config();

const server = new Hapi.Server();

server.connection({ port: process.env.PORT || 3000, host: process.env.IP || "0.0.0.0" });

try {
    start();
} catch (err) {
    server.log("error", err);
}
