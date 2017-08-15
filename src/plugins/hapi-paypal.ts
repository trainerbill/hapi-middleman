import * as boom from "boom";
import { PluginRegistrationObject } from "hapi";
import { HapiPayPal, IHapiPayPalOptions } from "hapi-paypal";
import { hapiPayPalIntacctInvoicing } from "./invoicing";

export const hapiPayPal = new HapiPayPal();

export const hapiPayPalOptions: IHapiPayPalOptions = {
    routes: [
        {
            config: {
                id: "paypal_invoice_search",
            },
        },
        {
            config: {
                id: "paypal_invoice_cancel",
            },
        },
        {
            config: {
                id: "paypal_invoice_remind",
            },
        },
        {
            config: {
                id: "paypal_invoice_create",
            },
        },
        {
            config: {
                id: "paypal_invoice_send",
            },
        },
        {
            config: {
                id: "paypal_invoice_get",
            },
        },
        {
            config: {
                id: "paypal_webhooks_test",
            },
        },
        {
            config: {
                id: "paypal_webhooks_listen",
            },
            handler: async (request, reply, error, response) => {
                if (error) {
                    return reply(boom.notFound(error.message));
                }
                try {
                    await hapiPayPalIntacctInvoicing.webhookHandler(request.payload);
                    return reply("GOT IT!");
                } catch (err) {
                    return reply(boom.badRequest(err.message));
                }
            },
        },
    ],
    sdk: {
        client_id: process.env.PAYPAL_CLIENT_ID,
        client_secret: process.env.PAYPAL_CLIENT_SECRET,
        mode: process.env.PAYPAL_MODE,
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

export const hapiPayPalPlugin: PluginRegistrationObject<any> = {
    options: hapiPayPalOptions,
    register: hapiPayPal.register,
};

export const hapiPayPalGlueRegistration = {
    plugin: hapiPayPalPlugin,
};
