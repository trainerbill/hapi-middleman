import * as hapi from "hapi";
export interface IHapiPayPalIntacctOptions {
    invoicing?: boolean;
}
export declare class HapiPayPalIntacct {
    private jobs;
    private server;
    private paypalInvoice;
    constructor();
    register: hapi.PluginFunction<any>;
    private initInvoicing();
    private savePayPalInvoice(invoice);
}
