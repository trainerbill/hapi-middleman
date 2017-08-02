import * as hapi from "hapi";
import { IHapiPayPalOptions } from "hapi-paypal";
export declare const manifest: {
    connections: {
        host: any;
        labels: string[];
        port: any;
    }[];
    registrations: ({
        plugin: {
            options: {
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
            register: any;
        };
    } | {
        plugin: {
            register: any;
        };
    } | {
        plugin: {
            options: IHapiPayPalOptions;
            register: hapi.PluginFunction<any>;
        };
    } | {
        plugin: {
            options: {
                routes: {
                    config: {
                        id: string;
                    };
                }[];
                sdk: {
                    auth: {
                        companyId: any;
                        password: any;
                        senderId: any;
                        senderPassword: any;
                        sessionId: any;
                        userId: any;
                    };
                };
            };
            register: hapi.PluginFunction<any>;
        };
    } | {
        plugin: {
            options: {
                jobs: {
                    latertext: string;
                    name: string;
                }[];
            };
            register: hapi.PluginFunction<any>;
        };
    })[];
    server: {
        cache: {
            engine: any;
            host: string;
            name: string;
            partition: string;
        }[];
    };
};
