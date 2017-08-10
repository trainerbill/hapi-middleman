import { PluginRegistrationObject } from "hapi";
export declare const goodOptions: {
    reporters: {
        console: (string | {
            args: {
                log: string;
                response: string;
            }[];
            module: string;
            name: string;
        } | {
            module: string;
        })[];
    };
};
export declare const goodPlugin: PluginRegistrationObject<any>;
export declare const goodGlueRegistration: {
    plugin: PluginRegistrationObject<any>;
};
