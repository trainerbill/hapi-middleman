"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Good = require("good");
const Models = require("hapi-mongo-models");
const hapi_paypal_1 = require("hapi-paypal");
const wozu = require("wozu");
exports.default = (server) => {
    const plugins = [];
    const registerGood = {
        options: {
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
        },
        register: Good,
    };
    plugins.push(registerGood);
    const modelPlugin = {
        options: {
            autoIndex: false,
            mongodb: {
                options: {},
                uri: process.env.MONGOOSE_URI,
            },
        },
        register: Models,
    };
    plugins.push(modelPlugin);
    const hapiPayPalOptions = {
        routes: [
            {
                config: {
                    id: "paypal_payment_create",
                },
                handler: (request, reply, response) => {
                    server.log(response);
                    reply(response);
                },
            },
            {
                config: {
                    id: "paypal_webhooks_listen",
                },
                handler: (request, reply, response) => {
                    reply("GOT IT!");
                },
            },
        ],
        sdk: {
            client_id: process.env.PAYPAL_CLIENT_ID,
            client_secret: process.env.PAYPAL_CLIENT_SECRET,
            mode: "sandbox",
        },
        webhooks: {
            event_types: [
                {
                    name: "INVOICING.INVOICE.PAID",
                },
            ],
            url: process.env.PAYPAL_WEBHOOK_HOSTNAME,
        },
    };
    const hapiPaypal = {
        options: hapiPayPalOptions,
        register: new hapi_paypal_1.HapiPayPal(),
    };
    plugins.push(hapiPaypal);
    plugins.push(wozu);
    return plugins;
};
//# sourceMappingURL=index.js.map