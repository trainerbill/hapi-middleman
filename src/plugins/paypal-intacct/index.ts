import * as hapi from "hapi";
import * as later from "later";
import { invoice as ppInvoice, notification as ppWebhook } from "paypal-rest-sdk";

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

    constructor() {
        this.register.attributes = {
            dependencies: ["hapi-paypal", "hapi-intacct"],
            name: "hapi-paypal-intacct",
        };
    }

    // tslint:disable-next-line:max-line-length
    public register: hapi.PluginFunction<any> = (server: hapi.Server, options: any, next: hapi.ContinuationFunction) => {
        this.server = server;
        return Promise.all([ this.initJobs(options.jobs) ]).then(() => next);
    }

    public async webhookHandler(webhook: ppWebhook.webhookEvent.WebhookEvent) {
        // TODO: ARPAMENT ETC
        const invoice: any = {};
        switch (webhook.event_type) {
            case "INVOICING.INVOICE.PAID":
                invoice.PAYPALINVOICESTATUS = webhook.resource.status;
                break;

            default:
        }

        // Update Invoice
        try {
            const update = await this.server.inject({
                method: "PUT",
                payload: invoice,
                url: `/intacct/invoice/${webhook.resource.number}`,
            });
            if (update.statusCode !== 200) {
                throw new Error((update.result as any).message);
            }
        } catch (err) {
            // tslint:disable-next-line:max-line-length
            this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${invoice.RECORDNO}::${err.message}`);
        }
    }

    private async initJobs(jobs: IJob[]) {
        this.server.log("info", `hapi-paypal-intacct::initJobs::${jobs.length} jobs.`);
        let timer;
        for ( const job of jobs) {
            switch (job.name) {
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

    private async syncInvoices() {
        // tslint:disable-next-line:max-line-length
        const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND ( PAYPALINVOICESTATUS IN ('','DRAFT') OR PAYPALINVOICEID = '' ) AND WHENCREATED > '8/1/2017'`;

        const res = await this.server.inject({
            method: "GET",
            url: `/intacct/invoice?query=${encodeURIComponent(query)}`,
        });
        const invoices: any[] = res.result as any[];
        if (invoices.length > 0) {
            for (const invoice of invoices) {
                let paypalInvoice: ppInvoice.Invoice;
                try {
                    if (!invoice.PAYPALINVOICEID) {
                        // Try and find an invoice based on RECORDNO.  Its possible the update to intacct failed.
                        const find = await this.server.inject({
                            method: "POST",
                            payload: {
                                number: invoice.RECORDNO,
                            },
                            url: "/paypal/invoice/search",
                        });

                        if ((find.result as ppInvoice.ListResponse).invoices.length !== 0) {
                            paypalInvoice = (find.result as ppInvoice.ListResponse).invoices[0];
                            invoice.PAYPALINVOICEID = paypalInvoice.id;
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
                            paypalInvoice = (create.result as ppInvoice.InvoiceResponse);
                            invoice.PAYPALINVOICEID = paypalInvoice.id;
                        }
                    } else {
                        const get = await this.server.inject({
                            method: "GET",
                            payload: this.toPaypalInvoice(invoice),
                            url: `/paypal/invoice/${invoice.PAYPALINVOICEID}`,
                        });
                        if (get.statusCode !== 200) {
                            throw new Error((get.result as any).message);
                        }
                        paypalInvoice = (get.result as ppInvoice.InvoiceResponse);
                    }

                    if (paypalInvoice.status === "DRAFT") {
                        const send = await this.server.inject({
                            method: "POST",
                            url: `/paypal/invoice/${invoice.PAYPALINVOICEID}/send`,
                        });
                        if (send.statusCode !== 200) {
                            throw new Error((send.result as any).message);
                        }
                        invoice.PAYPALINVOICESTATUS = "SENT";
                    } else {
                        invoice.PAYPALINVOICESTATUS = paypalInvoice.status;
                    }
                } catch (err) {
                    // tslint:disable-next-line:max-line-length
                    this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${invoice.RECORDNO}::${err.message}`);
                    invoice.PAYPALERROR = JSON.stringify(err.message);
                }

                try {
                    const update = await this.server.inject({
                        method: "PUT",
                        payload: {
                            PAYPALERROR: invoice.PAYPALERROR,
                            PAYPALINVOICEID: invoice.PAYPALINVOICEID,
                            PAYPALINVOICESTATUS: invoice.PAYPALINVOICESTATUS,
                            PAYPALINVOICEURL: (paypalInvoice.metadata as any).payer_view_url,
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

    private async toPaypalInvoice(intacctInvoice: any) {
        // const arrPPInvItems = await this.toPayPalLineItems(intacctInvoice.ARINVOICEITEMS.arinvoiceitem);

        const paypalInvoice: ppInvoice.Invoice = {
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

        const arrPPInvItems: ppInvoice.InvoiceItem[] = [];

        if (arrInvoiceItems.length > 0) {
            for (const item of arrInvoiceItems) {
                const ritem: ppInvoice.InvoiceItem = {
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
