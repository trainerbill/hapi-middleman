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
const intacctModels = require("hapi-intacct/lib/models/mongoose");
const paypalModels = require("hapi-paypal/lib/models/mongoose");
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
        this.paypalInvoice = paypalModels.PaypalInvoice;
        this.intacctInvoice = intacctModels.IntacctInvoice;
    }
    initJobs(jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            this.server.log("info", `hapi-paypal-intacct::initJobs::${jobs.length} jobs.`);
            let timer;
            for (const job of jobs) {
                switch (job.name) {
                    case "savePayPalInvoices":
                        yield this.savePayPalInvoices();
                        timer = later.parse.text(job.latertext);
                        later.setInterval(this.savePayPalInvoices, timer);
                        break;
                    case "saveIntacctInvoices":
                        yield this.saveIntacctInvoices();
                        timer = later.parse.text(job.latertext);
                        later.setInterval(this.saveIntacctInvoices, timer);
                        break;
                    default:
                        throw new Error(`Job not defined: ${job.name}`);
                }
                this.server.log("info", `hapi-paypal-intacct::initJobs::${job.name} scheduled for ${job.latertext}`);
            }
        });
    }
    savePayPalInvoices() {
        return __awaiter(this, void 0, void 0, function* () {
            this.server.log("info", `hapi-paypal-intacct::savePayPalInvoices::start`);
            const date = new Date();
            const endIso = date.toISOString();
            const endPaypal = endIso.substr(0, endIso.indexOf("T"));
            date.setDate(date.getDate() - 40);
            const startIso = date.toISOString();
            const startPaypal = startIso.substr(0, startIso.indexOf("T"));
            const search = {
                end_creation_date: `${endPaypal} PST`,
                start_creation_date: `${startPaypal} PST`,
            };
            const res = yield this.server.inject({
                method: "POST",
                payload: search,
                url: "/paypal/invoice/search",
            });
            const ppResult = res.result.invoices;
            if (ppResult.length > 0) {
                for (const invoice of ppResult) {
                    yield this.savePayPalInvoice(invoice);
                }
            }
            this.server.log("info", `hapi-paypal-intacct::savePayPalInvoices::end`);
        });
    }
    savePayPalInvoice(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.paypalInvoice.findOneAndUpdate({ id: invoice.id }, invoice, { upsert: true, new: true });
        });
    }
    saveIntacctInvoices() {
        return __awaiter(this, void 0, void 0, function* () {
            const date = new Date();
            date.setDate(date.getDate() - 1);
            const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND PAYPALINVOICEMESSAGE not like 'Invoice Sent Successfully' AND  WHENCREATED > "7/1/2017"`;
            const res = yield this.server.inject({
                method: "GET",
                url: `/intacct/invoice?query=${encodeURIComponent(query)}`,
            });
            const invoices = res.result;
            if (invoices.length > 0) {
                for (const invoice of invoices) {
                    yield this.saveIntacctInvoice(invoice);
                }
            }
            this.server.log("info", `hapi-paypal-intacct::saveIntacctInvoices::end`);
        });
    }
    saveIntacctInvoice(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this
                .intacctInvoice
                .findOneAndUpdate({ RECORDNO: invoice.RECORDNO }, invoice, { upsert: true, new: true });
        });
    }
}
exports.HapiPayPalIntacct = HapiPayPalIntacct;
//# sourceMappingURL=index.js.map