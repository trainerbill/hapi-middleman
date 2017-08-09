import * as hapi from "hapi";
import { notification as ppWebhook } from "paypal-rest-sdk";
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
export declare class HapiPayPalIntacct {
    private jobs;
    private server;
    private options;
    private paypalInvoiceSchema;
    private intacctInvoiceKeys;
    constructor();
    register: hapi.PluginFunction<any>;
    webhookHandler(webhook: ppWebhook.webhookEvent.WebhookEvent): Promise<void>;
    private validateInvoiceKeys();
    private initJobs();
    private syncInvoices();
    private syncInvoiceIntacctToPayPal(invoice);
    private syncInvoicesIntacctToPayPal();
    private syncInvoicePayPalToIntacct(invoice);
    private syncInvoicesPayPalToIntacct();
    private searchPayPalInvoice(payload?);
    private getPayPalInvoice(id);
    private cancelPayPalInvoice(id);
    private remindPayPalInvoice(id);
    private getIntacctInvoice(id);
    private updateIntacctInvoice(id, payload);
    private toPaypalInvoice(intacctInvoice);
    private toPayPalLineItems(arrInvoiceItems);
}
