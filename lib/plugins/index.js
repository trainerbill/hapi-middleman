"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Good = require("good");
const Mongoose = require("hapi-mongoose");
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
            bluebird: false,
            uri: process.env.MONGOOSE_URI,
        },
        register: Mongoose,
    };
    plugins.push(modelPlugin);
    const hapiPayPalOptions = {
        models: [
            "PaypalWebhook",
        ],
        routes: [
            {
                config: {
                    id: "paypal_payment_create",
                },
                handler: (request, reply, error, response) => {
                    server.log(response);
                    reply(response);
                },
            },
            {
                config: {
                    id: "paypal_webhooks_listen",
                },
                handler: (request, reply, error, response) => {
                    server.log(JSON.stringify(request.payload));
                },
            },
        ],
        sdk: {
            client_id: process.env.PAYPAL_CLIENT_ID,
            client_secret: process.env.PAYPAL_CLIENT_SECRET,
            mode: "sandbox",
        },
        webhook: {
            event_types: [
                {
                    name: "INVOICING.INVOICE.PAID",
                },
                {
                    name: "INVOICING.INVOICE.CANCELLED",
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