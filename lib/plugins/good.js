"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Good = require("good");
exports.goodOptions = {
    reporters: {
        console: [{
                args: [{
                        log: "*",
                        response: "*",
                    }],
                module: "good-squeeze",
                name: "Squeeze",
            }, {
                module: "good-console",
            }, "stdout"],
    },
};
exports.goodPlugin = {
    options: exports.goodOptions,
    register: Good.register,
};
exports.goodGlueRegistration = {
    plugin: exports.goodPlugin,
};
//# sourceMappingURL=good.js.map