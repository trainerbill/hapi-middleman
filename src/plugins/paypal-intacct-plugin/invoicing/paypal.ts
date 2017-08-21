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
            "paypal_invoice_update",
            "paypal_sale_refund",
        ];

        this.validateRoutes();
    }

    public async search(payload: any = {}) {
        const search = await this.server.inject({
            allowInternals: true,
            method: "POST",
            payload,
            url: "/paypal/invoice/search",
        });
        return (search.result as ppInvoice.ListResponse).invoices;
    }

    public async get(id: string) {
        const get = await this.server.inject({
            allowInternals: true,
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
            allowInternals: true,
            method: "POST",
            payload: {},
            url: `/paypal/invoice/${id}/cancel`,
        });
        if (cancel.statusCode !== 200) {
            throw new Error((cancel.result as any).message);
        }
        return cancel.result;
    }

    public async remind(id: string) {
        const remind = await this.server.inject({
            allowInternals: true,
            method: "POST",
            payload: {},
            url: `/paypal/invoice/${id}/remind`,
        });
        if (remind.statusCode !== 200) {
            throw new Error((remind.result as any).message);
        }
        return remind.result;
    }

    public async send(id: string, payload = {}) {
        const send = await this.server.inject({
            allowInternals: true,
            method: "POST",
            payload,
            url: `/paypal/invoice/${id}/send`,
        });
        if (send.statusCode !== 200) {
            throw new Error((send.result as any).message);
        }
        return send.result;
    }

    public async refund(id: string) {
        const refund = await this.server.inject({
            allowInternals: true,
            method: "POST",
            payload: {},
            url: `/paypal/sale/${id}/refund`,
        });
        if (refund.statusCode !== 200) {
            throw new Error((refund.result as any).message);
        }
        return refund.result;
    }

    public async create(payload: any) {
        const validate = joi.validate(payload, paypalSchemas.paypalInvoiceSchema);
        if (validate.error) {
            throw new Error(validate.error.message);
        }
        const create = await this.server.inject({
            allowInternals: true,
            method: "POST",
            payload: validate.value,
            url: "/paypal/invoice",
        });
        if (create.statusCode !== 200) {
            throw new Error((create.result as any).message);
        }
        return create.result;
    }

    public async update(id: string, payload: any) {
        const validate = joi.validate(payload, paypalSchemas.paypalInvoiceSchema);
        if (validate.error) {
            throw new Error(validate.error.message);
        }
        const update = await this.server.inject({
            allowInternals: true,
            method: "PUT",
            payload: validate.value,
            url: `/paypal/invoice/${id}`,
        });
        if (update.statusCode !== 200) {
            throw new Error((update.result as any).message);
        }
        return update.result;
    }

    private validateRoutes() {
        this.requiredRoutes.forEach((route) => {
            let valid = false;
            this.server.connections.forEach((connection) => {
                if (!valid && connection.lookup(route)) {
                    valid = true;
                }
            });

            if (!valid) {
                throw new Error(`PayPal ${route} not found.  You must enable this route in the manifest.`);
            }
        });
    }
}
