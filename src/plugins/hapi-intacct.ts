import { PluginRegistrationObject } from "hapi";
import { HapiIntacct, IHapiIntacctOptions } from "hapi-intacct";

export const hapiIntacct = new HapiIntacct();

export const hapiIntacctOptions: IHapiIntacctOptions = {
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
        /*
        controlId: process.env.INTACCT_CONTROL_ID || "testRequestId",
        dtdVersion: process.env.INTACCT_DTD_VERSION || "3.0",
        uniqueId: process.env.INTACCT_CONTROL_ID || false,
        */
    },
};

export const hapiIntacctPlugin: PluginRegistrationObject<any> = {
    options: hapiIntacctOptions,
    register: hapiIntacct.register,
};

export const hapiIntacctGlueRegistration = {
    plugin: hapiIntacctPlugin,
};
