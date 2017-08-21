import { GlueRegistrations } from "./plugins";

export const manifest: any = {
    connections: [
        {
            host: process.env.IP || "127.0.0.1",
            labels: ["private"],
            port: process.env.PRIVATE_PORT || 3001,
        },
        {
            host: process.env.IP || "0.0.0.0",
            labels: ["public"],
            port: process.env.PUBLIC_PORT || process.env.PORT || 3000,
        },
    ],
    registrations: GlueRegistrations,
    server: {
        debug: {
            log: process.env.HAPI_DEBUG ? "*" : "info",
            request: process.env.HAPI_DEBUG ? "*" : "info",
        },
    },
};
