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
const plugins_1 = require("./plugins");
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        server.log("info", "TESTY");
        yield server.register(plugins_1.default(server));
        server.start((err) => {
            const temp = server;
            if (err) {
                throw err;
            }
            server.log("info", `Server running at: ${server.info.uri}`);
            server.log("info", JSON.stringify(temp.wozu(), null, 2));
        });
    });
}
dotenv.config();
const server = new Hapi.Server();
server.connection({ port: 3000, host: "localhost" });
try {
    start();
}
catch (err) {
    server.log("error", err);
}
//# sourceMappingURL=index.js.map