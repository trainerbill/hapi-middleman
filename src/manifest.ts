import { GlueRegistrations } from "./plugins";

export const manifest: any = {
    connections: [
        {
            host: process.env.IP || "0.0.0.0",
            labels: ["backend"],
            port: process.env.PORT || 3000,
        },
    ],
    registrations: GlueRegistrations,
};
