import { goodGlueRegistration } from "./good";
import { hapiIntacctGlueRegistration } from "./hapi-intacct";
import { hapiPayPalGlueRegistration } from "./hapi-paypal";
import { hapiPayPalWebhooksGlueRegistration } from "./hapi-paypal-webhooks";
import { hapiPayPalIntacctGlueRegistration } from "./invoicing";
import { tryGlueRegistration } from "./therealyou";
import { wozuGlueRegistration } from "./wozu";

export const GlueRegistrations: any = [
    goodGlueRegistration,
    hapiIntacctGlueRegistration,
    hapiPayPalGlueRegistration,
    hapiPayPalWebhooksGlueRegistration,
    hapiPayPalIntacctGlueRegistration,
    tryGlueRegistration,
    wozuGlueRegistration,
];

export * from "./invoicing";
export * from "./good";
export * from "./hapi-intacct";
export * from "./hapi-paypal";
export * from "./hapi-paypal-webhooks";
export * from "./therealyou";
export * from "./wozu";
