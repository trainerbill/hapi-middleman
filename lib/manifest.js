"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const boom = require("boom");
const Good = require("good");
const hapi_intacct_1 = require("hapi-intacct");
const hapi_paypal_1 = require("hapi-paypal");
const therealyou = require("therealyou");
const wozu = require("wozu");
const paypal_intacct_1 = require("./plugins/paypal-intacct");
const hapiPayPalIntacct = new paypal_intacct_1.HapiPayPalIntacct();
const hapiPayPalOptions = {
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
            handler: (request, reply, error, response) => __awaiter(this, void 0, void 0, function* () {
                if (error) {
                    return reply(boom.notFound(error.message));
                }
                try {
                    yield hapiPayPalIntacct.webhookHandler(request.payload);
                    return reply("GOT IT!");
                }
                catch (err) {
                    return reply(boom.badRequest(err.message));
                }
            }),
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
exports.manifest = {
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
                register: new hapi_paypal_1.HapiPayPal().register,
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
                    },
                },
                register: new hapi_intacct_1.HapiIntacct().register,
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
//# sourceMappingURL=manifest.js.map