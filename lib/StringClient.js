// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var crypto = require('crypto');
var zlib = require('zlib');
var StringDecoder = require('string_decoder').StringDecoder;

var assert = require('assert-plus');
var qs = require('querystring');
var util = require('util');

var HttpClient = require('./HttpClient');


// --- API

function StringClient(options) {
    assert.object(options, 'options');
    assert.optionalObject(options.gzip, 'options.gzip');

    options.accept = options.accept || 'text/plain';
    options.name = options.name || 'StringClient';
    options.contentType =
        options.contentType || 'application/x-www-form-urlencoded';

    HttpClient.call(this, options);
    this.gzip = options.gzip;
}
util.inherits(StringClient, HttpClient);

module.exports = StringClient;

/**
 * normalize variadic signatures for all the method actions.
 * normalizeArgs({...}, cb);
 * normalizeArgs({...}, body, cb);
 * @private
 * @function normalizeArgs
 * @param   {Object}   arg1 options object
 * @param   {Object}   arg2 output body
 * @param   {Function} arg3 callback function
 * @returns {Object}        normalized args
 */
function normalizeArgs(arg1, arg2, arg3) {
    // assume most complex arg signature as default.
    var body = arg2;
    var callback = arg3;

    if (typeof arg2 === 'function') {
        callback = arg2;
        body = null;
    }

    return {
        body: body,
        callback: callback
    };
}

StringClient.prototype.post = function post(options, body, callback) {
    var opts = this._options('POST', options);

    var args = normalizeArgs.apply(null, arguments);
    return (this.write(opts, args.body, args.callback));
};


StringClient.prototype.put = function put(options, body, callback) {
    var opts = this._options('PUT', options);

    var args = normalizeArgs.apply(null, arguments);
    return (this.write(opts, args.body, args.callback));
};


StringClient.prototype.patch = function patch(options, body, callback) {
    var opts = this._options('PATCH', options);

    var args = normalizeArgs.apply(null, arguments);
    return (this.write(opts, args.body, args.callback));
};


var forceGetOptions = function (options) {
    options.method = 'GET';
    delete options.headers['content-length'];
};


StringClient.prototype.read = function read(options, callback) {
    var self = this;
    this.request(options, function _parse(err, req) {
        if (err) {
            return (callback(err, req));
        }

        req.once('result', self.parse(req, callback));
        req.once('redirect', function (res) {
            res.resume();
            options.path = res.headers.location;

            if (res.forceGet) {
                forceGetOptions(options);
            }
            self.read(options, callback);
        });
        return (req.end());
    });
    return (this);
};


StringClient.prototype.write = function write(options, body, callback) {

    var self = this;
    var normalizedBody = body;
    var proto = StringClient.prototype;

    if (normalizedBody !== null && typeof (normalizedBody) !== 'string') {
        normalizedBody = qs.stringify(normalizedBody);
    }


    function _write(data) {
        if (data) {
            var hash = crypto.createHash('md5');
            hash.update(data, 'utf8');
            options.headers['content-md5'] = hash.digest('base64');
        }

        self.request(options, function (err, req) {
            if (err) {
                callback(err, req);
                return;
            }

            req.once('result', self.parse(req, callback));
            req.once('redirect', function (res) {
                res.resume();
                options.path = res.headers.location;

                if (res.forceGet) {
                    forceGetOptions(options);
                    proto.read.call(self, options, callback);
                } else {
                    proto.write.call(self, options, body, callback);
                }
            });
            req.end(data);
        });
    }

    options.headers = options.headers || {};

    if (this.gzip) {
        options.headers['accept-encoding'] = 'gzip';
    }

    if (normalizedBody) {
        if (this.gzip) {
            options.headers['content-encoding'] = 'gzip';
            zlib.gzip(normalizedBody, function (err, data) {
                if (err) {
                    callback(err, null);
                    return;
                }

                options.headers['content-length'] = data.length;
                _write(data);
            });
        } else {
            options.headers['content-length'] =
                Buffer.byteLength(normalizedBody);
            _write(normalizedBody);
        }
    } else {
        _write();
    }

    return (this);
};


StringClient.prototype.parse = function parse(req, callback) {
    function parseResponse(err, res) {
        var body = '';
        var gz;
        var hash;
        var md5;
        var decoder;
        var resErr = err;

        function done() {
            res.log.trace('body received:\n%s', body);
            res.body = body;

            if (hash && md5 !== hash.digest('base64')) {
                resErr = new Error('BadDigest');
                callback(resErr, req, res);
                return;
            }

            if (resErr) {
                resErr.body = body;
                resErr.message = body;
            }

            callback(resErr, req, res, body);
        }

        if (res) {
            md5 = res.headers['content-md5'];

            if (md5 && req.method !== 'HEAD' && res.statusCode !== 206) {
                hash = crypto.createHash('md5');
            }

            if (res.headers['content-encoding'] === 'gzip') {
                decoder = new StringDecoder('utf8');
                gz = zlib.createGunzip();
                gz.on('data', function (chunk) {
                    body += decoder.write(Buffer.from(chunk));
                });
                gz.once('end', function () {
                    body += decoder.end();
                    done();
                });
                res.once('end', gz.end.bind(gz));
            } else {
                res.setEncoding('utf8');
                res.once('end', done);
            }

            res.on('data', function onData(chunk) {
                if (hash) {
                    hash.update(chunk);
                }

                if (gz) {
                    gz.write(chunk);
                } else {
                    body += chunk;
                }
            });

        } else {
            callback(resErr, req, null, null);
        }
    }

    return (parseResponse);
};
