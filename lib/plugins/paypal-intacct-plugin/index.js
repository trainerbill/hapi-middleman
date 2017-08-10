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
            const jobSchema = joi.object().keys({
                latertext: joi.string().required(),
                name: joi.string().required(),
            });
            const optionsSchema = joi.object().keys({
                jobs: joi.array().items(jobSchema).default([]),
                merchant: paypalSchemas.paypalInvoiceBillingInfoSchema.required(),
                reminderDays: joi.number().default(30),
            });
            const validate = joi.validate(options, optionsSchema);
            if (validate.error) {
                throw validate.error;
            }
            this.options = validate.value;
            return Promise.all([this.validateInvoiceKeys(), this.initJobs()]).then(() => next());
        };
        this.register.attributes = {
            dependencies: ["hapi-paypal", "hapi-intacct"],
            name: "hapi-paypal-intacct",
        };
        this.intacctInvoiceKeys = [
            "PAYPALINVOICEID",
            "PAYPALERROR",
            "PAYPALINVOICEURL",
            "PAYPALINVOICESTATUS",
        ];
    }
    webhookHandler(webhook) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = {};
            switch (webhook.event_type) {
                case "INVOICING.INVOICE.PAID":
                    invoice.PAYPALINVOICESTATUS = webhook.resource.invoice.status;
                    try {
                        const update = yield this.server.inject({
                            method: "PUT",
                            payload: invoice,
                            url: `/intacct/invoice/${webhook.resource.invoice.number}`,
                        });
                        if (update.statusCode !== 200) {
                            throw new Error(update.result.message);
                        }
                    }
                    catch (err) {
                        this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${invoice.RECORDNO}::${err.message}`);
                    }
                    break;
                default:
            }
        });
    }
    validateInvoiceKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            const inspect = yield this.server.inject({
                method: "OPTIONS",
                url: `/intacct/invoice`,
            });
            if (inspect.statusCode !== 200) {
                throw new Error(inspect.result.message);
            }
            this.intacctInvoiceKeys.forEach((key) => {
                if (inspect.result.indexOf(key) === -1) {
                    throw new Error(`${key} not defined.  Add the key to the Intacct Invoice object.`);
                }
            });
        });
    }
    initJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            this.server.log("info", `hapi-paypal-intacct::initJobs::${this.options.jobs.length} jobs.`);
            let timer;
            for (const job of this.options.jobs) {
                switch (job.name) {
                    case "syncInvoices":
                        yield this.syncInvoices();
                        timer = later.parse.text(job.latertext);
                        later.setInterval(this.syncInvoices.bind(this), timer);
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
            return Promise
                .all([this.syncInvoicesPayPalToIntacct(), this.syncInvoicesIntacctToPayPal()])
                .then(() => this.server.log("info", "hapi-paypal-intacct::syncInvoices::Success"))
                .catch((err) => this.server.log("error", `hapi-paypal-intacct::syncInvoices::Error::${err.message}`));
        });
    }
    syncInvoiceIntacctToPayPal(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            let paypalInvoice;
            let intacctInvoice;
            const intacctUpdate = {
                PAYPALERROR: "",
            };
            try {
                const fullInvoices = yield Promise.all([
                    this.getIntacctInvoice(invoice.RECORDNO),
                    this.searchPayPalInvoice({ number: invoice.RECORDNO }),
                ]);
                intacctInvoice = fullInvoices[0];
                if (fullInvoices[1].length === 1) {
                    paypalInvoice = fullInvoices[1][0];
                    intacctInvoice.PAYPALINVOICEID = paypalInvoice.id;
                }
                else if (fullInvoices[1].length > 1) {
                    const ids = fullInvoices[1].map((inv) => inv.id);
                    const error = `Multiple PayPal Invoice IDs ${ids}.  You should login to paypal and cancel one.\n`;
                    intacctInvoice.PAYPALERROR += error;
                    this.server.log("warn", error);
                }
                if (!intacctInvoice.PAYPALINVOICEID) {
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
                intacctUpdate.PAYPALINVOICEID = paypalInvoice.id;
                intacctUpdate.PAYPALINVOICESTATUS = paypalInvoice.status;
                if (paypalInvoice.status === "DRAFT") {
                    const send = yield this.server.inject({
                        method: "POST",
                        url: `/paypal/invoice/${paypalInvoice.id}/send`,
                    });
                    if (send.statusCode !== 200) {
                        throw new Error(send.result.message);
                    }
                    paypalInvoice = yield this.getPayPalInvoice(paypalInvoice.id);
                }
                intacctUpdate.PAYPALINVOICESTATUS = paypalInvoice.status;
                intacctUpdate.PAYPALINVOICEURL = paypalInvoice.metadata.payer_view_url;
            }
            catch (err) {
                this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${intacctInvoice.RECORDNO}::${err.message}`);
                intacctUpdate.PAYPALERROR += `${JSON.stringify(err.message)}\n`;
            }
            try {
                return this.updateIntacctInvoice(intacctInvoice.RECORDNO, intacctUpdate);
            }
            catch (err) {
                this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${intacctInvoice.RECORDNO}::${err.message}`);
            }
        });
    }
    syncInvoicesIntacctToPayPal() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND ( PAYPALINVOICESTATUS IN (NULL,'DRAFT') OR PAYPALINVOICEID IS NULL ) AND WHENCREATED > '8/1/2017'`;
            const promises = [];
            const res = yield this.server.inject({
                method: "GET",
                url: `/intacct/invoice?query=${encodeURIComponent(query)}&fields=RECORDNO`,
            });
            const invoices = res.result;
            invoices.forEach((invoice) => promises.push(this.syncInvoiceIntacctToPayPal(invoice)));
            return Promise.all(promises);
        });
    }
    syncInvoicePayPalToIntacct(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const intacctInvoice = yield this.getIntacctInvoice(invoice.number);
                if (!intacctInvoice || intacctInvoice.STATE !== "Posted") {
                    yield this.cancelPayPalInvoice(invoice.id);
                }
                else {
                    const reminder = new Date(invoice.metadata.last_sent_date + this.options.reminderDays);
                    const now = new Date();
                    if (now > reminder) {
                        yield this.remindPayPalInvoice(invoice.id);
                    }
                }
            }
            catch (err) {
                this.server.log("error", `hapi-paypal-intacct::syncInvoicePayPalToIntacct::${err.message}`);
            }
        });
    }
    syncInvoicesPayPalToIntacct() {
        return __awaiter(this, void 0, void 0, function* () {
            const paypalInvoices = yield this.searchPayPalInvoice({ status: ["SENT", "UNPAID"] });
            const promises = [];
            paypalInvoices.forEach((invoice) => promises.push(this.syncInvoicePayPalToIntacct(invoice)));
            return Promise.all(promises);
        });
    }
    searchPayPalInvoice(payload = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const search = yield this.server.inject({
                method: "POST",
                payload,
                url: "/paypal/invoice/search",
            });
            return search.result.invoices;
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
    cancelPayPalInvoice(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cancel = yield this.server.inject({
                method: "POST",
                payload: {},
                url: `/paypal/invoice/${id}/cancel`,
            });
            if (cancel.statusCode !== 200) {
                throw new Error(cancel.result.message);
            }
            return cancel;
        });
    }
    remindPayPalInvoice(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const remind = yield this.server.inject({
                method: "POST",
                payload: {},
                url: `/paypal/invoice/${id}/remind`,
            });
            if (remind.statusCode !== 200) {
                throw new Error(remind.result.message);
            }
            return remind;
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
    updateIntacctInvoice(id, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const update = yield this.server.inject({
                method: "PUT",
                payload,
                url: `/intacct/invoice/${id}`,
            });
            if (update.statusCode !== 200) {
                throw new Error(update.result.message);
            }
            return update.result;
        });
    }
    toPaypalInvoice(intacctInvoice) {
        const paypalInvoice = {
            billing_info: [{
                    additional_info: intacctInvoice.CUSTOMERID,
                    business_name: intacctInvoice.BILLTO.COMPANYNAME,
                    email: intacctInvoice.BILLTO.EMAIL1,
                    first_name: intacctInvoice.BILLTO.FIRSTNAME,
                    last_name: intacctInvoice.BILLTO.LASTNAME,
                }],
            items: this.toPayPalLineItems(intacctInvoice.ARINVOICEITEMS.arinvoiceitem),
            merchant_info: this.options.merchant,
            note: intacctInvoice.CUSTMESSAGE.MESSAGE,
            number: intacctInvoice.RECORDNO,
            payment_term: {
                term_type: intacctInvoice.TERMNAME,
            },
            shipping_info: {
                business_name: intacctInvoice.SHIPTO.CONTACTNAME,
                first_name: intacctInvoice.SHIPTO.FIRSTNAME,
                last_name: intacctInvoice.SHIPTO.LASTNAME,
            },
            tax_inclusive: true,
        };
        const shippingAddress = {
            city: intacctInvoice.SHIPTO.MAILADDRESS.CITY,
            country_code: intacctInvoice.SHIPTO.MAILADDRESS.COUNTRYCODE,
            line1: intacctInvoice.SHIPTO.MAILADDRESS.ADDRESS1,
            line2: intacctInvoice.SHIPTO.MAILADDRESS.ADDRESS2,
            postal_code: intacctInvoice.SHIPTO.MAILADDRESS.ZIP,
            state: intacctInvoice.SHIPTO.MAILADDRESS.STATE,
        };
        joi.validate(shippingAddress, paypalSchemas.paypalAddressSchema, (err, value) => {
            if (err) {
                return;
            }
            paypalInvoice.shipping_info.address = value;
        });
        const billingAddress = {
            city: intacctInvoice.BILLTO.MAILADDRESS.CITY,
            country_code: intacctInvoice.BILLTO.MAILADDRESS.COUNTRYCODE,
            line1: intacctInvoice.BILLTO.MAILADDRESS.ADDRESS1,
            line2: intacctInvoice.BILLTO.MAILADDRESS.ADDRESS2,
            postal_code: intacctInvoice.BILLTO.MAILADDRESS.ZIP,
            state: intacctInvoice.BILLTO.MAILADDRESS.STATE,
        };
        joi.validate(billingAddress, paypalSchemas.paypalAddressSchema, (err, value) => {
            if (err) {
                return;
            }
            paypalInvoice.billing_info[0].address = value;
        });
        const billingPhone = {
            country_code: "1",
            national_number: intacctInvoice.BILLTO.PHONE1,
        };
        joi.validate(billingPhone, paypalSchemas.paypalPhoneSchema, (err, value) => {
            if (err) {
                return;
            }
            paypalInvoice.billing_info[0].phone = value;
        });
        const validateResult = joi.validate(paypalInvoice, paypalSchemas.paypalInvoiceSchema);
        if (validateResult.error) {
            throw new Error(validateResult.error.message);
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