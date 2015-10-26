'use strict';

module.exports = audit;

/**
 * Audits the req/res for the client. The audit will use bunyan's
 * formatters. See bunyan-format for the user-friendly output.
 *
 * @param  {Object} err   The http error object.
 * @param  {Object} req   The http request object.
 * @param  {Object} res   The http response object.
 *
 * @returns {undefined} Does not return anything.
 */
function audit(err, req, res) {
    req.headers = req._headers;
    req.url = req.path;
    var log = req.log;

    var obj = {
        remoteAddress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort,
        req: req,
        res: res,
        err: err,
        secure: req.secure
    };

    var level = _defaultLevelFn(res.statusCode);
    var logFn = log[level] ? log[level] : log.info;

    // Log the request/response properly with the function
    // associated with the response status code
    logFn.call(log, obj);
}

/**
 * @param {String} status from the web server.
 * @returns {String} The level of the logger depending on the HTTP.
 */
function _defaultLevelFn(status) {
    if (status >= 500) { // server internal error or error
        return 'error';

    } else if (status >= 400) { // client error
        return 'warn';
    }
    return 'info';
}
