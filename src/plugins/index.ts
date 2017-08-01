import * as Good from "good";
import { PluginRegistrationObject, Server } from "hapi";
import * as hapi from "hapi";
import * as hapiCron from "hapi-cron";
import * as paypal from "hapi-paypal";
import * as therealyou from "therealyou";
import * as wozu from "wozu";
import { HapiPayPalIntacct } from "./paypal-intacct";

export default (server: Server) => {
    const plugins = [];

    const registerTRY: PluginRegistrationObject<any> = {
        register: therealyou,
    };
    plugins.push(registerTRY);

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

    const hapiPayPalOptions: paypal.IHapiPayPalOptions = {
        routes: [
            {
                config: {
                    id: "paypal_invoice_search",
                },
                handler: (request, reply, error, response) => {
                    reply(error || response);
                },
            },
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
                    // const webhook = new paypalModels.PaypalWebhook(request.payload);
                    /* webhook.save().then((test) => {
                        server.log("info", "webhook saved!!!!");
                    }) ;
                    */
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
    plugins.push({
        register: hapiCron,
    });

    const hapiPaypalIntacct = {
        options: {
            invoicing: true,
        },
        register: new HapiPayPalIntacct(),
    };
    plugins.push(hapiPaypalIntacct);

    return plugins;
};
