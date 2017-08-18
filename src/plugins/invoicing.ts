import { PluginRegistrationObject } from "hapi";
import { HapiPayPalIntacctInvoicing, IInvoicingOptions } from "./paypal-intacct-plugin";

export const hapiPayPalIntacctInvoicing = new HapiPayPalIntacctInvoicing();

export const hapiInvoicingOptions: IInvoicingOptions = {
    autogenerate: process.env.INVOICING_AUTO ? true : false,
    cron: {
        create: {
            latertext: "every 1 hour",
        },
        refund: {
            latertext: "every 1 day",
        },
    },
    merchant: {
        address: {
            city: process.env.PAYPAL_MERCHANT_ADDRESS_CITY,
            country_code: process.env.PAYPAL_MERCHANT_COUNTRY_CODE,
            line1: process.env.PAYPAL_MERCHANT_ADDRESS_LINE1,
            postal_code: process.env.PAYPAL_MERCHANT_COUNTRY_POSTAL_CODE,
            state: process.env.PAYPAL_MERCHANT_COUNTRY_STATE,
        },
        business_name: process.env.PAYPAL_MERCHANT_BUSINESS_NAME,
        email: process.env.PAYPAL_MERCHANT_EMAIL,
        first_name: process.env.PAYPAL_MERCHANT_FIRST_NAME,
        last_name: process.env.PAYPAL_MERCHANT_LAST_NAME,
        phone: {
            country_code: process.env.PAYPAL_MERCHANT_PHONE_COUNTRY_CODE,
            national_number: process.env.PAYPAL_MERCHANT_PHONE_NUMBER,
        },
    },
    paymentaccounts: {
        default: "Suntrust",
    },
    reminderDays: process.env.INVOICE_REMINDER_DAYS ? process.env.INVOICE_REMINDER_DAYS * 1 : undefined,
};

export const hapiPayPalIntacctPlugin: PluginRegistrationObject<any> = {
    options: hapiInvoicingOptions,
    register: hapiPayPalIntacctInvoicing.register,
    select: ["private"],
};

export const hapiPayPalIntacctGlueRegistration = {
    plugin: hapiPayPalIntacctPlugin,
};
