"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Good = require("good");
const paypal = require("hapi-paypal");
const therealyou = require("therealyou");
const wozu = require("wozu");
exports.default = (server) => {
    const plugins = [];
    const registerTRY = {
        register: therealyou,
    };
    plugins.push(registerTRY);
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
    const hapiPayPalOptions = {
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
        register: new paypal.HapiPayPal(),
    };
    plugins.push(hapiPaypal);
    plugins.push(wozu);
    return plugins;
};
//# sourceMappingURL=index.js.map