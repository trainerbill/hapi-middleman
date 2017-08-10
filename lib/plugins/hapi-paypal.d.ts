import { PluginRegistrationObject } from "hapi";
import { HapiPayPal, IHapiPayPalOptions } from "hapi-paypal";
export declare const hapiPayPal: HapiPayPal;
export declare const hapiPayPalOptions: IHapiPayPalOptions;
export declare const hapiPayPalPlugin: PluginRegistrationObject<any>;
export declare const hapiPayPalGlueRegistration: {
    plugin: PluginRegistrationObject<any>;
};
