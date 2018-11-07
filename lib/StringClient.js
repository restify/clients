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
    assert.optionalObject(options.contentMd5, 'options.contentMd5');

    if (options.contentMd5) {
        assert.optionalArrayOfString(options.contentMd5.encodings,
            'options.contentMd5.encodings');
        assert.optionalBool(options.contentMd5.ignore,
            'options.contentMd5.ignore');

        if (Array.isArray(options.contentMd5.encodings)) {
            options.contentMd5.encodings.forEach(function _checkMd5Enc(enc) {
                assert.ok(Buffer.isEncoding(enc),
                    'encoding "' + enc + '" is an invalid encoding');
            });
        }
    }

    options.accept = options.accept || 'text/plain';
    options.name = options.name || 'StringClient';
    options.contentType =
        options.contentType || 'application/x-www-form-urlencoded';

    HttpClient.call(this, options);
    this.contentMd5 = options.contentMd5 || {};
    this.gzip = options.gzip;

    if (!this.contentMd5.encodings) {
        // The undefined value here is used to make node use the default
        // encoding when computing the response content md5 hash.
        this.contentMd5.encodings = [undefined];
    }
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
    // eslint-disable-next-line handle-callback-err
    this.request(options, function _parse(err, req) {
        // no need to handle err here. an err, if applicable, would be emitted
        // as part of the result object event and will be handled by onResult.
        req.once('result', self._onResult(callback));
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

            req.once('result', self._onResult(callback));
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


/**
 * Parse body out of the response object.
 * @private
 * @method parse
 * @param {Error} [err] low level http error if applicable
 * @param {Object} req the request object
 * @param {Object} res the response object
 * @param {Function} callback a callback fn
 * @returns {String} response string
 */
StringClient.prototype.parse = function parse(err, req, res, callback) {
    assert.optionalObject(err, 'err');
    assert.object(req, 'req');
    assert.object(res, 'res');
    assert.func(callback, 'callback');

    var body = '';
    var gz;
    var md5;
    var md5HashObjects;
    var md5Match;
    var decoder;

    function done() {
        res.log.trace('body received:\n%s', body);
        res.body = body;

        if (md5HashObjects) {
            md5Match = md5HashObjects.some(function (hashObj) {
                return hashObj.hash.digest('base64') === md5;
            });

            if (!md5Match) {
                return callback(new Error('BadDigest'), req, res);
            }
        }

        // augment lower level http error with parse server response
        if (err && body) {
            err.body = body;
            err.message = body;
        }

        return callback(err, body);
    }

    md5 = res.headers['content-md5'];

    if (md5 && req.method !== 'HEAD' && res.statusCode !== 206 &&
            !this.contentMd5.ignore) {
        md5HashObjects = [];
        this.contentMd5.encodings.forEach(function (encoding) {
            var hash = crypto.createHash('md5');
            md5HashObjects.push({encoding: encoding, hash: hash});
        });
    }

    if (res.headers['content-encoding'] === 'gzip') {
        decoder = new StringDecoder('utf8');
        gz = zlib.createGunzip();
        gz.on('readable', function onGzReadable() {
            var chunk;

            while ((chunk = gz.read())) {
                body += decoder.write(Buffer.from(chunk));
            }
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

    function updateMd5HashObjects (chunk) {
        md5HashObjects.forEach(function (hashObj) {
            hashObj.hash.update(chunk, hashObj.encoding);
        });
    }

    res.on('readable', function onReadable() {
        var chunk;

        while ((chunk = res.read())) {
            if (md5HashObjects) {
                updateMd5HashObjects(chunk);
            }

            if (gz) {
                gz.write(chunk);
            } else {
                body += chunk;
            }
        }
    });
};


/**
 * This function is called upon a successful result from underlying HttpClient.
 * This should be the single unified "exit" point for all clients inheriting
 * from StringClient (or JSONClient). Parse the response, call the user land
 * callback, then emit an after event.
 *
 * This is all happens in a bound closure scope, so this function is more like
 * a factory that returns the real _onResult function.
 * @private
 * @method _onResult
 * @param {Function} callback user land callback provided to client verb method
 * @returns {Function}
 */
StringClient.prototype._onResult = function _onResult(callback) {

    var self = this;

    // this function is invoked by HttpClient's 'result' event
    return function onResult(err, res, req) {
        // We can't do a simple `if (err)` check here, as we need to
        // differentiate between the following two scenarios:
        // Scenario 1: we have an err, but no res object, e.g., req timeout
        // Scenario 2: we got an http 500 err, along with res object. in this
        // case, we will still want to try to parse the response even though
        // there is an error.

        // Scenario 1:
        // Check for res object instead. If it doesn't exist, we can return
        // right away as there is no response to parse.
        if (!res) {
            callback(err, req, null, null);
            self.emit('after', req, null, err);
            return;
        }

        // Scenario 2:
        // if response is here, try to parse the body out of it. it may seem
        // strange that we are passing the lower level http error here into the
        // parser. the reason for this is because in http 4xx/5xx cases, the
        // error is created first before parsing the response. to make the
        // error more useful, append the server response to the error now.
        // e.g., for a 404, this can be something like "/foo not found".
        // different parsers (JSON) may want to augment the error differently.
        // since the parser takes an error as input, always prefer the err
        // object returned by the parser as the final source of truth.
        self.parse(err, req, res, function parseComplete(parserErr, body) {
            callback(parserErr, req, res, body);
            self.emit('after', req, res, parserErr);
        });
    };
};
