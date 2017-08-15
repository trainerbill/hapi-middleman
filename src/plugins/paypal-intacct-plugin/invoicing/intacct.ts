import * as hapi from "hapi";
import { intacctPaymentSchema } from "hapi-intacct/lib/joi";
import * as joi from "joi";
import * as later from "later";

export class HapiIntacctInvoicing {

    private server: hapi.Server;
    private requiredRoutes: string[];

    constructor(server: hapi.Server) {
        this.server = server;
        this.requiredRoutes = [
            "intacct_invoice_query",
            "intacct_invoice_read",
            "intacct_invoice_update",
            "intacct_invoice_inspect",
            "intacct_payment_create",
        ];

        this.validateRoutes();
    }

    public async get(id: string) {
        const get = await this.server.inject({
            method: "GET",
            url: `/intacct/invoice/${id}`,
        });
        if (get.statusCode !== 200) {
            throw new Error((get.result as any).message);
        }
        return (get.result as any);
    }

    public async update(id: string, payload: any) {
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

    public async createPayment(payload: any) {

        const validate = joi.validate(payload, intacctPaymentSchema);

        if (validate.error) {
            throw new Error(validate.error.message);
        }

        const create = await this.server.inject({
            method: "POST",
            payload,
            url: `/intacct/payment`,
        });
        if (create.statusCode !== 200) {
            throw new Error((create.result as any).message);
        }
        return (create.result as any);
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
