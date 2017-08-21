import * as Good from "good";
import { PluginRegistrationObject } from "hapi";
import * as joi from "joi";

export const goodReporters: any = {
    console: [{
        args: [{
            error: "*",
            log: "*",
            request: "*",
            response: "*",
        }],
        module: "good-squeeze",
        name: "Squeeze",
    }, {
        module: "good-console",
    }, "stdout"],
};

if (process.env.GOOD_HTTP_URL) {
    const httpReporterSchema = joi.object().keys({
        headers: joi.object().optional(),
        url: joi.string().uri({ scheme: ["https"] }).required(),
    });

    const validate = joi.validate({
        headers: JSON.parse(process.env.GOOD_HTTP_HEADERS),
        url: process.env.GOOD_HTTP_URL,
    }, httpReporterSchema);

    if (validate.error) {
        throw new Error(JSON.stringify(validate.error.details));
    }

    goodReporters.http = [{
        args: [{ error: "*" }],
        module: "good-squeeze",
        name: "Squeeze",
    }, {
        args: [
            validate.value.url,
            {
                wreck: {
                    headers: validate.value.headers,
                },
            },
        ],
        module: "good-http",
    }];
}

export const goodOptions = {
    reporters: goodReporters,
};

export const goodPlugin: PluginRegistrationObject<any> = {
    options: goodOptions,
    register: Good.register,
};

export const goodGlueRegistration = {
    plugin: goodPlugin,
};
