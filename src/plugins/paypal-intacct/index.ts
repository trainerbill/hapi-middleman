import * as hapi from "hapi";
import * as intacctModels from "hapi-intacct/lib/models/mongoose";
import * as paypalModels from "hapi-paypal/lib/models/mongoose";
import * as later from "later";
import * as mongoose from "mongoose";
import * as paypal from "paypal-rest-sdk";
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

                case "syncInvoices":
                    await this.syncInvoices();
                    timer = later.parse.text(job.latertext);
                    later.setInterval(this.syncInvoices, timer);
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

    private async syncInvoices() {
        // tslint:disable-next-line:max-line-length
        const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND WHENCREATED > "8/1/2017"`;

        const res = await this.server.inject({
            method: "GET",
            url: `/intacct/invoice?query=${encodeURIComponent(query)}`,
        });
        const invoices: any[] = res.result as any[];
        if (invoices.length > 0) {
            for (const invoice of invoices) {
                try {
                    if (!invoice.PAYPALINVOICEID) {
                        // Try and find invoice at PayPal in case an update to intacct failed
                        let paypalInvoice: paypal.invoice.Invoice;
                        const find = await this.server.inject({
                            method: "POST",
                            payload: {
                                number: invoice.RECORDNO,
                            },
                            url: "/paypal/invoice/search",
                        });

                        if ((find.result as paypal.invoice.ListResponse).invoices.length !== 0) {
                            paypalInvoice = (find.result as paypal.invoice.ListResponse).invoices[0];
                        } else {
                            // Create a PayPal Invoice
                            const create = await this.server.inject({
                                method: "POST",
                                payload: this.toPaypalInvoice(invoice),
                                url: "/paypal/invoice",
                            });
                            if (create.statusCode !== 200) {
                                throw new Error((create.result as any).message);
                            }
                            paypalInvoice = (create.result as paypal.invoice.InvoiceResponse);
                        }

                        invoice.PAYPALINVOICEID = paypalInvoice.id;
                        // Its possible the invoice was sent but update to intacct failed.
                        if (paypalInvoice.status !== "DRAFT") {
                            invoice.PAYPALINVOICEMESSAGE = "Invoice Sent Successfully";
                        }
                    }

                    if (invoice.PAYPALINVOICEMESSAGE !== "Invoice Sent Successfully") {
                        const send = await this.server.inject({
                            method: "POST",
                            url: `/paypal/invoice/${invoice.id}/send`,
                        });
                        if (send.statusCode !== 200) {
                            throw new Error((send.result as any).message);
                        }
                        invoice.PAYPALINVOICEMESSAGE = "Invoice Sent Successfully";
                    }
                } catch (err) {
                    // tslint:disable-next-line:max-line-length
                    this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${invoice.RECORDNO}::${err.message}`);
                    invoice.PAYPALINVOICEMESSAGE = JSON.stringify(err.message);
                }

                try {
                    const update = await this.server.inject({
                        method: "PUT",
                        payload: {
                            PAYPALINVOICEID: invoice.PAYPALINVOICEID,
                            PAYPAYPALINVOICEMESSAGE: invoice.PAYPALINVOICEMESSAGE,
                        },
                        url: `/intacct/invoice/${invoice.RECORDNO}`,
                    });
                    if (update.statusCode !== 200) {
                        throw new Error((update.result as any).message);
                    }
                } catch (err) {
                    // tslint:disable-next-line:max-line-length
                    this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${invoice.RECORDNO}::${err.message}`);
                }
            }
        }

        this.server.log("info", `hapi-paypal-intacct::saveIntacctInvoices::end`);
    }

    private async saveIntacctInvoice(invoice: any) {
        return await this
                        .intacctInvoice
                        .findOneAndUpdate({ RECORDNO: invoice.RECORDNO }, invoice, { upsert: true, new: true });
    }

    private async toPaypalInvoice(intacctInvoice: any) {
        // const arrPPInvItems = await this.toPayPalLineItems(intacctInvoice.ARINVOICEITEMS.arinvoiceitem);

        const paypalInvoice: paypal.invoice.Invoice = {
            billing_info: {
                email: intacctInvoice["BILLTO.EMAIL1"],
            },
            // items: arrPPInvItems,
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
    }

    private async toPayPalLineItems(arrInvoiceItems: any) {

        const arrPPInvItems: paypal.invoice.InvoiceItem[] = [];

        if (arrInvoiceItems.length > 0) {
            for (const item of arrInvoiceItems) {
                const ritem: paypal.invoice.InvoiceItem = {
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
    }
}
