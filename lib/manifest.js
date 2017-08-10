"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugins_1 = require("./plugins");
exports.manifest = {
    connections: [
        {
            host: process.env.IP || "0.0.0.0",
            labels: ["backend"],
            port: process.env.PORT || 3000,
        },
    ],
    registrations: plugins_1.GlueRegistrations,
};
//# sourceMappingURL=manifest.js.map