import * as boom from "boom";
import { PluginRegistrationObject } from "hapi";
import { HapiPayPal, IHapiPayPalOptions } from "hapi-paypal";
import { hapiPayPalIntacctInvoicing } from "./invoicing";

export const hapiPayPal = new HapiPayPal();

export const hapiPayPalOptions: IHapiPayPalOptions = {
    routes: [
        {
            config: {
                id: "paypal_sale_refund",
                isInternal: true,
            },
        },
        {
            config: {
                id: "paypal_invoice_search",
                isInternal: true,
            },
        },
        {
            config: {
                id: "paypal_invoice_cancel",
                isInternal: true,
            },
        },
        {
            config: {
                id: "paypal_invoice_remind",
                isInternal: true,
            },
        },
        {
            config: {
                id: "paypal_invoice_create",
                isInternal: true,
            },
        },
        {
            config: {
                id: "paypal_invoice_send",
                isInternal: true,
            },
        },
        {
            config: {
                id: "paypal_invoice_get",
                isInternal: true,
            },
        },
    ],
    sdk: {
        client_id: process.env.PAYPAL_CLIENT_ID,
        client_secret: process.env.PAYPAL_CLIENT_SECRET,
        headers: {
            "PayPal-Partner-Attribution-Id": "Hapi-Middleman",
        },
        mode: process.env.PAYPAL_MODE,
    },
};

export const hapiPayPalPlugin: PluginRegistrationObject<any> = {
    options: hapiPayPalOptions,
    register: hapiPayPal.register,
    select: ["private"],
};

export const hapiPayPalGlueRegistration = {
    plugin: hapiPayPalPlugin,
};
