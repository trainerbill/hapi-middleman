import * as dotenv from "dotenv";
import * as Hapi from "hapi";
import initPlugins from "./plugins";

interface IWozuServer extends Hapi.Server {
    wozu(): [{}];
}

async function start() {
    server.log("info", "TESTY");
    await server.register(initPlugins(server));
    server.start((err) => {
        const temp: IWozuServer = server as any;
        if (err) {
            throw err;
        }
        server.log("info", `Server running at: ${server.info.uri}`);
        server.log("info", JSON.stringify(temp.wozu(), null, 2));
    });
}

dotenv.config();

const server = new Hapi.Server();

server.connection({ port: process.env.PORT || 3000, host: process.env.IP || "0.0.0.0" });

try {
    start();
} catch (err) {
    server.log("error", err);
}
