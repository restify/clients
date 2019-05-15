// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

// core modules
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var net = require('net');
var os = require('os');
var qs = require('qs');
var url = require('url');
var util = require('util');

// external modules
var assert = require('assert-plus');
var backoff = require('backoff');
var mime = require('mime');
var once = require('once');
var semver = require('semver');
var tunnelAgent = require('tunnel-agent');

// local globals
var auditor = require('./helpers/auditor');
var bunyanHelper = require('./helpers/bunyan');
var dtrace = require('./helpers/dtrace');
var errors = require('./helpers/errors');
var getTimingsFromEventTimes = require('./helpers/timings').getTimings;

// Use native KeepAlive in Node as of 0.11.6
var nodeVersion = process.version;
var nativeKeepAlive = semver.satisfies(nodeVersion, '>=0.11.6');
var KeepAliveAgent;
var KeepAliveAgentSecure;
var httpMaxSockets = http.globalAgent.maxSockets;
var httpsMaxSockets = https.globalAgent.maxSockets;

if (!nativeKeepAlive) {
    KeepAliveAgent = require('keep-alive-agent');
    KeepAliveAgentSecure = KeepAliveAgent.Secure;
} else {
    KeepAliveAgent = http.Agent;
    KeepAliveAgentSecure = https.Agent;

    // maxSockets defaults to Infinity, but that doesn't
    // lend itself well to KeepAlive, since sockets will
    // never be reused.
    httpMaxSockets = Math.min(httpMaxSockets, 1024);
    httpsMaxSockets = Math.min(httpsMaxSockets, 1024);
}


// --- Globals

var VERSION = require('../package.json').version;
var REDIRECT_CODES = [301, 302, 303, 307];

// --- Helpers

function cloneRetryOptions(options, defaults) {
    if (options === false) {
        return (false);
    }

    assert.optionalObject(options, 'options.retry');
    var r = options || {};
    assert.optionalNumber(r.minTimeout, 'options.retry.minTimeout');
    assert.optionalNumber(r.maxTimeout, 'options.retry.maxTimeout');
    assert.optionalNumber(r.retries, 'options.retry.retries');
    assert.optionalObject(defaults, 'defaults');
    var normalizedDefaults = defaults || {};

    return ({
        minTimeout: r.minTimeout || normalizedDefaults.minTimeout || 1000,
        maxTimeout: r.maxTimeout || normalizedDefaults.maxTimeout || Infinity,
        retries: r.retries || normalizedDefaults.retries || 4
    });
}


function defaultUserAgent() {
    var UA = 'restify/' + VERSION +
        ' (' + os.arch() + '-' + os.platform() + '; ' +
        'v8/' + process.versions.v8 + '; ' +
        'OpenSSL/' + process.versions.openssl + ') ' +
        'node/' + process.versions.node;

    return (UA);
}


/**
 * A function that handles the issuing of the raw request through the
 * underlying http core modules. This function is used as the target of
 * retry/backoff mechanism for retrying on connection timeouts.
 *
 * The callback provided to this function is invoked with the following
 * signature:
 *      function(err, req) { ... }
 * 1) `err` can be any errors triggered before establishing a connection
 *    (ConnectionTimeout, DNSTimeout, etc)
 * 2) If no err, then the connection has been established, and the user must
 *    listen to req's result event for further next steps.
 *
 * Once the server begins to send a response following a successful connection
 * establishment, the HttpClient emits a `result` event with the following
 * signature:
 *      function(err, res, req) { ... }   // yes, res is intentionally first
 *
 * Some notes:
 *      * `err` can be a RequestTimeout or an http 4xx/5xx.
 *      * res can be null in the case of RequestTimeout
 *
 * In the case of HttpClient, the callback provided to the function here is
 * the user provided callback via the public API:
 *      httpclient.get('/foo', cb);     // cb here is the rawRequest's cb
 *
 * This is intentional as the HttpClient is fairly low level. This means the
 * user is responsible for consuming the request object's `data` and `result`
 * events.
 *
 * In the case of the String/JSONClient, the cb is a function internal to those
 * client implementations. These two clients handle dealing with the req
 * streams, and do not invoke the user provided callback until after the
 * `result` event is fired.
 *
 * In short, the callback should only ever be called once,
 * with the two known scenarios:
 *
 * 1) A ConnectionTimeout/DNSTimeoutError occurs, and connection is never
 *    established, and the request object is never created
 * 2) The connection is established, and the request object is created and
 *    returned
 *
 * However, a RequestTimeout can occur after the connection is established -
 * which means we should not invoke the callback again (since it's already been
 * invoked), and instead pass this error via the `result` event.
 *
 * This somewhat asymmetrical way of dealing with request errors (sometimes via
 * the callback, sometimes via the result event) means that `once` is used to
 * paper over multiple invocations of the callback function provided to this
 * function. This is not great, and maybe worth revisiting. The `result` event,
 * like the callback, should only ever be emitted once.
 *
 * @private
 * @method rawRequest
 * @param {Object} opts an options object
 * @param {Function} cb user provided callback fn
 * @returns {undefined}
 */
function rawRequest(opts, cb) {
    assert.object(opts, 'options');
    assert.object(opts.log, 'options.log');
    assert.object(opts.client, 'options.client');
    assert.func(cb, 'callback');

    /* eslint-disable no-param-reassign */
    cb = once(cb);
    /* eslint-enable no-param-reassign */

    var id = dtrace.nextId();
    var log = opts.log;
    var proto = opts.protocol === 'https:' ? https : http;
    var eventTimes = {
        // use process.hrtime() as it's not a subject of clock drift
        startAt: process.hrtime(),
        dnsLookupAt: null,
        tcpConnectionAt: null,
        tlsHandshakeAt: null,
        firstByteAt: null,
        endAt: null
    };
    var connectionTimer;
    var requestTimer;
    var req;

    // increment the number of currently inflight requests
    opts.client._incrementInflightRequests();

    /**
     * this function is called after the request lifecycle has been "completed"
     * and the after event is ready to be fired. this requires the consumer to
     * have consumed the response stream.
     *
     * @private emitAfter
     * @event HttpClient#after
     * @param {Error} [_err] an Error
     * @param {Object} _req request object
     * @param {Object} [_res] response object
     * @return {undefined}
     */
    var emitAfter = once.strict(function _emitAfter(_req, _res, _err) {
        assert.optionalObject(_err, '_err');
        assert.object(_req, '_req');
        assert.optionalObject(_res, '_res');

        // only emit after event if the HttpClient is being consumed directly.
        // StringClient/JsonClient have their own means of emitting the after
        // event after parsing the response.
        var ctorName = Object.getPrototypeOf(opts.client).constructor.name;

        if (ctorName === 'HttpClient') {
            opts.client.emit('after', _req, _res, _err);
        }
    });

    /**
     * this function is called after a req has been issued and a response is
     * available for consumption. this is the single point of "exit" when the
     * HttpClient is done with the request/response. this exit point is either
     * consumed directly by user land (if using HttpClient directly) or
     * consumed by the inherited clients StringClient/JsonClient.  it's
     * possible here for response to be null in the case of a timeout or
     * otherwise.
     * @private emitResult
     * @event Request#result
     * @param {Error} [_err] an Error
     * @param {Object} _req request object
     * @param {Object} [_res] response object
     * @return {undefined}
     */
    var emitResult = once.strict(function _emitResult(_err, _req, _res) {
        assert.optionalObject(_err, '_err');
        assert.object(_req, '_req');
        assert.optionalObject(_res, '_res');

        var err = _err;

        // determine if we should redirect
        if (!err &&
            opts.followRedirects &&
            REDIRECT_CODES.indexOf(_res.statusCode) > -1) {
            // determine if we have exceeded max redirects. if yes, create an
            // err.
            if (opts.maxRedirects && opts.redirects >= opts.maxRedirects) {
                err = errors.createTooManyRedirectsErr(opts, req);
            }
            // otherwise, redirect happily
            else {
                opts.redirects = (opts.redirects || 0) + 1;
                _res.forceGet = _res.statusCode !== 307 &&
                    _req.method !== 'HEAD';
                _req.emit('redirect', _res);
                return;
            }
        }

        _req.emit('result', err, _res, _req);

        // Use the default auditor with the switch "opts.audit: true | false"
        if (opts.audit.defaultEnabled) {
            auditor(err, _req, _res);
        } else if (opts.audit.func && typeof opts.audit.func === 'function') {
            // Use the function provided by the user through "opts.auditor"
            opts.audit.func(err, _req, _res);
        }
    });

    if (opts.cert && opts.key) {
        opts.agent = false;
    }

    if (opts.connectTimeout) {
        connectionTimer = setTimeout(function connectTimeout() {
            connectionTimer = null;

            // build connect timeout error using current request options, do
            // this first before we abort the request so we can pick up socket
            // information like the ip.
            var err = errors.createConnectTimeoutErr(opts, req);
            req._forcedAbortErr = err;
            req.abort();
        }, opts.connectTimeout);
    }

    dtrace._rstfy_probes['client-request'].fire(function () {
        return ([
            opts.method,
            opts.path,
            opts.headers,
            id
        ]);
    });

    var requestTime = new Date().getTime();
    // We have to decrement the inflight request counter on both req.on('error')
    // and res.on('end').  But in certain cases, both of these events could be
    // emitted for the same request.  So we add this semaphore to ensure that
    // the inflight request counter only ever decrements once for a given
    // request.
    var hasDecrementedInflightCounter = false;
    req = proto.request(opts, function onResponse(res) {
        var latency = Date.now() - requestTime;
        res.headers['x-request-received'] = requestTime;
        res.headers['x-request-processing-time'] = latency;
        clearTimeout(connectionTimer);
        clearTimeout(requestTimer);

        dtrace._rstfy_probes['client-response'].fire(function () {
            return ([ id, res.statusCode, res.headers ]);
        });
        log.trace({client_res: res}, 'Response received');

        res.log = log;

        var err;

        if (res.statusCode >= 400) {
            err = errors.createHttpErr(res.statusCode, opts, req);
        }

        req.removeAllListeners('socket');

        // The 'end' event of the response stream is emitted only when its fully
        // consumed. We cannot rely on this event to fire.

        res.once('end', function onEnd () {
            eventTimes.endAt = process.hrtime();
            var timings = getTimingsFromEventTimes(eventTimes);
            req.getTimings = function getTimings () {
                return timings;
            };
            opts.client.emit('timings', timings);

            var metrics = {
                statusCode: res.statusCode,
                method: req.method,
                path: opts.path,
                url: opts.href,
                success: (err) ? false : true
            };
            metrics.timings = timings;
            req.getMetrics = function getMetrics() {
                return metrics;
            };

            if (!hasDecrementedInflightCounter) {
                hasDecrementedInflightCounter = true;
                opts.client._decrementInflightRequests();
            }

            opts.client.emit('metrics', metrics);
            emitAfter(req, res, err);
        });

        emitResult((err || null), req, res);

        // The 'readable' event listener has to be added after we emit the
        // 'result' event to keep the response stream readable in flowing mode.
        // The response stream would be stuck in non-flowing mode if we added
        // the `readable` listener first. For details, see nodejs/node@cf5f986.
        // https://github.com/nodejs/node/
        // commit/cf5f9867ff3e700dfd72519e7bdeb701e254317f

        res.once('readable', function onReadable () {
            eventTimes.firstByteAt = process.hrtime();
        });
    });
    req.log = log;

    var startRequestTimeout = function startRequestTimeout() {
        // the request object must already exist before we can set a timeout
        // on it.
        assert.object(req, 'req');

        if (opts.requestTimeout) {
            requestTimer = setTimeout(function requestTimeout() {
                requestTimer = null;

                var err = errors.createRequestTimeoutErr(opts, req);
                req._forcedAbortErr = err;
                req.abort();
            }, opts.requestTimeout);
        }
    };

    req.on('error', function onError(err) {
        var realErr = req._forcedAbortErr || err;
        dtrace._rstfy_probes['client-error'].fire(function () {
            return ([id, (realErr || {}).toString()]);
        });
        log.trace({ err: realErr }, 'Request failed');
        clearTimeout(connectionTimer);
        clearTimeout(requestTimer);

        if (!hasDecrementedInflightCounter) {
            hasDecrementedInflightCounter = true;
            opts.client._decrementInflightRequests();
        }

        // in an error scenario, it's possible the connection died and the
        // response's `end` event never fired. if that's the case, we were
        // never able to set timings/metrics methods on the req object.
        if (!req.getTimings || !req.getMetrics) {
            eventTimes.endAt = process.hrtime();
            var timings = getTimingsFromEventTimes(eventTimes);
            req.getTimings = function getTimings () {
                return timings;
            };
            opts.client.emit('timings', timings);

            var metrics = {
                statusCode: null,
                method: req.method,
                path: opts.path,
                url: opts.href,
                success: false,
                timings: timings
            };
            req.getMetrics = function getMetrics() {
                return metrics;
            };
            opts.client.emit('metrics', metrics);
        }

        // the user provided callback is invoked as soon as a connection is
        // established. however, the request can be aborted or can fail after
        // this point. any errors that occur after connection establishment are
        // not propagated via the callback, but instead propagated via the
        // 'result' event. check the cbCalled flag to ensure we don't double
        // call the callback. while this could be handled by once, this is more
        // explicit and easier to reason about.
        cb(realErr, req);

        process.nextTick(function () {
            emitResult(realErr, req, null);
            emitAfter(req, null, realErr);
        });
    });

    req.once('upgrade', function onUpgrade(res, socket, _head) {
        clearTimeout(connectionTimer);
        clearTimeout(requestTimer);
        dtrace._rstfy_probes['client-response'].fire(function () {
            return ([ id, res.statusCode, res.headers ]);
        });
        log.trace({client_res: res}, 'upgrade response received');

        res.log = log;

        var err;

        if (res.statusCode >= 400) {
            err = errors.createHttpErr(res.statusCode, opts, req);
        }

        req.removeAllListeners('error');
        req.removeAllListeners('socket');
        req.emit('upgradeResult', (err || null), res, socket, _head);
    });

    if (opts.signRequest) {
        opts.signRequest(req);
    }

    req.once('socket', function onSocket(socket) {
        var _socket = socket;

        function onConnect() {
            startRequestTimeout();
            clearTimeout(connectionTimer);

            eventTimes.tcpConnectionAt = process.hrtime();

            if (opts._keep_alive) {
                _socket.setKeepAlive(true);
                socket.setKeepAlive(true);
            }

            // eagerly call the user provided callback here with the request
            // obj after we've established a connection. note that it's still
            // possible for the request to timeout at this point, but a
            // RequestTimeoutError would be triggered through the 'result' event
            // and not the callback.
            cb(null, req);
        }

        if (opts.protocol === 'https:' && socket.socket) {
            _socket = socket.socket;
        }

        // if the provided url to connect to is already an IP, preemptively set
        // the remote address.
        if (net.isIP(opts.hostname)) {
            req.remoteAddress = opts.hostname;
        }

        // before we attach any events to the socket, look to see if the
        // socket's `connect` event has already fired. if the _connecting flag
        // is false, the connection was established before we were able to
        // attach a listener to the event, so return the request. it appears
        // that in this scenario, timers for dnsLookup and tlsHandshake would
        // be missing.
        if (_socket.writable && !_socket._connecting) {
            onConnect();
            return;
        }

        // eslint-disable-next-line handle-callback-err
        _socket.once('lookup', function onLookup(err, addr, family, host) {
            eventTimes.dnsLookupAt = process.hrtime();
            // if we had do DNS lookup to resolve hostname, update remote
            // address now.
            req.remoteAddress = addr;
        });

        _socket.once('secureConnect', function () {
            eventTimes.tlsHandshakeAt = process.hrtime();
        });

        _socket.once('connect', onConnect);
    });

    if (log.trace()) {
        log.trace({client_req: opts}, 'request sent');
    }
} // end `rawRequest`


function proxyOptsFromStr(str) {
    if (!str) {
        return (false);
    }

    var s = str;

    // Normalize: host:port -> http://host:port
    // FWIW `curl` supports using "http_proxy=host:port".
    if (!/^[a-z0-9]+:\/\//.test(s)) {
        s = 'http://' + s;
    }
    var parsed = url.parse(s);

    var proxyOpts = {
        protocol: parsed.protocol,
        host: parsed.hostname
    };

    if (parsed.port) {
        proxyOpts.port = Number(parsed.port);
    }

    if (parsed.auth) {
        proxyOpts.proxyAuth = parsed.auth;
    }

    return (proxyOpts);
}

//  Check if url is excluded by the no_proxy environment variable
function isProxyForURL(noProxy, address) {
    // wildcard
    if (noProxy === '*') {
        return (null);
    }

    // otherwise, parse the noProxy value to see if it applies to the URL
    if (noProxy !== null) {
        var noProxyItem, hostname, port, noProxyItemParts,
            noProxyHost, noProxyPort, noProxyList;

        // canonicalize the hostname
        /* JSSTYLED */
        hostname = address.hostname.replace(/^\.*/, '.').toLowerCase();
        noProxyList = noProxy.split(',');

        for (var i = 0, len = noProxyList.length; i < len; i++) {
            noProxyItem = noProxyList[i].trim().toLowerCase();

            // no_proxy can be granular at the port level
            if (noProxyItem.indexOf(':') > -1) {
                noProxyItemParts = noProxyItem.split(':', 2);
                /* JSSTYLED */
                noProxyHost = noProxyItemParts[0].replace(/^\.*/, '.');
                noProxyPort = noProxyItemParts[1];
                port = address.port ||
                    (address.protocol === 'https:' ? '443' : '80');

                // match - ports are same and host ends with no_proxy entry.
                if (port === noProxyPort &&
                    hostname.indexOf(noProxyHost) ===
                    hostname.length - noProxyHost.length) {
                    return (null);
                }
            } else {
                /* JSSTYLED */
                noProxyItem = noProxyItem.replace(/^\.*/, '.');
                var isMatchedAt = hostname.indexOf(noProxyItem);

                if (isMatchedAt > -1 &&
                    isMatchedAt === hostname.length - noProxyItem.length) {
                    return (null);
                }
            }
        }
    }
    return (true);
}

// --- API

function HttpClient(options) {
    assert.object(options, 'options');
    assert.optionalBool(options.appendPath, 'options.appendPath');
    assert.optionalObject(options.headers, 'options.headers');
    assert.object(options.log, 'options.log');
    assert.optionalObject(options.query, 'options.query');
    assert.optionalFunc(options.signRequest, 'options.signRequest');
    assert.optionalString(options.socketPath, 'options.socketPath');
    assert.optionalString(options.url, 'options.url');
    assert.optionalBool(options.followRedirects, 'options.followRedirects');
    assert.optionalString(options.noProxy, 'options.noProxy');
    assert.optionalNumber(options.maxRedirects, 'options.maxRedirects');

    EventEmitter.call(this);

    var self = this;

    // internal only properties
    this._inflightRequests = 0;

    // options properties
    this.agent = options.agent;
    this.appendPath = options.appendPath || false;
    this.ca = options.ca;
    this.checkServerIdentity = options.checkServerIdentity;
    this.cert = options.cert;
    this.ciphers = options.ciphers;
    this.connectTimeout = options.connectTimeout || false;
    this.requestTimeout = options.requestTimeout || false;
    this.headers = options.headers || {};
    this.log = bunyanHelper.ensureSerializers(options.log);
    this.followRedirects = options.followRedirects || false;
    this.maxRedirects = options.maxRedirects || 5;
    this.audit = {
        func: options.auditor || null,
        defaultEnabled: options.audit || false
    };

    this.key = options.key;
    this.name = options.name || 'HttpClient';
    this.passphrase = options.passphrase;
    this.pfx = options.pfx;
    this.query = options.query;

    if (typeof options.rejectUnauthorized !== 'undefined') {
        this.rejectUnauthorized = options.rejectUnauthorized;
    } else {
        this.rejectUnauthorized = true;
    }

    this.retry = cloneRetryOptions(options.retry);
    this.signRequest = options.signRequest || false;
    this.socketPath = options.socketPath || false;

    if (options.url) {
        var parsedUrl = url.parse(
            // trim whitespace from the url which would mess up parsing
            options.url.replace(/\s/g, '')
        );
        assert.ok(
            parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:',
            'must specify http/https protocol!'
        );
        this.url = parsedUrl;
        this.path = parsedUrl.pathname;
    } else {
        this.url = {};
        this.path = '';
    }

    // HTTP proxy: `options.proxy` wins, else `https_proxy`/`http_proxy` envvars
    // (upper and lowercase) are used.
    if (options.proxy === false) {
        self.proxy = false;
    } else if (options.proxy) {
        if (typeof (options.proxy) === 'string') {
            self.proxy = proxyOptsFromStr(options.proxy);
        } else {
            assert.object(options.proxy, 'options.proxy');
            self.proxy = options.proxy;
        }
    } else {
        // For backwards compat in restify 4.x and restify-clients 1.x, the
        // `https_proxy` or `http_proxy` envvar will work for both HTTP and
        // HTTPS. That behaviour may change in the next major version. See
        // restify/node-restify#878 for details.
        self.proxy = proxyOptsFromStr(process.env.https_proxy ||
            process.env.HTTPS_PROXY ||
            process.env.http_proxy ||
            process.env.HTTP_PROXY);
    }

    var noProxy = (options.hasOwnProperty('noProxy') ? options.noProxy
        : (process.env.NO_PROXY || process.env.no_proxy || null));

    if (self.proxy && !isProxyForURL(noProxy, self.url)) {
        self.proxy = false;
    }

    if (options.accept) {
        if (options.accept.indexOf('/') === -1) {
            options.accept = mime.getType(options.accept);
        }

        this.headers.accept = options.accept;
    }

    if (options.contentType) {
        if (options.contentType.indexOf('/') === -1) {
            options.type = mime.getType(options.contentType);
        }

        this.headers['content-type'] = options.contentType;
    }

    if (options.userAgent !== false) {
        this.headers['user-agent'] = options.userAgent ||
            defaultUserAgent();
    }

    if (options.version) {
        this.headers['accept-version'] = options.version;
    }

    if (typeof this.agent === 'undefined') {
        var Agent;
        var maxSockets;
        var opts;

        if (this.proxy) {
            if (this.url.protocol === 'https:') {
                if (this.proxy.protocol === 'https:') {
                    Agent = tunnelAgent.httpsOverHttps;
                } else {
                    Agent = tunnelAgent.httpsOverHttp;
                }
            } else {
                if (this.proxy.protocol === 'https:') {
                    Agent = tunnelAgent.httpOverHttps;
                } else {
                    Agent = tunnelAgent.httpOverHttp;
                }
            }
        } else if (this.url.protocol === 'https:') {
            Agent = KeepAliveAgentSecure;
            maxSockets = httpsMaxSockets;
        } else {
            Agent = KeepAliveAgent;
            maxSockets = httpMaxSockets;
        }

        if (this.proxy) {
            opts = {
                proxy: self.proxy,
                rejectUnauthorized: self.rejectUnauthorized,
                ca: self.ca
            };

            if (self.checkServerIdentity) {
                opts.checkServerIdentity = self.checkServerIdentity;
            }
            this.agent = new Agent(opts);
        } else {
            opts = {
                cert: self.cert,
                ca: self.ca,
                ciphers: self.ciphers,
                key: self.key,
                maxSockets: maxSockets,

                // require('keep-alive-agent')
                maxKeepAliveRequests: 0,
                maxKeepAliveTime: 0,

                // native keepalive
                keepAliveMsecs: 1000,
                keepAlive: true,

                passphrase: self.passphrase,
                pfx: self.pfx,
                rejectUnauthorized: self.rejectUnauthorized
            };

            if (self.checkServerIdentity) {
                opts.checkServerIdentity = self.checkServerIdentity;
            }
            this.agent = new Agent(opts);
            this._keep_alive = true;
        }
    }
}
util.inherits(HttpClient, EventEmitter);

module.exports = HttpClient;


HttpClient.prototype.close = function close() {
    var sockets = this.agent.sockets;
    Object.keys((sockets || {})).forEach(function (k) {
        if (Array.isArray(sockets[k])) {
            sockets[k].forEach(function (s) {
                s.end();
            });
        }
    });

    sockets = this.agent.idleSockets || this.agent.freeSockets;
    Object.keys((sockets || {})).forEach(function (k) {
        sockets[k].forEach(function (s) {
            s.end();
        });
    });
};


HttpClient.prototype.del = function del(options, callback) {
    var opts = this._options('DELETE', options);

    return (this.read(opts, callback));
};


HttpClient.prototype.get = function get(options, callback) {
    var opts = this._options('GET', options);

    return (this.read(opts, callback));
};


HttpClient.prototype.head = function head(options, callback) {
    var opts = this._options('HEAD', options);

    return (this.read(opts, callback));
};


HttpClient.prototype.opts = function httpOptions(options, callback) {
    var _opts = this._options('OPTIONS', options);

    return (this.read(_opts, callback));
};


HttpClient.prototype.post = function post(options, callback) {
    var opts = this._options('POST', options);

    return (this.request(opts, callback));
};


HttpClient.prototype.put = function put(options, callback) {
    var opts = this._options('PUT', options);

    return (this.request(opts, callback));
};


HttpClient.prototype.patch = function patch(options, callback) {
    var opts = this._options('PATCH', options);


    return (this.request(opts, callback));
};


HttpClient.prototype.read = function read(options, callback) {
    var r = this.request(options, function readRequestCallback(err, req) {
        if (!err) {
            req.end();
        }

        return (callback(err, req));
    });
    return (r);
};


HttpClient.prototype.basicAuth = function basicAuth(username, password) {
    if (username === false) {
        delete this.headers.authorization;
    } else {
        assert.string(username, 'username');
        assert.string(password, 'password');

        var buffer = new Buffer(username + ':' + password, 'utf8');
        this.headers.authorization = 'Basic ' +
            buffer.toString('base64');
    }

    return (this);
};


HttpClient.prototype.request = function request(opts, cb) {
    assert.object(opts, 'options');
    assert.func(cb, 'callback');

    /* eslint-disable no-param-reassign */
    cb = once.strict(cb);
    /* eslint-enable no-param-reassign */

    opts.audit = this.audit;
    opts.client = this;

    if (opts.retry === false) {
        rawRequest(opts, cb);
        return;
    }

    var call;
    var retry = cloneRetryOptions(opts.retry);

    opts._keep_alive = this._keep_alive;
    call = backoff.call(rawRequest, opts, cb);
    call.setStrategy(new backoff.ExponentialStrategy({
        initialDelay: retry.minTimeout,
        maxDelay: retry.maxTimeout
    }));
    call.failAfter(retry.retries);
    call.on('backoff', this.emit.bind(this, 'attempt'));

    call.start();
};


/**
 * internal options construction at verb time. variadic args, so the `options`
 * object can be a string or a pojo:
 *      client.get('/foo', cb);
 *          => method='GET', options='/foo'
 *      client.get({ path: '/foo' }, cb);
 *          => method='GET', options={ path: '/foo' }
 * @private
 * @method _options
 * @param {String} method http verb
 * @param {String | Object} options string path or options object
 * @returns {Object} options object specific to this request
*/
HttpClient.prototype._options = function (method, options) {

    // need to assert on all options again here - we're not doing that at verb
    // time for some reason which could cause all sorts of weird behavior.
    assert.string(method, 'method');

    // assert on variadic signature based on typeof
    if (typeof options === 'object') {
        // TODO: missing lots of asserts here
        assert.optionalBool(options.appendPath, 'options.appendPath');
    } else {
        assert.string(options, 'options');
    }

    var self = this;
    var opts = {
        appendPath: options.appendPath || self.appendPath,
        agent: (typeof options.agent !== 'undefined') ?
                options.agent :
                self.agent,
        ca: options.ca || self.ca,
        cert: options.cert || self.cert,
        ciphers: options.ciphers || self.ciphers,
        connectTimeout: options.connectTimeout || self.connectTimeout,
        requestTimeout: options.requestTimeout || self.requestTimeout,
        headers: options.headers || {},
        key: options.key || self.key,
        log: options.log || self.log,
        method: method,
        passphrase: options.passphrase || self.passphrase,
        pfx: options.pfx || self.pfx,
        query: options.query || self.query,
        rejectUnauthorized: options.rejectUnauthorized ||
            self.rejectUnauthorized,
        retry: options.retry !== false ? options.retry : false,
        signRequest: options.signRequest || self.signRequest
    };
    var checkServerIdentity = options.checkServerIdentity ||
        self.checkServerIdentity;

    if (checkServerIdentity) {
        opts.checkServerIdentity = checkServerIdentity;
    }

    // if appendPath option is true, append the passed in path to existing base
    // path.
    if (opts.appendPath === true) {
        opts.path = self.path + '/' + ((typeof options !== 'object') ?
            options : options.path);
        opts.path = opts.path.replace(/(\/)\/+/g, '$1');
    } else {
        // fall back on legacy behavior
        opts.path = (typeof options !== 'object') ? options : options.path;
    }

    if (!opts.retry && opts.retry !== false) {
        opts.retry = self.retry;
    }

    // convert query option into querystring
    if (opts.query &&
        Object.keys(opts.query).length &&
        opts.path.indexOf('?') === -1) {
        opts.path += '?' + qs.stringify(opts.query);
    }

    if (this.socketPath) {
        opts.socketPath = this.socketPath;
    }

    if (this.followRedirects) {
        opts.followRedirects = this.followRedirects;
    }

    if (this.maxRedirects) {
        opts.maxRedirects = this.maxRedirects;
    }

    // this.url is an object created from core's url.parse() method. these are
    // like the "default" options for the client. merge all properties
    // from this object into the options object IFF they haven't already been
    // set.
    Object.keys(this.url).forEach(function (k) {
        if (!opts[k]) {
            opts[k] = self.url[k];
        }
    });

    Object.keys(self.headers).forEach(function (k) {
        if (!opts.headers[k]) {
            opts.headers[k] = self.headers[k];
        }
    });

    if (!opts.headers.date) {
        opts.headers.date = new Date().toUTCString();
    }

    if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
        if (opts.headers['content-type']) {
            delete opts.headers['content-type'];
        }

        if (opts.headers['content-md5']) {
            delete opts.headers['content-md5'];
        }

        if (opts.headers['content-length'] && method !== 'DELETE') {
            delete opts.headers['content-length'];
        }

        if (opts.headers['transfer-encoding']) {
            delete opts.headers['transfer-encoding'];
        }
    }

    // filter out `undefined` headers as Node throws
    // `ERR_HTTP_INVALID_HEADER_VALUE` exception.
    opts.headers = Object.keys(opts.headers).reduce(
        function sanitizeHeaders(_headers, key) {
            var value = opts.headers[key];

            if (value !== undefined) {
                _headers[key] = value;
            }
            return _headers;
        },
        {}
    );

    return (opts);
};


/**
 * return number of currently inflight requests
 * @public
 * @method inflightRequests
 * @returns {Number}
*/
HttpClient.prototype.inflightRequests = function inflightRequests() {
    var self = this;
    return self._inflightRequests;
};


/**
 * increment the number of currently inflight requests
 * @private
 * @method inflightRequests
 * @returns {Number}
*/
HttpClient.prototype._incrementInflightRequests =
function _incrementInflightRequests() {
    var self = this;
    self._inflightRequests++;
};


/**
 * decrement the number of currently inflight requests. also make sure we never
 * drop below 0, which would mean there's a bug in the way we're counting.
 * @public
 * @method inflightRequests
 * @returns {Number}
*/
HttpClient.prototype._decrementInflightRequests =
function _decrementInflightRequests() {
    var self = this;
    self._inflightRequests--;
    assert.ok(self._inflightRequests >= 0,
        'number of inflight requests cannot be < 0');
};
