import { goodGlueRegistration } from "./good";
import { hapiIntacctGlueRegistration } from "./hapi-intacct";
import { hapiPayPalGlueRegistration } from "./hapi-paypal";
import { hapiPayPalIntacctGlueRegistration } from "./invoicing";
import { tryGlueRegistration } from "./therealyou";
import { wozuGlueRegistration } from "./wozu";

export const GlueRegistrations: any = [
    goodGlueRegistration,
    hapiIntacctGlueRegistration,
    hapiPayPalGlueRegistration,
    hapiPayPalIntacctGlueRegistration,
    tryGlueRegistration,
    wozuGlueRegistration,
];

export * from "./invoicing";
export * from "./good";
export * from "./hapi-intacct";
export * from "./hapi-paypal";
export * from "./therealyou";
export * from "./wozu";
