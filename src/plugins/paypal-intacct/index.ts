import * as hapi from "hapi";
import * as intacctModels from "hapi-intacct/lib/models/mongoose";
import * as paypalModels from "hapi-paypal/lib/models/mongoose";
import * as later from "later";
import * as mongoose from "mongoose";
import { invoice as ppInvoice } from "paypal-rest-sdk";

export interface IJob {
    name: string;
    latertext: string;
}

export interface IHapiPayPalIntacctOptions {
    jobs?: IJob[];
}

export class HapiPayPalIntacct {
    private jobs: Map<string, any> = new Map();
    private server: hapi.Server;
    private paypalInvoice: mongoose.Model<any>;
    private intacctInvoice: mongoose.Model<any>;

    constructor() {
        this.register.attributes = {
            dependencies: ["hapi-paypal", "hapi-intacct"],
            name: "hapi-paypal-intacct",
        };

        this.paypalInvoice = paypalModels.PaypalInvoice;
        this.intacctInvoice = intacctModels.IntacctInvoice;
    }

    // tslint:disable-next-line:max-line-length
    public register: hapi.PluginFunction<any> = (server: hapi.Server, options: any, next: hapi.ContinuationFunction) => {
        this.server = server;
        return Promise.all([ this.initJobs(options.jobs) ]).then(() => next);
    }

    private async initJobs(jobs: IJob[]) {
        this.server.log("info", `hapi-paypal-intacct::initJobs::${jobs.length} jobs.`);
        let timer;
        for ( const job of jobs) {
            switch (job.name) {
                case "savePayPalInvoices":
                    await this.savePayPalInvoices();
                    timer = later.parse.text(job.latertext);
                    later.setInterval(this.savePayPalInvoices, timer);
                    break;

                case "saveIntacctInvoices":
                    await this.saveIntacctInvoices();
                    timer = later.parse.text(job.latertext);
                    later.setInterval(this.saveIntacctInvoices, timer);
                    break;

                default:
                   throw new Error(`Job not defined: ${job.name}`);
            }
            this.server.log("info", `hapi-paypal-intacct::initJobs::${job.name} scheduled for ${job.latertext}`);
        }
    }

    private async savePayPalInvoices() {
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
        this.server.log("info", `hapi-paypal-intacct::savePayPalInvoices::end`);
    }

    private async savePayPalInvoice(invoice: ppInvoice.Invoice) {
        return await this.paypalInvoice.findOneAndUpdate({ id: invoice.id }, invoice, { upsert: true, new: true });
    }

    private async saveIntacctInvoices() {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        // tslint:disable-next-line:max-line-length
        const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND PAYPALINVOICEMESSAGE not like 'Invoice Sent Successfully' AND  WHENCREATED > "7/1/2017"`;

        const res = await this.server.inject({
            method: "GET",
            url: `/intacct/invoice?query=${encodeURIComponent(query)}`,
        });
        const invoices: any[] = res.result as any[];
        if (invoices.length > 0) {
            for (const invoice of invoices) {
                await this.saveIntacctInvoice(invoice);
            }
        }

        this.server.log("info", `hapi-paypal-intacct::saveIntacctInvoices::end`);
    }

    private async saveIntacctInvoice(invoice: any) {
        return await this
                        .intacctInvoice
                        .findOneAndUpdate({ RECORDNO: invoice.RECORDNO }, invoice, { upsert: true, new: true });
    }
}
