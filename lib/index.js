"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const Hapi = require("hapi");
const mongoose = require("mongoose");
const plugins_1 = require("./plugins");
function startDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            mongoose.Promise = Promise;
            mongoose.set("debug", process.env.MONGOOSE_DEBUG ? true : false);
            yield mongoose.connect(process.env.MONGOOSE_URI, { useMongoClient: true });
            console.log(`Mongoose Connected | ${process.env.MONGOOSE_URI}`);
        }
        catch (err) {
            throw err;
        }
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield startDatabase();
            yield server.register(plugins_1.default(server));
            server.route({
                handler: (request, reply) => reply("ok"),
                method: "get",
                path: "/test",
            });
            server.start((err) => {
                const temp = server;
                if (err) {
                    throw err;
                }
                server.log("info", `Server running at: ${server.info.uri}`);
                server.log("info", JSON.stringify(temp.wozu(), null, 2));
            });
        }
        catch (err) {
            throw err;
        }
    });
}
dotenv.config();
const server = new Hapi.Server();
server.connection({ port: process.env.PORT || 3000, host: process.env.IP || "0.0.0.0" });
try {
    start();
}
catch (err) {
    server.log("error", err);
}
//# sourceMappingURL=index.js.map