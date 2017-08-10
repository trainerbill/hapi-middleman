"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const good_1 = require("./good");
const hapi_intacct_1 = require("./hapi-intacct");
const hapi_paypal_1 = require("./hapi-paypal");
const paypal_intacct_1 = require("./paypal-intacct");
const therealyou_1 = require("./therealyou");
const wozu_1 = require("./wozu");
exports.GlueRegistrations = [
    good_1.goodGlueRegistration,
    hapi_intacct_1.hapiIntacctGlueRegistration,
    hapi_paypal_1.hapiPayPalGlueRegistration,
    paypal_intacct_1.hapiPayPalIntacctGlueRegistration,
    therealyou_1.tryGlueRegistration,
    wozu_1.wozuGlueRegistration,
];
__export(require("./paypal-intacct"));
__export(require("./good"));
__export(require("./hapi-intacct"));
__export(require("./hapi-paypal"));
__export(require("./therealyou"));
__export(require("./wozu"));
//# sourceMappingURL=index.js.map