import * as hapi from "hapi";
import * as paypalModels from "hapi-paypal/lib/models/mongoose";
import * as mongoose from "mongoose";
import { invoice as ppInvoice } from "paypal-rest-sdk";

export interface IHapiPayPalIntacctOptions {
    invoicing?: boolean;
}

export class HapiPayPalIntacct {
    private jobs: any;
    private server: hapi.Server;
    private paypalInvoice: mongoose.Model<any>;

    constructor() {
        this.register.attributes = {
            dependencies: ["hapi-cron", "hapi-paypal"],
            name: "hapi-paypal-intacct",
        };

        this.paypalInvoice = paypalModels.PaypalInvoice;
    }

    // tslint:disable-next-line:max-line-length
    public register: hapi.PluginFunction<any> = (server: hapi.Server, options: any, next: hapi.ContinuationFunction) => {
        this.server = server;
        this.jobs = server.plugins["hapi-cron"].jobs;
        const promises = [];

        if (options.invoicing) {
            promises.push(this.initInvoicing());
        }

        return Promise.all(promises).then(() => next);
    }

    private async initInvoicing() {
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
        const res = await this.server.inject({
            method: "POST",
            payload: search,
            url: "/paypal/invoice/search",
        });

        const ppResult = (res.result as ppInvoice.ListResponse).invoices;

        if (ppResult.length > 0) {
            for (const invoice of ppResult) {
                await this.savePayPalInvoice(invoice);
            }
        }
    }

    private async savePayPalInvoice(invoice: ppInvoice.Invoice) {
        // tslint:disable-next-line:max-line-length
        return await this.paypalInvoice.findOneAndUpdate({ id: invoice.id }, invoice, { upsert: true, new: true });
    }
}
