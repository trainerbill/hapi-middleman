import * as Good from "good";
import { PluginRegistrationObject } from "hapi";

export const goodOptions = {
    reporters: {
        console: [{
            args: [{
                log: "*",
                request: "*",
                response: "*",
            }],
            module: "good-squeeze",
            name: "Squeeze",
        }, {
            module: "good-console",
        }, "stdout"],
    },
};

export const goodPlugin: PluginRegistrationObject<any> = {
    options: goodOptions,
    register: Good.register,
};

export const goodGlueRegistration = {
    plugin: goodPlugin,
};
