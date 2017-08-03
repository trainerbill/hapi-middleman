import * as hapi from "hapi";
import { notification as ppWebhook } from "paypal-rest-sdk";
export interface IJob {
    name: string;
    latertext: string;
}
export interface IHapiPayPalIntacctOptions {
    jobs?: IJob[];
}
export declare class HapiPayPalIntacct {
    private jobs;
    private server;
    constructor();
    register: hapi.PluginFunction<any>;
    webhookHandler(webhook: ppWebhook.webhookEvent.WebhookEvent): Promise<void>;
    private initJobs(jobs);
    private syncInvoices();
    private toPaypalInvoice(intacctInvoice);
    private toPayPalLineItems(arrInvoiceItems);
}
