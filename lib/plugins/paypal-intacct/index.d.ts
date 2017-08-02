import * as hapi from "hapi";
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
    private paypalInvoice;
    private intacctInvoice;
    constructor();
    register: hapi.PluginFunction<any>;
    private initJobs(jobs);
    private savePayPalInvoices();
    private savePayPalInvoice(invoice);
    private saveIntacctInvoices();
    private saveIntacctInvoice(invoice);
}
