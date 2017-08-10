"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paypal_intacct_plugin_1 = require("./paypal-intacct-plugin");
exports.hapiPayPalIntacct = new paypal_intacct_plugin_1.HapiPayPalIntacct();
exports.hapiPayPalIntacctPlugin = {
    options: {
        jobs: [
            {
                latertext: "every 1 minute",
                name: "syncInvoices",
            },
        ],
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
        reminderDays: process.env.INVOICE_REMINDER_DAYS * 1,
    },
    register: exports.hapiPayPalIntacct.register,
};
exports.hapiPayPalIntacctGlueRegistration = {
    plugin: exports.hapiPayPalIntacctPlugin,
};
//# sourceMappingURL=paypal-intacct.js.map