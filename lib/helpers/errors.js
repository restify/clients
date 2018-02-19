'use strict';

// core modules
var url = require('url');

// external modules
var _ = require('lodash');
var assert = require('assert-plus');
var restifyErrors = require('restify-errors');
var verror = require('verror');

// require('http').STATUS_CODES has a http 429 error that in < node 4 was known
// as TooManyRedirects. This has been rectified as TooManyRequests.
// in the case of restify-clients, we will retain this error type given that
// users can specify maximum number of redirects to follow.
if (!restifyErrors.TooManyRedirectsError) {
    restifyErrors.makeConstructor('TooManyRedirectsError');
}


/*------------------------------------------------------------------------------
   public methods
------------------------------------------------------------------------------*/

/**
 * build a connect timeout error based for a request.
 * @public
 * @function createConnectTimeoutErr
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {Object} ConnectionTimeoutError
 */
function createConnectTimeoutErr(opts, req) {
    assert.object(opts, 'opts');
    assert.object(req, 'req');

    var errName;
    var errMsg;
    var errInfo = createErrInfo(opts, req);

    // if remoteAddress has not yet been resolved, DNS resolution could have
    // failed. verify this by checking if the input was an IP to begin with,
    // if it was, lookup was never called anyway so its a real connect timeout
    // error.
    if (!req.remoteAddress) {
        errName = 'DNSTimeoutError';
        errMsg = [
            'failed to resolve hostname',
            '`' + opts.hostname + '`',
            'within',
            opts.connectTimeout + 'ms'
        ].join(' ');
    } else {
        errName = 'ConnectTimeoutError';
        errMsg = [
            opts.method,
            'request to',
            errInfo.fullUrl,
            'failed to obtain connected socket within',
            opts.connectTimeout + 'ms'
        ].join(' ');
    }

    return new verror.VError({
        name: errName,
        info: _.assign(errInfo, {
            connectTimeout: opts.connectTimeout
        })
    }, '%s', errMsg);
}


/**
 * build an http error for an errored request
 * @private
 * @function createHttpErr
 * @param {Object} statusCode response status code
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {Error}
 */
function createHttpErr(statusCode, opts, req) {
    assert.number(statusCode, 'statusCode');
    assert.object(opts, 'opts');
    assert.object(req, 'req');

    var errInfo = createErrInfo(opts, req);

    return restifyErrors.makeErrFromCode(statusCode, {
        info: errInfo
    });
}


/**
 * build a request timeout error based for a request.
 * @private
 * @function createRequestTimeoutErr
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {Object} RequestTimeoutError
 */
function createRequestTimeoutErr(opts, req) {
    assert.object(opts, 'opts');
    assert.object(req, 'req');

    var errInfo = createErrInfo(opts, req);
    var errMsg = [
        opts.method,
        'request to',
        errInfo.fullUrl,
        'failed to complete within',
        opts.requestTimeout + 'ms'
    ].join(' ');

    return new verror.VError({
        name: 'RequestTimeoutError',
        info: _.assign(errInfo, {
            requestTimeout: opts.requestTimeout
        })
    }, '%s', errMsg);
}



function createTooManyRedirectsErr(opts, req) {
    assert.object(opts, 'opts');
    assert.object(req, 'req');

    var errInfo = createErrInfo(opts, req);
    var errMsg = [
        'aborted',
        opts.method,
        'request to',
        errInfo.fullUrl,
        'after',
        opts.redirects,
        'redirects'
    ].join(' ');

    return new verror.VError({
        name: 'TooManyRedirectsError',
        info: _.assign(errInfo, {
            // add additional context relevant for redirects
            numRedirects: opts.redirects,
            maxRedirects: opts.maxRedirects
        })
    }, '%s', errMsg);
}


/*------------------------------------------------------------------------------
   private methods
------------------------------------------------------------------------------*/


/**
 * given options object for a request, build the fully qualified url. this
 * method needs to exist primarily a result of the inconsistencies in the
 * options between node core's API:
 *      http.request()
 *      url.parse()
 * this is not strictly a node issue perse, but rather that this module uses
 * url.parse() to create the initial "state" of options for http.request(),
 * then modifies them in a way such that they're no longer compatible with
 * url modules methods. this is ripe for revisiting at some point later in
 * time. For reference in the meantime:
 * https://nodejs.org/api/url.html#url_url_strings_and_url_objects
 *
 * the value returned by this function is used only for error
 * logging/visibility.
 * @private
 * @function fullRequestUrl
 * @param {Object} opts request options
 * @returns {String}
 */
function fullRequestUrl(opts) {
    assert.object(opts, 'opts');

    // the incoming opts.path value is the value on the request:
    // i.e., client.get(`opts.path`, function() { ... });
    // This path value includes any query params as well. the url module calls
    // this value `pathname`. use a new object so as not to reuse any of the
    // now mutated values on opts. combine with a select few existing options
    // to get the fullurl object.
    var urlObj = _.assign({}, url.parse(opts.path), {
        protocol: opts.protocol,
        host: opts.host,
        port: opts.port
    });

    return url.format(urlObj);
}


/**
 * create an info object for use with verror given the opts object used to
 * issue the original request, along with the request object itself.
 * @private
 * @function createErrInfo
 * @param {Object} opts an options object
 * @param {Object} req a request object
 * @returns {Object}
 */
function createErrInfo(opts, req) {
    assert.object(opts, 'opts');
    assert.object(req, 'req');

    return {
        // port and address can both be unpopulated - fall back on null so
        // that they can both be null (instead of req.remoteAddress
        // defaulting to undefined)
        address: req.remoteAddress || null,
        fullUrl: fullRequestUrl(opts),
        method: opts.method,
        port: opts.port
    };
}



module.exports = {
    createConnectTimeoutErr: createConnectTimeoutErr,
    createHttpErr: createHttpErr,
    createRequestTimeoutErr: createRequestTimeoutErr,
    createTooManyRedirectsErr: createTooManyRedirectsErr
};
