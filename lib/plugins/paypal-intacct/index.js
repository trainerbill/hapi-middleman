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
const paypalModels = require("hapi-paypal/lib/models/mongoose");
class HapiPayPalIntacct {
    constructor() {
        this.register = (server, options, next) => {
            this.server = server;
            this.jobs = server.plugins["hapi-cron"].jobs;
            const promises = [];
            if (options.invoicing) {
                promises.push(this.initInvoicing());
            }
            return Promise.all(promises).then(() => next);
        };
        this.register.attributes = {
            dependencies: ["hapi-cron", "hapi-paypal"],
            name: "hapi-paypal-intacct",
        };
        this.paypalInvoice = paypalModels.PaypalInvoice;
    }
    initInvoicing() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    savePayPalInvoice(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.paypalInvoice.findOneAndUpdate({ id: invoice.id }, invoice, { upsert: true, new: true });
        });
    }
}
exports.HapiPayPalIntacct = HapiPayPalIntacct;
//# sourceMappingURL=index.js.map