# Logging
This application uses the hapi good module for logging.  Please visit their [github repository](https://github.com/hapijs/good/) for all options on configuring logging.  You can configure the logging directly in the [Good Plugin Configuration file](https://github.com/trainerbill/hapi-middleman/blob/master/src/plugins/good.ts) or set any of the environment variables listed below.

# Default
By default this application only logs to the console.

# Environment Variables
Environment variables can be set anyway that you would normally set an environment variable in the node ecosystem.  The [dotenv module](https://github.com/motdotla/dotenv) is installed in the application so you can simply add a file called .env to the root of the app.

| Name        | Description           | Default  |
| ------------- |:-------------:| -----:|
| HAPI_DEBUG      | Enables [Hapi Debug Mode](https://hapijs.com/api#server-events) | false |
| GOOD_HTTP_URL     | Enables Good HTTP logging which will send a post request to whatever URL it is provided.  This must be an HTTPS URL.  Use this to recevie realtime errors from this application      |   false |
| GOOD_HTTP_HEADERS | [See Good documentation](https://github.com/hapijs/good/blob/master/examples/log-to-http.md).  Must be a string that can be parsed using JSON.parse and results in an object with key/value pairs. Only used when using the GOOD_HTTP_URL variable.  Sets the headers incase you are using a third party logging solution that requires an API KEY or need to set special headers      | false |