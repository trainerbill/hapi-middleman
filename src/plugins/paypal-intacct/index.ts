import * as hapi from "hapi";
import * as paypalSchemas from "hapi-paypal/lib/joi";
import * as hoek from "hoek";
import * as joi from "joi";
import * as later from "later";
import { invoice as ppInvoice, notification as ppWebhook, QueryParameters } from "paypal-rest-sdk";

export interface IJob {
    name: string;
    latertext: string;
}

export interface IMerchant {
    address: {
        city: string;
        country_code: string;
        line1: string;
        postal_code: string;
        state: string;
    };
    business_name: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone: {
        country_code: string;
        national_number: string;
    };
}

export interface IHapiPayPalIntacctOptions {
    jobs?: IJob[];
    reminderDays?: number;
    merchant: IMerchant;
}

export class HapiPayPalIntacct {
    private jobs: Map<string, any> = new Map();
    private server: hapi.Server;
    private options: IHapiPayPalIntacctOptions;
    private paypalInvoiceSchema: joi.ObjectSchema;
    private intacctInvoiceKeys: string[];

    constructor() {
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

    // tslint:disable-next-line:max-line-length
    public register: hapi.PluginFunction<any> = (server: hapi.Server, options: any, next: hapi.ContinuationFunction) => {
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

        return Promise.all([ this.validateInvoiceKeys(), this.initJobs() ]).then(() => next());
    }

    public async webhookHandler(webhook: ppWebhook.webhookEvent.WebhookEvent) {
        // TODO: ARPAMENT ETC
        const invoice: any = {};
        switch (webhook.event_type) {
            case "INVOICING.INVOICE.PAID":
                invoice.PAYPALINVOICESTATUS = webhook.resource.invoice.status;
                // Update Invoice
                try {
                    const update = await this.server.inject({
                        method: "PUT",
                        payload: invoice,
                        url: `/intacct/invoice/${webhook.resource.invoice.number}`,
                    });
                    if (update.statusCode !== 200) {
                        throw new Error((update.result as any).message);
                    }
                } catch (err) {
                    // tslint:disable-next-line:max-line-length
                    this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${invoice.RECORDNO}::${err.message}`);
                }
                break;

            default:
        }
    }

    private async validateInvoiceKeys() {
        const inspect = await this.server.inject({
            method: "OPTIONS",
            url: `/intacct/invoice`,
        });
        if (inspect.statusCode !== 200) {
            throw new Error((inspect.result as any).message);
        }
        this.intacctInvoiceKeys.forEach((key) => {
            if ((inspect.result as any).indexOf(key) === -1) {
                throw new Error(`${key} not defined.  Add the key to the Intacct Invoice object.`);
            }
        });
    }

    private async initJobs() {
        this.server.log("info", `hapi-paypal-intacct::initJobs::${this.options.jobs.length} jobs.`);
        let timer;
        for ( const job of this.options.jobs) {
            switch (job.name) {
                case "syncInvoices":
                    await this.syncInvoices();
                    timer = later.parse.text(job.latertext);
                    later.setInterval(this.syncInvoices.bind(this), timer);
                    break;

                default:
                   throw new Error(`Job not defined: ${job.name}`);
            }
            this.server.log("info", `hapi-paypal-intacct::initJobs::${job.name} scheduled for ${job.latertext}`);
        }
    }

    private async syncInvoices() {
        return Promise
                .all([ this.syncInvoicesPayPalToIntacct(), this.syncInvoicesIntacctToPayPal()])
                .then(() => this.server.log("info", "hapi-paypal-intacct::syncInvoices::Success"))
                // tslint:disable-next-line:max-line-length
                .catch((err: Error) => this.server.log("error", `hapi-paypal-intacct::syncInvoices::Error::${err.message}`));
    }

    private async syncInvoiceIntacctToPayPal(invoice: any) {
        let paypalInvoice: ppInvoice.Invoice;
        let intacctInvoice: any;
        const intacctUpdate: any = {
            PAYPALERROR: "",
        };
        try {
            const fullInvoices = await Promise.all([
                this.getIntacctInvoice(invoice.RECORDNO),
                this.searchPayPalInvoice({ number: invoice.RECORDNO }),
            ]);
            intacctInvoice = fullInvoices[0];
            if (fullInvoices[1].length === 1) {
                paypalInvoice = fullInvoices[1][0];
                intacctInvoice.PAYPALINVOICEID = paypalInvoice.id;
            } else if (fullInvoices[1].length > 1) {
                const ids = fullInvoices[1].map((inv) => inv.id);
                // tslint:disable-next-line:max-line-length
                const error = `Multiple PayPal Invoice IDs ${ids}.  You should login to paypal and cancel one.\n`;
                intacctInvoice.PAYPALERROR += error;
                this.server.log("warn", error);
            }

            if (!intacctInvoice.PAYPALINVOICEID) {
                // Create a PayPal Invoice
                const create = await this.server.inject({
                    method: "POST",
                    payload: this.toPaypalInvoice(intacctInvoice),
                    url: "/paypal/invoice",
                });
                if (create.statusCode !== 200) {
                    throw new Error((create.result as any).message);
                }
                paypalInvoice = (create.result as ppInvoice.InvoiceResponse);
                intacctInvoice.PAYPALINVOICEID = paypalInvoice.id;
            }

            intacctUpdate.PAYPALINVOICEID = paypalInvoice.id;
            intacctUpdate.PAYPALINVOICESTATUS = paypalInvoice.status;


            if (paypalInvoice.status === "DRAFT") {
                const send = await this.server.inject({
                    method: "POST",
                    url: `/paypal/invoice/${paypalInvoice.id}/send`,
                });
                if (send.statusCode !== 200) {
                    throw new Error((send.result as any).message);
                }

                // Need to reget the invoice for the Payment URL
                paypalInvoice = await this.getPayPalInvoice(paypalInvoice.id);
            }

            intacctUpdate.PAYPALINVOICESTATUS = paypalInvoice.status;
            intacctUpdate.PAYPALINVOICEURL = (paypalInvoice.metadata as any).payer_view_url;

        } catch (err) {
            // tslint:disable-next-line:max-line-length
            this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${intacctInvoice.RECORDNO}::${err.message}`);
            intacctUpdate.PAYPALERROR += `${JSON.stringify(err.message)}\n`;
        }

        try {
            return this.updateIntacctInvoice(intacctInvoice.RECORDNO, intacctUpdate);
        } catch (err) {
            // tslint:disable-next-line:max-line-length
            this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${intacctInvoice.RECORDNO}::${err.message}`);
        }
    }

    private async syncInvoicesIntacctToPayPal() {
        // tslint:disable-next-line:max-line-length
        const query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND ( PAYPALINVOICESTATUS IN (NULL,'DRAFT') OR PAYPALINVOICEID IS NULL ) AND WHENCREATED > '8/1/2017'`;
        const promises: Array<Promise<any>> = [];
        const res = await this.server.inject({
            method: "GET",
            url: `/intacct/invoice?query=${encodeURIComponent(query)}&fields=RECORDNO`,
        });
        const invoices: any[] = res.result as any[];
        invoices.forEach((invoice) => promises.push(this.syncInvoiceIntacctToPayPal(invoice)));
        return Promise.all(promises);
    }

    private async syncInvoicePayPalToIntacct(invoice: ppInvoice.Invoice) {
        try {
            const intacctInvoice = await this.getIntacctInvoice(invoice.number);
            if (!intacctInvoice || intacctInvoice.STATE !== "Posted") {
                await this.cancelPayPalInvoice(invoice.id);
            } else {
                const reminder = new Date((invoice.metadata as any).last_sent_date + this.options.reminderDays);
                const now = new Date();
                if (now > reminder) {
                    await this.remindPayPalInvoice(invoice.id);
                }
            }
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::syncInvoicePayPalToIntacct::${err.message}`);
        }
    }
    private async syncInvoicesPayPalToIntacct() {
        const paypalInvoices = await this.searchPayPalInvoice({ status: ["SENT", "UNPAID"] });
        const promises: Array<Promise<any>> = [];
        paypalInvoices.forEach((invoice) => promises.push(this.syncInvoicePayPalToIntacct(invoice)));
        return Promise.all(promises);
    }

    // Change to QueryParameters when type is fixed
    private async searchPayPalInvoice(payload: any = {}) {
        const search = await this.server.inject({
            method: "POST",
            payload,
            url: "/paypal/invoice/search",
        });
        return (search.result as ppInvoice.ListResponse).invoices;
    }

    private async getPayPalInvoice(id: string) {
        const get = await this.server.inject({
            method: "GET",
            url: `/paypal/invoice/${id}`,
        });
        if (get.statusCode !== 200) {
            throw new Error((get.result as any).message);
        }
        return (get.result as ppInvoice.InvoiceResponse);
    }

    private async cancelPayPalInvoice(id: string) {
        const cancel = await this.server.inject({
            method: "POST",
            payload: {},
            url: `/paypal/invoice/${id}/cancel`,
        });
        if (cancel.statusCode !== 200) {
            throw new Error((cancel.result as any).message);
        }
        return cancel;
    }

    private async remindPayPalInvoice(id: string) {
        const remind = await this.server.inject({
            method: "POST",
            payload: {},
            url: `/paypal/invoice/${id}/remind`,
        });
        if (remind.statusCode !== 200) {
            throw new Error((remind.result as any).message);
        }
        return remind;
    }

    private async getIntacctInvoice(id: string) {
        const get = await this.server.inject({
            method: "GET",
            url: `/intacct/invoice/${id}`,
        });
        if (get.statusCode !== 200) {
            throw new Error((get.result as any).message);
        }
        return (get.result as any);
    }

    private async updateIntacctInvoice(id: string, payload: any) {
        const update = await this.server.inject({
            method: "PUT",
            payload,
            url: `/intacct/invoice/${id}`,
        });
        if (update.statusCode !== 200) {
            throw new Error((update.result as any).message);
        }
        return update.result;
    }

    private toPaypalInvoice(intacctInvoice: any) {
        // TODO: change to ppInvoice.Invoice when billing_info is fixed
        const paypalInvoice: any = {
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

    private toPayPalLineItems(arrInvoiceItems: any) {

        const arrPPInvItems: ppInvoice.InvoiceItem[] = [];

        if (arrInvoiceItems.length > 0) {
            for (const item of arrInvoiceItems) {
                const ritem: ppInvoice.InvoiceItem = {
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
