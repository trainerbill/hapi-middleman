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
const later = require("later");
class HapiPayPalIntacct {
    constructor() {
        this.jobs = new Map();
        this.register = (server, options, next) => {
            this.server = server;
            return Promise.all([this.initJobs(options.jobs)]).then(() => next);
        };
        this.register.attributes = {
            dependencies: ["hapi-paypal", "hapi-intacct"],
            name: "hapi-paypal-intacct",
        };
    }
    webhookHandler(webhook) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = {};
            switch (webhook.event_type) {
                case "INVOICING.INVOICE.PAID":
                    invoice.PAYPALINVOICESTATUS = webhook.resource.status;
                    break;
                default:
            }
            try {
                const update = yield this.server.inject({
                    method: "PUT",
                    payload: invoice,
                    url: `/intacct/invoice/${webhook.resource.number}`,
                });
                if (update.statusCode !== 200) {
                    throw new Error(update.result.message);
                }
            }
            catch (err) {
                this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${invoice.RECORDNO}::${err.message}`);
            }
        });
    }
    initJobs(jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            this.server.log("info", `hapi-paypal-intacct::initJobs::${jobs.length} jobs.`);
            let timer;
            for (const job of jobs) {
                switch (job.name) {
                    case "syncInvoices":
                        yield this.syncInvoices();
                        timer = later.parse.text(job.latertext);
                        later.setInterval(this.syncInvoices, timer);
                        break;
                    default:
                        throw new Error(`Job not defined: ${job.name}`);
                }
                this.server.log("info", `hapi-paypal-intacct::initJobs::${job.name} scheduled for ${job.latertext}`);
            }
        });
    }
    syncInvoices() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND ( PAYPALINVOICESTATUS IN (NULL,'DRAFT') OR PAYPALINVOICEID IS NULL ) AND WHENCREATED > '8/1/2017'`;
            const res = yield this.server.inject({
                method: "GET",
                url: `/intacct/invoice?query=${encodeURIComponent(query)}`,
            });
            const invoices = res.result;
            if (invoices.length > 0) {
                for (const invoice of invoices) {
                    let paypalInvoice;
                    try {
                        if (!invoice.PAYPALINVOICEID) {
                            const find = yield this.server.inject({
                                method: "POST",
                                payload: {
                                    number: invoice.RECORDNO,
                                },
                                url: "/paypal/invoice/search",
                            });
                            if (find.result.invoices.length !== 0) {
                                paypalInvoice = find.result.invoices[0];
                                invoice.PAYPALINVOICEID = paypalInvoice.id;
                            }
                            else {
                                const create = yield this.server.inject({
                                    method: "POST",
                                    payload: this.toPaypalInvoice(invoice),
                                    url: "/paypal/invoice",
                                });
                                if (create.statusCode !== 200) {
                                    throw new Error(create.result.message);
                                }
                                paypalInvoice = create.result;
                                invoice.PAYPALINVOICEID = paypalInvoice.id;
                            }
                        }
                        else {
                            paypalInvoice = yield this.getPayPalInvoice(invoice.PAYPALINVOICEID);
                        }
                        if (paypalInvoice.status === "DRAFT") {
                            const send = yield this.server.inject({
                                method: "POST",
                                url: `/paypal/invoice/${invoice.PAYPALINVOICEID}/send`,
                            });
                            if (send.statusCode !== 200) {
                                throw new Error(send.result.message);
                            }
                            paypalInvoice = yield this.getPayPalInvoice(invoice.PAYPALINVOICEID);
                        }
                    }
                    catch (err) {
                        this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${invoice.RECORDNO}::${err.message}`);
                        invoice.PAYPALERROR = JSON.stringify(err.message);
                    }
                    try {
                        const update = yield this.server.inject({
                            method: "PUT",
                            payload: {
                                PAYPALERROR: invoice.PAYPALERROR,
                                PAYPALINVOICEID: invoice.PAYPALINVOICEID,
                                PAYPALINVOICESTATUS: paypalInvoice.status,
                                PAYPALINVOICEURL: paypalInvoice.metadata.payer_view_url,
                            },
                            url: `/intacct/invoice/${invoice.RECORDNO}`,
                        });
                        if (update.statusCode !== 200) {
                            throw new Error(update.result.message);
                        }
                    }
                    catch (err) {
                        this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${invoice.RECORDNO}::${err.message}`);
                    }
                }
            }
            this.server.log("info", `hapi-paypal-intacct::saveIntacctInvoices::end`);
        });
    }
    getPayPalInvoice(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const get = yield this.server.inject({
                method: "GET",
                url: `/paypal/invoice/${id}`,
            });
            if (get.statusCode !== 200) {
                throw new Error(get.result.message);
            }
            return get.result;
        });
    }
    toPaypalInvoice(intacctInvoice) {
        return __awaiter(this, void 0, void 0, function* () {
            const paypalInvoice = {
                billing_info: {
                    email: intacctInvoice["BILLTO.EMAIL1"],
                },
                merchant_info: {
                    address: {
                        city: process.env.PAYPAL_MERCHANT_ADDRESS_CITY,
                        country_code: process.env.PAYPAL_MERCHANT_COUNTRY_CODE,
                        line1: process.env.PAYPAL_MERCHANT_ADDRESS_LINE1,
                        postal_code: process.env.PAYPAL_MERCHANT_COUNTRY_POSTAL_CODE,
                        state: process.env.PAYPAL_MERCHANT_COUNTRY_STATE,
                    },
                    business_name: process.env.PAYPAL_MERCHANT_BUSINESS_NAME,
                    email: process.env.PAYPAL_MERCHANT_EMAIL,
                    first_name: process.env.PAYPAL_MERCHANT_FIRST_NAME,
                    last_name: process.env.PAYPAL_MERCHANT_LAST_NAME,
                    phone: {
                        country_code: process.env.PAYPAL_MERCHANT_PHONE_COUNTRY_CODE,
                        national_number: process.env.PAYPAL_MERCHANT_PHONE_NUMBER,
                    },
                },
                note: intacctInvoice["CUSTMESSAGE.MESSAGE"],
                number: intacctInvoice.RECORDNO,
                payment_term: {
                    term_type: intacctInvoice.TERMNAME,
                },
                shipping_info: {
                    address: {
                        city: intacctInvoice["SHIPTO.MAILADDRESS.CITY"],
                        country_code: intacctInvoice["SHIPTO.MAILADDRESS.COUNTRYCODE"],
                        line1: intacctInvoice["SHIPTO.MAILADDRESS.ADDRESS1"],
                        line2: intacctInvoice["SHIPTO.MAILADDRESS.ADDRESS2"],
                        phone: intacctInvoice["SHIPTO.PHONE1"],
                        postal_code: intacctInvoice["SHIPTO.MAILADDRESS.ZIP"],
                        state: intacctInvoice["SHIPTO.MAILADDRESS.STATE"],
                    },
                    business_name: intacctInvoice["SHIPTO.CONTACTNAME"],
                    first_name: intacctInvoice["SHIPTO.FIRSTNAME"],
                    last_name: intacctInvoice["SHIPTO.LASTNAME"],
                },
                tax_inclusive: true,
                total_amount: {
                    currency: intacctInvoice.CURRENCY,
                    value: intacctInvoice.TRX_TOTALENTERED,
                },
            };
            return paypalInvoice;
        });
    }
    toPayPalLineItems(arrInvoiceItems) {
        return __awaiter(this, void 0, void 0, function* () {
            const arrPPInvItems = [];
            if (arrInvoiceItems.length > 0) {
                for (const item of arrInvoiceItems) {
                    const ritem = {
                        name: item.ITEMNAME ? "Item1" : item.ITEMNAME,
                        quantity: 1,
                        unit_price: {
                            currency: item.CURRENCY,
                            value: item.AMOUNT,
                        },
                    };
                    arrPPInvItems.push(ritem);
                }
            }
            return arrPPInvItems;
        });
    }
}
exports.HapiPayPalIntacct = HapiPayPalIntacct;
//# sourceMappingURL=index.js.map