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
const paypalSchemas = require("hapi-paypal/lib/joi");
const joi = require("joi");
const later = require("later");
class HapiPayPalIntacct {
    constructor() {
        this.jobs = new Map();
        this.register = (server, options, next) => {
            this.server = server;
            return Promise.all([this.initJobs(options.jobs)]).then(() => next());
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
                url: `/intacct/invoice?query=${encodeURIComponent(query)}&fields=RECORDNO`,
            });
            const invoices = res.result;
            if (invoices.length > 0) {
                for (const invoice of invoices) {
                    let paypalInvoice;
                    const intacctInvoice = yield this.getIntacctInvoice(invoice.RECORDNO);
                    try {
                        if (!intacctInvoice.PAYPALINVOICEID) {
                            const find = yield this.server.inject({
                                method: "POST",
                                payload: {
                                    number: intacctInvoice.RECORDNO,
                                },
                                url: "/paypal/invoice/search",
                            });
                            if (find.result.invoices.length !== 0) {
                                paypalInvoice = find.result.invoices[0];
                                intacctInvoice.PAYPALINVOICEID = paypalInvoice.id;
                            }
                            else {
                                const create = yield this.server.inject({
                                    method: "POST",
                                    payload: this.toPaypalInvoice(intacctInvoice),
                                    url: "/paypal/invoice",
                                });
                                if (create.statusCode !== 200) {
                                    throw new Error(create.result.message);
                                }
                                paypalInvoice = create.result;
                                intacctInvoice.PAYPALINVOICEID = paypalInvoice.id;
                            }
                        }
                        else {
                            paypalInvoice = yield this.getPayPalInvoice(intacctInvoice.PAYPALINVOICEID);
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
                        this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${intacctInvoice.RECORDNO}::${err.message}`);
                        intacctInvoice.PAYPALERROR = JSON.stringify(err.message);
                    }
                    try {
                        const update = yield this.server.inject({
                            method: "PUT",
                            payload: {
                                PAYPALERROR: intacctInvoice.PAYPALERROR,
                                PAYPALINVOICEID: intacctInvoice.PAYPALINVOICEID,
                                PAYPALINVOICESTATUS: paypalInvoice.status,
                                PAYPALINVOICEURL: paypalInvoice.metadata.payer_view_url,
                            },
                            url: `/intacct/invoice/${intacctInvoice.RECORDNO}`,
                        });
                        if (update.statusCode !== 200) {
                            throw new Error(update.result.message);
                        }
                    }
                    catch (err) {
                        this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${intacctInvoice.RECORDNO}::${err.message}`);
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
    getIntacctInvoice(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const get = yield this.server.inject({
                method: "GET",
                url: `/intacct/invoice/${id}`,
            });
            if (get.statusCode !== 200) {
                throw new Error(get.result.message);
            }
            return get.result;
        });
    }
    toPaypalInvoice(intacctInvoice) {
        const paypalInvoice = {
            billing_info: [{
                    address: {
                        city: intacctInvoice.BILLTO.MAILADDRESS.CITY,
                        country_code: intacctInvoice.BILLTO.MAILADDRESS.COUNTRYCODE,
                        line1: intacctInvoice.BILLTO.MAILADDRESS.ADDRESS1,
                        line2: intacctInvoice.BILLTO.MAILADDRESS.ADDRESS2,
                        postal_code: intacctInvoice.BILLTO.MAILADDRESS.ZIP,
                        state: intacctInvoice.BILLTO.MAILADDRESS.STATE,
                    },
                    business_name: intacctInvoice.BILLTO.COMPANYNAME,
                    email: intacctInvoice.BILLTO.EMAIL1,
                    first_name: intacctInvoice.BILLTO.FIRSTNAME,
                    last_name: intacctInvoice.BILLTO.LASTNAME,
                    phone: {
                        country_code: "1",
                        national_number: intacctInvoice.BILLTO.PHONE1,
                    },
                }],
            items: this.toPayPalLineItems(intacctInvoice.ARINVOICEITEMS.arinvoiceitem),
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
            note: intacctInvoice.CUSTMESSAGE.MESSAGE,
            number: intacctInvoice.RECORDNO,
            payment_term: {
                term_type: intacctInvoice.TERMNAME,
            },
            shipping_info: {
                address: {
                    city: intacctInvoice.SHIPTO.MAILADDRESS.CITY,
                    country_code: intacctInvoice.SHIPTO.MAILADDRESS.COUNTRYCODE,
                    line1: intacctInvoice.SHIPTO.MAILADDRESS.ADDRESS1,
                    line2: intacctInvoice.SHIPTO.MAILADDRESS.ADDRESS2,
                    postal_code: intacctInvoice.SHIPTO.MAILADDRESS.ZIP,
                    state: intacctInvoice.SHIPTO.MAILADDRESS.STATE,
                },
                business_name: intacctInvoice.SHIPTO.CONTACTNAME,
                first_name: intacctInvoice.SHIPTO.FIRSTNAME,
                last_name: intacctInvoice.SHIPTO.LASTNAME,
            },
            tax_inclusive: true,
        };
        const validateResult = joi.validate(paypalInvoice, paypalSchemas.paypalInvoiceSchema);
        if (validateResult.error) {
            throw new Error(JSON.stringify(validateResult.error.details));
        }
        return validateResult.value;
    }
    toPayPalLineItems(arrInvoiceItems) {
        const arrPPInvItems = [];
        if (arrInvoiceItems.length > 0) {
            for (const item of arrInvoiceItems) {
                const ritem = {
                    name: item.ITEMNAME,
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
    }
}
exports.HapiPayPalIntacct = HapiPayPalIntacct;
//# sourceMappingURL=index.js.map