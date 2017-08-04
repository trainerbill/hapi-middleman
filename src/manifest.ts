import * as boom from "boom";
import * as catbox from "catbox-mongodb";
import * as Good from "good";
import { PluginRegistrationObject, Server } from "hapi";
import * as hapi from "hapi";
import { HapiIntacct, IHapiIntacctOptions } from "hapi-intacct";
import { HapiPayPal, IHapiPayPalOptions } from "hapi-paypal";
import { PaypalWebhook } from "hapi-paypal/lib/models/mongoose";
import * as therealyou from "therealyou";
import * as wozu from "wozu";
import { HapiPayPalIntacct, IHapiPayPalIntacctOptions } from "./plugins/paypal-intacct";

const hapiPayPalIntacct = new HapiPayPalIntacct();

const hapiPayPalOptions: IHapiPayPalOptions = {
    routes: [
        {
            config: {
                id: "paypal_invoice_search",
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
                id: "paypal_webhooks_listen",
            },
            handler: async (request, reply, error, response) => {
                if (error) {
                    return reply(boom.notFound(error.message));
                }
                try {
                    await hapiPayPalIntacct.webhookHandler(request.payload);
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

export const manifest: any = {
    connections: [
        {
            host: process.env.IP || "0.0.0.0",
            labels: ["backend"],
            port: process.env.PORT || 3000,
        },
    ],
    registrations: [
        {
            plugin: {
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
                register: Good.register,
            },
        },
        {
            plugin: {
                register: therealyou.register,
            },
        },
        {
            plugin: {
                register: wozu.register,
            },
        },
        {
            plugin: {
                options: hapiPayPalOptions,
                register: new HapiPayPal().register,
            },
        },
        {
            plugin: {
                options: {
                    routes: [
                        {
                            config: {
                                id: "intacct_invoice_query",
                            },
                        },
                        {
                            config: {
                                id: "intacct_invoice_read",
                            },
                        },
                        {
                            config: {
                                id: "intacct_invoice_update",
                            },
                        },
                    ],
                    sdk: {
                        auth: {
                            companyId: process.env.INTACCT_COMPANY_ID,
                            password: process.env.INTACCT_USER_PASSWORD,
                            senderId: process.env.INTACCT_SENDER_ID,
                            senderPassword: process.env.INTACCT_SENDER_PASSWORD,
                            sessionId: process.env.INTACCT_SESSION_ID,
                            userId: process.env.INTACCT_USER_ID,
                        },
                        /*
                        controlId: process.env.INTACCT_CONTROL_ID || "testRequestId",
                        dtdVersion: process.env.INTACCT_DTD_VERSION || "3.0",
                        uniqueId: process.env.INTACCT_CONTROL_ID || false,
                        */
                    },
                },
                register: new HapiIntacct().register,
            },
        },
        {
            plugin: {
                options: {
                    jobs: [
                        {
                            latertext: "every hour",
                            name: "syncInvoices",
                        },
                    ],
                },
                register: hapiPayPalIntacct.register,
            },
        },
    ],
};
