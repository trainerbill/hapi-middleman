import { PluginRegistrationObject } from "hapi";
import { HapiIntacct, IHapiIntacctOptions } from "hapi-intacct";
export declare const hapiIntacct: HapiIntacct;
export declare const hapiIntacctOptions: IHapiIntacctOptions;
export declare const hapiIntacctPlugin: PluginRegistrationObject<any>;
export declare const hapiIntacctGlueRegistration: {
    plugin: PluginRegistrationObject<any>;
};
