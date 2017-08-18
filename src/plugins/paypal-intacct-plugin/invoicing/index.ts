import * as hapi from "hapi";
import * as paypalSchemas from "hapi-paypal/lib/joi";
import * as joi from "joi";
import * as later from "later";
import { invoice as ppInvoice, notification as ppWebhook } from "paypal-rest-sdk";
import { HapiIntacctInvoicing } from "./intacct";
import { HapiPayPalInvoicing } from "./paypal";

export * from "./intacct";
export * from "./paypal";

export interface IInvoicingMerchant {
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

export interface IInvoicingOptions {
    autogenerate: boolean;
    cron: {
        create: {
            latertext: string;
        };
        refund?: {
            latertext: string;
        };
    };
    paymentaccounts?: {
        default: string;
        currencies?: {
            [key: string]: string;
        };
    };
    merchant: IInvoicingMerchant;
    reminderDays?: number;
}

export class HapiPayPalIntacctInvoicing {

    public intacct: HapiIntacctInvoicing;
    public paypal: HapiPayPalInvoicing;
    private intacctInvoiceKeys: string[];
    private server: hapi.Server;
    private options: IInvoicingOptions;

    constructor() {
        this.register.attributes = {
            dependencies: ["hapi-paypal", "hapi-intacct"],
            name: "hapi-paypal-intacct-invoicing",
        };
        this.intacctInvoiceKeys = [
            "PAYPALINVOICEID",
            "PAYPALERROR",
            "PAYPALINVOICEURL",
            "PAYPALINVOICESTATUS",
            "PAYPALINVOICING",
        ];
    }

    // tslint:disable-next-line:max-line-length
    public register: hapi.PluginFunction<any> = (server: hapi.Server, options: any, next: hapi.ContinuationFunction) => {
        this.server = server;

        this.intacct = new HapiIntacctInvoicing(this.server);
        this.paypal = new HapiPayPalInvoicing(this.server);

        const promises = [];

        // Validate Options
        const optionsSchema = joi.object().keys({
            autogenerate: joi.boolean().required(),
            cron: joi.object().keys({
                create: joi.object().keys({
                    latertext: joi.string().default("every 1 hour"),
                }).required(),
                refund: joi.object().keys({
                    latertext: joi.string().default("every 1 day"),
                }).optional(),
            }),
            merchant: paypalSchemas.paypalInvoiceBillingInfoSchema.required(),
            paymentaccounts: joi.object().keys({
                currencies: joi.object().optional(),
                default: joi.string().required(),
            }).optional(),
            reminderDays: joi.number().default(30),
        });
        const validate = joi.validate(options, optionsSchema);
        if (validate.error) {
            throw validate.error;
        }
        this.options = validate.value;

        return this.init().then(() => next());
    }

    public async webhookHandler(webhook: ppWebhook.webhookEvent.WebhookEvent) {
        switch (webhook.event_type) {
            case "INVOICING.INVOICE.REFUNDED":
                try {
                    this.intacct.update(webhook.resource.invoice.number, {
                        PAYPALINVOICESTATUS: webhook.resource.invoice.status,
                    });
                } catch (err) {
                    // tslint:disable-next-line:max-line-length
                    this.server.log("error", `hapi-paypal-intacct::webhookHandler::UpdateInvoice::INVOICING.INVOICE.PAID::${webhook.resource.invoice.id}::${err.message}`);
                }

                break;
            case "INVOICING.INVOICE.PAID":
                // const invoice = await this.intacct.get(webhook.resource.invoice.number);
                const invoice: any = {
                    PAYPALERROR: "",
                };
                if (this.options.paymentaccounts) {
                    // Create a payment
                    try {
                        const account = this.options.paymentaccounts.currencies ?
                            this.options.paymentaccounts.currencies[webhook.resource.invoice.total_amount.currency] :
                            this.options.paymentaccounts.default;

                        if (!account) {
                            // tslint:disable-next-line:max-line-length
                            throw new Error(`${webhook.resource.invoice.total_amount.currency} currency payment account not configured`);
                        }

                        // For some reason the object has to be exacly in this order...
                        // tslint:disable:object-literal-sort-keys
                        const create = await this.intacct.createPayment({
                            customerid: webhook.resource.invoice.billing_info[0].additional_info,
                            paymentamount: webhook.resource.invoice.total_amount.value,
                            bankaccountid: account,
                            // tslint:disable-next-line:max-line-length
                            refid: webhook.resource.invoice.payments[webhook.resource.invoice.payments.length - 1].transaction_id,
                            arpaymentitem: [{
                                invoicekey: webhook.resource.invoice.number,
                                amount: webhook.resource.invoice.total_amount.value,
                            }],
                        });
                        // tslint:enable:object-literal-sort-keys
                    } catch (err) {
                        // tslint:disable-next-line:max-line-length
                        this.server.log("error", `hapi-paypal-intacct::webhookHandler::CreatePaymnet::INVOICING.INVOICE.PAID::${webhook.resource.invoice.id}::${err.message}`);
                        const error = JSON.parse(err.message);
                        if (error.length === 1 && error[0].errorno !== "BL03000130") {
                            invoice.PAYPALERROR = err.message;
                        }
                    }
                }

                invoice.PAYPALINVOICESTATUS = webhook.resource.invoice.status;

                // Update Intacct Invoice
                try {
                    this.intacct.update(webhook.resource.invoice.number, invoice);
                } catch (err) {
                    // tslint:disable-next-line:max-line-length
                    this.server.log("error", `hapi-paypal-intacct::webhookHandler::UpdateInvoice::INVOICING.INVOICE.PAID::${webhook.resource.invoice.id}::${err.message}`);
                }

                if (invoice.PAYPALERROR) {
                    throw new Error(invoice.PAYPALERROR);
                }

                break;

            default:
        }
    }

    private async init() {
        const promises: Array<Promise<any>> = [];
        try {
            this.server.log("info", `hapi-paypal-intacct::initInvoicing::${JSON.stringify(this.options)}.`);
            await Promise.all([ this.validateKeys(), this.validateAccounts()]);
            promises.push(this.createInvoiceSync());
            const timer = later.parse.text(this.options.cron.create.latertext);
            later.setInterval(this.createInvoiceSync.bind(this), timer);
            // tslint:disable-next-line:max-line-length
            this.server.log("info", `hapi-paypal-intacct::initInvoicing::create cron set for ${this.options.cron.create.latertext}.`);

            if (this.options.cron.refund) {
                promises.push(this.refundInvoicesSync());
                const refundtimer = later.parse.text(this.options.cron.refund.latertext);
                later.setInterval(this.refundInvoicesSync.bind(this), refundtimer);
                // tslint:disable-next-line:max-line-length
                this.server.log("info", `hapi-paypal-intacct::initInvoicing::refund cron set for ${this.options.cron.refund.latertext}.`);
            }
            await Promise.all(promises);
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::init::${err.message}`);
            throw err;
        }
    }

    private async validateAccounts() {
        const configAccounts: string[] = [];
        if (!this.options.paymentaccounts) {
            return;
        }
        if (this.options.paymentaccounts.default) {
            configAccounts.push(this.options.paymentaccounts.default);
        }
        if (this.options.paymentaccounts.currencies) {
            const keys = Object.keys(this.options.paymentaccounts.currencies);
            keys.forEach((key) => configAccounts.push(this.options.paymentaccounts.currencies[key]));
        }
        try {
            const accounts = await this.intacct.listAccounts();
            configAccounts.forEach((account) => {
            const filteredAccounts = accounts.filter((faccount: any) => {
                return faccount.BANKACCOUNTID === account;
            });
            if (filteredAccounts.length < 1) {
                throw new Error(`Intacct Payment Account ${account} configured but does not exist in Intacct`);
            }
        });
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::validateAccounts::${err.message}`);
            throw err;
        }
    }

    private async validateKeys() {
        try {
            const inspect = await this.intacct.inspect();
            this.intacctInvoiceKeys.forEach((key) => {
                if ((inspect).indexOf(key) === -1) {
                    throw new Error(`${key} not defined.  Add the key to the Intacct Invoice object.`);
                }
            });
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::validateKeys::${err.message}`);
            throw err;
        }
    }

    private async refundInvoicesSync() {
        try {
            const promises: Array<Promise<any>> = [];
            const query = `RAWSTATE = 'V' AND PAYPALINVOICESTATUS = 'PAID'`;
            const invoices = await this.intacct.query(query);
            try {
                invoices.forEach((invoice: any) => promises.push(this.refundInvoiceSync(invoice)));
            } catch (err) {
                this.server.log("error", `hapi-paypal-intacct::refundInvoicesSync::${err.message}`);
            }
            return Promise.all(promises);
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::refundInvoicesSync::${err.message}`);
            throw err;
        }
    }

    private async refundInvoiceSync(invoice: any) {
        try {
            let paypalInvoice;
            try {
                paypalInvoice = await this.paypal.get(invoice.PAYPALINVOICEID);
            } catch (err) {
                throw err;
            }
            try {
                const promises: Array<Promise<any>> = [];
                paypalInvoice.payments.forEach((payment) => promises.push(this.paypal.refund(payment.transaction_id)));
                await Promise.all(promises);
            } catch (err) {
                if (err.message === "Request was refused.This transaction has already been fully refunded") {
                    try {
                        await this.intacct.update(invoice.RECORDNO, {
                            PAYPALINVOICESTATUS: paypalInvoice.status,
                        });
                    } catch (err) {
                        // tslint:disable-next-line:max-line-length
                        this.server.log("error", `hapi-paypal-intacct::refundInvoiceSync::UpdateIntacct::${err.message}`);
                    }
                }
            }
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::refundInvoiceSync::${err.message}`);
        }
    }

    private async createInvoiceSync() {
        // TODO: SHore up this query
        // tslint:disable-next-line:max-line-length
        let query = process.env.INTACCT_INVOICE_QUERY || `RAWSTATE = 'A' AND ( PAYPALINVOICESTATUS IN (NULL,'DRAFT') OR PAYPALINVOICEID IS NULL ) AND WHENCREATED > '8/1/2017'`;
        if (this.options.autogenerate) {
            // TODO: add the query when Intacct tells me how to query based on a checkbox value
            // query += ` AND PAYPALINVOICING`;
            query = query; // TODO: REMOVE
        }
        const promises: Array<Promise<any>> = [];
        try {
            // tslint:disable-next-line:max-line-length
            const invoices = await Promise.all([this.intacct.query(query, ["RECORDNO"]), this.paypal.search({ status: ["SENT", "UNPAID"] })]);
            invoices[0].forEach((invoice: any) => promises.push(this.syncIntacctToPayPal(invoice)));
            invoices[1].forEach((invoice) => promises.push(this.syncPayPalToIntacct(invoice)));
            await Promise.all(promises);
            this.server.log("info", "hapi-paypal-intacct::syncInvoices::Success");
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::syncInvoices::Error::${err.message}`);
        }
    }

    private async syncIntacctToPayPal(invoice: any) {
        let paypalInvoice: ppInvoice.Invoice;
        let intacctInvoice: any;
        const intacctUpdate: any = {
            PAYPALERROR: "",
        };
        try {
            const fullInvoices = await Promise.all([
                this.intacct.get(invoice.RECORDNO),
                this.paypal.search({ number: invoice.RECORDNO }),
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
                const create = await this.paypal.create(this.toPaypalInvoice(intacctInvoice));
                paypalInvoice = (create as ppInvoice.InvoiceResponse);
                intacctInvoice.PAYPALINVOICEID = paypalInvoice.id;
            }

            intacctUpdate.PAYPALINVOICEID = paypalInvoice.id;
            intacctUpdate.PAYPALINVOICESTATUS = paypalInvoice.status;

            if (paypalInvoice.status === "DRAFT") {
                await this.paypal.send(paypalInvoice.id);
                // Need to reget the invoice for the Payment URL
                paypalInvoice = await this.paypal.get(paypalInvoice.id);
            }

            intacctUpdate.PAYPALINVOICESTATUS = paypalInvoice.status;
            intacctUpdate.PAYPALINVOICEURL = (paypalInvoice.metadata as any).payer_view_url;

        } catch (err) {
            // tslint:disable-next-line:max-line-length
            this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdatePayPal::${intacctInvoice.RECORDNO}::${err.message}`);
            intacctUpdate.PAYPALERROR += `${JSON.stringify(err.message)}\n`;
        }

        try {
            await this.intacct.update(intacctInvoice.RECORDNO, intacctUpdate);
        } catch (err) {
            // tslint:disable-next-line:max-line-length
            this.server.log("error", `hapi-paypal-intacct::syncInvoices::UpdateIntacct::${intacctInvoice.RECORDNO}::${err.message}`);
        }
    }

    private async syncPayPalToIntacct(invoice: ppInvoice.Invoice) {
        try {
            const intacctInvoice = await this.intacct.get(invoice.number);
            if (!intacctInvoice || intacctInvoice.STATE !== "Posted") {
                await this.paypal.cancel(invoice.id);
            } else {
                const reminder = new Date((invoice.metadata as any).last_sent_date + this.options.reminderDays);
                const now = new Date();
                if (now > reminder) {
                    await this.paypal.remind(invoice.id);
                }
            }
        } catch (err) {
            this.server.log("error", `hapi-paypal-intacct::syncInvoicePayPalToIntacct::${err.message}`);
        }
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
