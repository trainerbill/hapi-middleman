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
const hapi_paypal_1 = require("hapi-paypal");
const paypal_intacct_1 = require("./paypal-intacct");
exports.hapiPayPal = new hapi_paypal_1.HapiPayPal();
exports.hapiPayPalOptions = {
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
                id: "paypal_webhooks_listen",
            },
            handler: (request, reply, error, response) => __awaiter(this, void 0, void 0, function* () {
                if (error) {
                    return reply(boom.notFound(error.message));
                }
                try {
                    yield paypal_intacct_1.hapiPayPalIntacct.webhookHandler(request.payload);
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
        retries: 10,
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
exports.hapiPayPalPlugin = {
    options: exports.hapiPayPalOptions,
    register: exports.hapiPayPal.register,
};
exports.hapiPayPalGlueRegistration = {
    plugin: exports.hapiPayPalPlugin,
};
//# sourceMappingURL=hapi-paypal.js.map