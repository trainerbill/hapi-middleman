import * as glue from "glue";
import * as hapi from "hapi";
import { manifest } from "./manifest";

async function start() {
    try {
        const server = await glue.compose(manifest);
        const servers = await server.start();
        server.table().map((connection: any) => {
            const routes = connection
                            .table
                            .map((route: any) => JSON.stringify({ method: route.method, path: route.path }, null, 2));
            server.log("info", `
Server: ${connection.info.uri}
Labels ${connection.labels.join(",")}
Routes: ${routes}`);
        });
    }  catch (err) {
        throw err;
    }
}

try {
    start();
} catch (err) {
    throw err;
}

// export let server: IWozuServer;
