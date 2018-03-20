// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var util = require('util');

var assert = require('assert-plus');
var restifyErrors = require('restify-errors');
var safeStringify = require('fast-safe-stringify');

var makeErrFromCode = restifyErrors.makeErrFromCode;
var RestError = restifyErrors.RestError;
var StringClient = require('./StringClient');


// --- API

function JsonClient(options) {
    assert.object(options, 'options');
    assert.optionalBool(options.safeStringify, 'options.safeStringify');

    options.accept = options.accept || 'application/json';
    options.name = options.name || 'JsonClient';
    options.contentType = options.contentType || 'application/json';

    StringClient.call(this, options);

    this._super = StringClient.prototype;

    this._safeStringify = options.safeStringify || false;
}
util.inherits(JsonClient, StringClient);

module.exports = JsonClient;


JsonClient.prototype.write = function write(options, body, callback) {
    var self = this;

    var bodyOrDefault = (body !== null ? body : {});
    assert.ok(
        typeof bodyOrDefault === 'string' || typeof bodyOrDefault === 'object',
        'body'
    );

    var resBody;
    // safely stringify body if client was configured thusly
    if (self._safeStringify) {
        resBody = safeStringify(bodyOrDefault);
    } else {
        resBody = JSON.stringify(bodyOrDefault);
    }
    return (this._super.write.call(this, options, resBody, callback));
};


JsonClient.prototype.parse = function parse(req, callback) {
    var log = this.log;

    function parseResponse(err, req2, res, data) {
        var obj;
        var resErr = err;
        var parseErr;

        try {
            if (data) {
                obj = JSON.parse(data);
            }
        } catch (e) {

            // bad data being returned that cannot be parsed should be surfaced
            // to the caller. http errors should take precedence, but it's
            // possible to receive malformed data regardless of a status code.
            parseErr = e;
            log.trace(parseErr, 'Invalid JSON in response');
        }
        obj = obj || (res && res.body) || {};

        // http errors take precedence over JSON.parse errors
        if (res && res.statusCode >= 400) {
            // Upcast error to a RestError (if we can)
            // Be nice and handle errors like
            // { error: { code: '', message: '' } }
            // in addition to { code: '', message: '' }.
            if (obj.code || (obj.error && obj.error.code)) {
                var _c = obj.code ||
                    (obj.error ? obj.error.code : '') ||
                    '';
                var _m = obj.message ||
                    (obj.error ? obj.error.message : '') ||
                    '';

                resErr = new RestError({
                    restCode: _c,
                    statusCode: res.statusCode
                }, '%s', _m);
                resErr.name = resErr.restCode;

                if (!/Error$/.test(resErr.name)) {
                    resErr.name += 'Error';
                }
            } else if (!resErr) {
                resErr = makeErrFromCode(res.statusCode,
                    obj.message || '', data);
            }
        }

        // if no http error but we had a json parse error, return the json
        // parse err as the top level error
        if (!resErr && parseErr) {
            resErr = new RestError(parseErr, 'Invalid JSON in response');
        }

        if (resErr) {
            resErr.body = obj;
        }

        callback((resErr || null), req2, res, obj);
    }

    return (this._super.parse.call(this, req, parseResponse));
};
