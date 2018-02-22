'use strict';

// core modules
var url = require('url');

// external modules
var _ = require('lodash');
var assert = require('assert-plus');
var restifyErrors = require('restify-errors');


var ERR_CTOR = {
    ConnectTimeoutError: restifyErrors.makeConstructor('ConnectTimeoutError'),
    DNSTimeoutError: restifyErrors.makeConstructor('DNSTimeoutError'),
    RequestTimeoutError: restifyErrors.makeConstructor('RequestTimeoutError'),
    TooManyRedirectsError:
        restifyErrors.makeConstructor('TooManyRedirectsError')
};


/*------------------------------------------------------------------------------
   public methods
------------------------------------------------------------------------------*/


/**
 * build a connect timeout error for a request that failed to resolve DNS or
 * establish a connection.
 * @public
 * @function createConnectTimeoutErr
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {verror.VError} ConnectionTimeoutError
 */
function createConnectTimeoutErr(opts, req) {
    assert.object(opts, 'opts');
    assert.object(req, 'req');

    var errInfo = createErrInfo(opts, req);
    var errMsg;
    var errName;

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

    return new ERR_CTOR[errName]({
        info: _.assign(errInfo, {
            connectTimeout: opts.connectTimeout
        })
    }, '%s', errMsg);
}


/**
 * build an http error for a request that has a corresponding http status code
 * on the response.
 * @private
 * @function createHttpErr
 * @param {Object} statusCode response status code
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {verror.VError}
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
 * build a request timeout error for a request that failed to complete within
 * the specified timeout period.
 * @private
 * @function createRequestTimeoutErr
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {verror.VError} RequestTimeoutError
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

    return new ERR_CTOR.RequestTimeoutError({
        info: _.assign(errInfo, {
            requestTimeout: opts.requestTimeout
        })
    }, '%s', errMsg);
}


/**
 * build a redirect error for a request that encountered too many redirects
 * when attempting to follow redirects.
 * @private
 * @function createRequestTimeoutErr
 * @param {Object} opts options object for a request
 * @param {Object} req the request object
 * @returns {verror.VError} RequestTimeoutError
 */
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

    return new ERR_CTOR.TooManyRedirectsError({
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
 * @param {String} opts.path the requested path as set by the user
 * @param {String} opts.protocol http/https
 * @param {String} opts.host hostname of the request
 * @param {String} opts.port port number of the request
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
