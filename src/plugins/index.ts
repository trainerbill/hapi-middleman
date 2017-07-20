import * as Good from "good";
import { PluginRegistrationObject, Server } from "hapi";
import * as hapi from "hapi";
import * as Models from "hapi-mongo-models";
import { HapiPayPal, IHapiPayPalOptions } from "hapi-paypal";
import * as wozu from "wozu";

export default (server: Server) => {
    const plugins = [];
    const registerGood: PluginRegistrationObject<any> = {
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
                options: { },
                uri: process.env.MONGOOSE_URI,
            },
        },
        register: Models,
    };
    plugins.push(modelPlugin);

    const hapiPayPalOptions: IHapiPayPalOptions = {
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
                    server.log(request.payload);
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
        register: new HapiPayPal(),
    };
    plugins.push(hapiPaypal);

    plugins.push(wozu);

    return plugins;
};
