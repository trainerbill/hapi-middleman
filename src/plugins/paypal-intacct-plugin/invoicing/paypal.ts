import * as hapi from "hapi";
import * as paypalSchemas from "hapi-paypal/lib/joi";
import * as joi from "joi";
import * as later from "later";
import { invoice as ppInvoice, notification as ppWebhook, QueryParameters } from "paypal-rest-sdk";

export class HapiPayPalInvoicing {

    private server: hapi.Server;
    private requiredRoutes: string[];

    constructor(server: hapi.Server) {
        this.server = server;
        this.requiredRoutes = [
            "paypal_invoice_search",
            "paypal_invoice_cancel",
            "paypal_invoice_remind",
            "paypal_invoice_create",
            "paypal_invoice_send",
            "paypal_invoice_get",
        ];

        this.validateRoutes();
    }

    public async search(payload: any = {}) {
        const search = await this.server.inject({
            method: "POST",
            payload,
            url: "/paypal/invoice/search",
        });
        return (search.result as ppInvoice.ListResponse).invoices;
    }

    public async get(id: string) {
        const get = await this.server.inject({
            method: "GET",
            url: `/paypal/invoice/${id}`,
        });
        if (get.statusCode !== 200) {
            throw new Error((get.result as any).message);
        }
        return (get.result as ppInvoice.InvoiceResponse);
    }

    public async cancel(id: string) {
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

    public async remind(id: string) {
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

    public async create(payload: any) {
        const validate = joi.validate(payload, paypalSchemas.paypalInvoiceSchema);
        if (validate.error) {
            throw new Error(validate.error.message);
        }
        const create = await this.server.inject({
            method: "POST",
            payload: validate.value,
            url: "/paypal/invoice",
        });
        if (create.statusCode !== 200) {
            throw new Error((create.result as any).message);
        }
        return create;
    }

    private validateRoutes() {
        this.requiredRoutes.forEach((route) => {
            const lroute = this.server.lookup(route);
            if (!lroute) {
                throw new Error(`Intacct ${route} not found.  You must enable this route in the manifest.`);
            }
        });
    }

}
