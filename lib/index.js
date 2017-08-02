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
const glue = require("glue");
const mongoose = require("mongoose");
const manifest_1 = require("./manifest");
function startDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            mongoose.Promise = Promise;
            mongoose.set("debug", process.env.MONGOOSE_DEBUG ? true : false);
            yield mongoose.connect(process.env.MONGOOSE_URI, { useMongoClient: true });
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
            exports.server = yield glue.compose(manifest_1.manifest);
            yield exports.server.start();
            exports.server.log("info", `Database running at: ${process.env.MONGOOSE_URI}`);
            exports.server.log("info", `Server running at: ${exports.server.info.uri}`);
            exports.server.log("info", JSON.stringify(exports.server.wozu(), null, 2));
        }
        catch (err) {
            throw err;
        }
    });
}
try {
    start();
}
catch (err) {
    throw err;
}
//# sourceMappingURL=index.js.map