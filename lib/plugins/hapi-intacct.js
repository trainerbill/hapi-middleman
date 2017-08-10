"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hapi_intacct_1 = require("hapi-intacct");
exports.hapiIntacct = new hapi_intacct_1.HapiIntacct();
exports.hapiIntacctOptions = {
    routes: [
        {
            config: {
                id: "intacct_invoice_query",
            },
        },
        {
            config: {
                id: "intacct_invoice_read",
            },
        },
        {
            config: {
                id: "intacct_invoice_update",
            },
        },
        {
            config: {
                id: "intacct_invoice_inspect",
            },
        },
    ],
    sdk: {
        auth: {
            companyId: process.env.INTACCT_COMPANY_ID,
            password: process.env.INTACCT_USER_PASSWORD,
            senderId: process.env.INTACCT_SENDER_ID,
            senderPassword: process.env.INTACCT_SENDER_PASSWORD,
            sessionId: process.env.INTACCT_SESSION_ID,
            userId: process.env.INTACCT_USER_ID,
        },
    },
};
exports.hapiIntacctPlugin = {
    options: exports.hapiIntacctOptions,
    register: exports.hapiIntacct.register,
};
exports.hapiIntacctGlueRegistration = {
    plugin: exports.hapiIntacctPlugin,
};
//# sourceMappingURL=hapi-intacct.js.map