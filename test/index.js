// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.
/* eslint-disable no-console, no-undefined */

'use strict';

var http = require('http');

var assert = require('chai').assert;
var bunyan = require('bunyan');
var crypto = require('crypto');
var format = require('util').format;
var uuid   = require('uuid');

var restify = require('restify');
var clients = require('../lib');
var auditor = require('../lib/helpers/auditor');
var pkgJson = require('../package');

// --- Globals

var PORT = process.env.UNIT_TEST_PORT || 0;
var JSON_CLIENT;
var STR_CLIENT;
var RAW_CLIENT;
var TIMEOUT_CLIENT;
var SAFE_STRINGIFY_CLIENT;
var SERVER;

// Self-signed cert valid until year 2117 with
// CN=does.not.exist.com/emailAddress=support@restify.com
var CERTIFICATE = '-----BEGIN CERTIFICATE-----\n' +
    'MIIDDDCCAnWgAwIBAgIJAPKmGJ2jaQDGMA0GCSqGSIb3DQEBCwUAMIGdMQswCQYD\n' +
    'VQQGEwJVUzERMA8GA1UECAwITmV3IFlvcmsxETAPBgNVBAcMCE5ldyBZb3JrMRAw\n' +
    'DgYDVQQKDAdSZXN0aWZ5MRUwEwYDVQQLDAxSZXN0aWZ5IHRlYW0xGzAZBgNVBAMM\n' +
    'EmRvZXMubm90LmV4aXN0LmNvbTEiMCAGCSqGSIb3DQEJARYTc3VwcG9ydEByZXN0\n' +
    'aWZ5LmNvbTAgFw0xNzAyMjAwOTM5MjBaGA8yMTE3MDEyNzA5MzkyMFowgZ0xCzAJ\n' +
    'BgNVBAYTAlVTMREwDwYDVQQIDAhOZXcgWW9yazERMA8GA1UEBwwITmV3IFlvcmsx\n' +
    'EDAOBgNVBAoMB1Jlc3RpZnkxFTATBgNVBAsMDFJlc3RpZnkgdGVhbTEbMBkGA1UE\n' +
    'AwwSZG9lcy5ub3QuZXhpc3QuY29tMSIwIAYJKoZIhvcNAQkBFhNzdXBwb3J0QHJl\n' +
    'c3RpZnkuY29tMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDWTKNlj7l5vLfP\n' +
    'Som+Jep4SH7HiMen8XS+1AGt3aPZcZltCIEG6sw476axSKMY7OsLjT+kh0CnVHUg\n' +
    'omL5914bQ/qC8tNhDIAq6K3tBzrpC63mXsA0of7AmjzX67uWga1h1yPJblxIJCiP\n' +
    'Zbnp1mqOoL6uEFt7LW4paodYZ7IiEwIDAQABo1AwTjAdBgNVHQ4EFgQUiJpUOX0/\n' +
    'eByG4CXweHQSnxMdHfMwHwYDVR0jBBgwFoAUiJpUOX0/eByG4CXweHQSnxMdHfMw\n' +
    'DAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOBgQCAOvadZfRO9t8Yo3/0ZIxJ\n' +
    'nMRLOdnT/zQU9b2Lw5zz4bN+eiQJNGtgeqv8Wuh96v4T+v8GHoyG7v39gC6MMowd\n' +
    'k+ptCNcj4UITWG9Wwr/YY15h+eOZXnRNolZDf9Ba1+EE6RxqT7ujckNSB0kOXets\n' +
    'NVyLhnmxQt4jDzmvdR7C+A==\n' +
    '-----END CERTIFICATE-----';
var KEY = '-----BEGIN PRIVATE KEY-----\n' +
    'MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBANZMo2WPuXm8t89K\n' +
    'ib4l6nhIfseIx6fxdL7UAa3do9lxmW0IgQbqzDjvprFIoxjs6wuNP6SHQKdUdSCi\n' +
    'Yvn3XhtD+oLy02EMgCrore0HOukLreZewDSh/sCaPNfru5aBrWHXI8luXEgkKI9l\n' +
    'uenWao6gvq4QW3stbilqh1hnsiITAgMBAAECgYEAu9sO2Xb2VlsynkpvGPrP4YVb\n' +
    'bbrfmr81YhsjJbDHc1P79PKheNjXEYozi/Fq1+zH1qaJhcbyzDxjOKphLVLFcHIH\n' +
    'Dv8UD1r+qRYMGrhtEp5drHx3LnRPzIMD4iUuU+IUD8MbccJKHwLVXymD4HWAknw/\n' +
    'boxrXTy0SlYcBTQtpcECQQD31apWmR29g6Sr67Djg2dsZ0WWt0roEt+UQIEw78mL\n' +
    'dktlldvFKPbNyx7GKSxFjvnap503JJx/vomeMNUQ89mxAkEA3VwfkVmhrtYBg+YR\n' +
    'KbvAtFoI6OLjz5Xow62M+Q3Mg61aFxCDcp+RMnuyT3e9/xP1iaYMRvniyWDGNSI6\n' +
    'lGAlAwJAYmDXiB6ptpPuJyydAAMmZ9qqvgQuYOc1ByV/4wwcZhbkIQQWxDHZnqFV\n' +
    'qvWnFEmIFurYNo567R6WhEwAGAWkUQJABkoFw5VuWI9P/7Vbq3ngIb+lHSjFHDLA\n' +
    'KD8YEENqGhukwZ8AfRM3ht2o1UUrqsGgakbDdojG/r23I+9TBsAsjQJBAITHdSJp\n' +
    'J1c1NopSISDLPFjAengkkh5O8ZRk5fKomA9AcbyeLCEIraW1qWjXLyEvdMA42fa9\n' +
    '8O3F+9khYj53znU=\n' +
    '-----END PRIVATE KEY-----';


// --- Helpers

function sendJson(req, res, next) {
    res.send({hello: req.params.hello || req.params.name || null});
    next();
}


function sendText(req, res, next) {
    var text = 'hello ' + (req.params.hello || req.params.name || '');

    if (req.headers.range) {
        var matched = req.headers.range.match(/bytes=([0-9]+)-([0-9]*)/);
        var start = parseInt(matched[1], 10);
        /* eslint-disable no-undefined */
        var length = ((matched[2]) ?
                      parseInt(matched[2], 10) - start :
                      undefined);
        /* eslint-enable no-undefined */
        var hash = crypto.createHash('md5');
        hash.update(text, 'utf8');
        res.header('content-md5', hash.digest('base64'));
        res.status(206);
        text = text.substr(start, length);
    }

    res.send(text);
    next();
}

function sendRedirect(req, res, next) {
    var statusCode = parseInt(req.params.status_code, 10);
    var path = '/' + req.params.path;
    res.redirect(statusCode, path, next);
}

function sendSignature(req, res, next) {
    res.header('content-type', 'text/plain');
    var hdr = req.header('Awesome-Signature');

    if (!hdr) {
        res.send('request NOT signed');
    } else {
        res.send('ok: ' + hdr);
    }
}


function sendWhitespace(req, res, next) {
    var body = ' ';

    if (req.params.flavor === 'spaces') {
        body = '   ';
    } else if (req.params.flavor === 'tabs') {
        body = ' \t\t  ';
    }

    // override contentType as otherwise the string is json-ified to
    // include quotes. Don't want that for this tesassert.
    res.header('content-type', 'text/plain');
    res.send(body);
    next();
}

function requestThatTimesOut(req, res, next) {
    setTimeout(function () {
        res.send('OK');
        next();
    }, 170);
}

function sendJsonZero(req, res, next) {
    res.header('content-type', 'json');
    res.send(200, 0);
    next();
}

function sendJsonFalse(req, res, next) {
    res.header('content-type', 'json');
    res.send(200, false);
    next();
}

function sendJsonNull(req, res, next) {
    res.header('content-type', 'json');
    res.send(200, null);
    next();
}

function getLog(name, stream, level) {
    return (bunyan.createLogger({
        level: (process.env.LOG_LEVEL || level || 'fatal'),
        name: name || process.argv[1],
        stream: stream || process.stdout,
        src: true,
        serializers: restify.bunyan.serializers
    }));
}

function dtrace() {
    var dtp;

    try {
        var d = require('dtrace-provider');
        dtp = d.createDTraceProvider('restifyUnitTest');
    } catch (e) {
        dtp = null;
    }
    return (dtp);
}

// --- Tests

describe('restify-client tests', function () {

    before(function (callback) {
        try {
            SERVER = restify.createServer({
                dtrace: dtrace,
                log: getLog('server')
            });

            SERVER.use(restify.acceptParser(['json', 'text/plain']));
            SERVER.use(restify.jsonp()); // Added for GH-778
            SERVER.use(restify.dateParser());
            SERVER.use(restify.authorizationParser());
            SERVER.use(restify.queryParser());
            SERVER.use(restify.bodyParser());

            SERVER.get('/signed', sendSignature);
            SERVER.get('/whitespace/:flavor', sendWhitespace);

            SERVER.get('/json/boom', function (req, res, next) {
                res.set('content-type', 'text/html');
                res.send(200, '<html><head/><body/></html>');
                next();
            });
            SERVER.del('/contentLengthAllowed', function (req, res, next) {
                if (req.header('content-length')) {
                    res.send(200, 'Allowed');
                } else {
                    res.send(200, 'Not allowed');
                }
                next();
            });

            SERVER.get('/json/zero', sendJsonZero);
            SERVER.get('/json/false', sendJsonFalse);
            SERVER.get('/json/null', sendJsonNull);

            SERVER.get('/json/:name', sendJson);
            SERVER.head('/json/:name', sendJson);
            SERVER.put('/json/:name', sendJson);
            SERVER.post('/json/:name', sendJson);
            SERVER.patch('/json/:name', sendJson);
            SERVER.del('/json/:name', sendJson);
            SERVER.opts('/json/:name', sendJson);

            SERVER.get('/str/request_timeout', requestThatTimesOut);

            SERVER.del('/str/:name', sendText);
            SERVER.get('/str/:name', sendText);
            SERVER.head('/str/:name', sendText);
            SERVER.put('/str/:name', sendText);
            SERVER.post('/str/:name', sendText);
            SERVER.patch('/str/:name', sendText);
            SERVER.opts('/str/:name', sendText);

            SERVER.get('/redirect/:status_code/:path', sendRedirect);
            SERVER.head('/redirect/:status_code/:path', sendRedirect);
            SERVER.post('/redirect/:status_code/:path', sendRedirect);
            SERVER.put('/redirect/:status_code/:path', sendRedirect);
            SERVER.patch('/redirect/:status_code/:path', sendRedirect);
            SERVER.del('/redirect/:status_code/:path', sendRedirect);
            SERVER.opts('/redirect/:status_code/:path', sendRedirect);

            SERVER.listen(PORT, '127.0.0.1', function () {
                PORT = SERVER.address().port;

                JSON_CLIENT = clients.createJsonClient({
                    url: 'http://127.0.0.1:' + PORT,
                    dtrace: dtrace,
                    retry: false,
                    followRedirects: true
                });
                STR_CLIENT = clients.createStringClient({
                    url: 'http://127.0.0.1:' + PORT,
                    dtrace: dtrace,
                    retry: false,
                    followRedirects: true
                });
                RAW_CLIENT = clients.createClient({
                    url: 'http://127.0.0.1:' + PORT,
                    dtrace: dtrace,
                    retry: false,
                    headers: {
                        accept: 'text/plain'
                    }
                });
                TIMEOUT_CLIENT = clients.createStringClient({
                    url: 'http://127.0.0.1:' + PORT,
                    requestTimeout: 150,
                    retry: false
                });
                SAFE_STRINGIFY_CLIENT = clients.createJsonClient({
                    url: 'http://127.0.0.1:' + PORT,
                    dtrace: dtrace,
                    retry: false,
                    followRedirects: true,
                    safeStringify: true
                });

                process.nextTick(callback);
            });
        } catch (e) {
            console.error(e.stack);
            process.exit(1);
        }
    });


    after(function (callback) {
        try {
            JSON_CLIENT.close();
            STR_CLIENT.close();
            RAW_CLIENT.close();
            TIMEOUT_CLIENT.close();
            SAFE_STRINGIFY_CLIENT.close();
            SERVER.close(callback);
        } catch (e) {
            console.error(e.stack);
            process.exit(1);
        }
    });


    it('GET json', function (done) {
        JSON_CLIENT.get('/json/mcavage', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'mcavage'});
            done();
        });
    });

    it('GH-778 GET jsonp', function (done) {
        // Using variables here to keep lines under 80 chars
        var jsonpUrl = '/json/jsonp?callback=testCallback';
        var expectedResult = 'typeof testCallback === \'function\' && ' +
                             'testCallback({"hello":"jsonp"});';

        JSON_CLIENT.get(jsonpUrl, function (err, req, res) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, expectedResult);
            done();
        });
    });

    it('GH-388 GET json, but really HTML', function (done) {
        JSON_CLIENT.get('/json/boom', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {});
            done();
        });
    });


    it('GH-115 GET path with spaces', function (done) {
        // As of node v0.11, this throws, since it's never valid HTTP
        try {
            JSON_CLIENT.get('/json/foo bar', function (err, req, res, obj) {
                assert.ok(err);
                assert.equal(err.code, 'ECONNRESET');
                done();
            });
        } catch (err) {
            assert.ok(err);
            assert.equal(err.constructor, TypeError);
            var errMsgRe = /^Request path contains unescaped characters\.?$/;
            assert.ok(errMsgRe.test(err.message),
                format('error message matches %s: %j', errMsgRe, err.message));
            done();
        }
    });


    it('Check error (404)', function (done) {
        JSON_CLIENT.get('/' + uuid(), function (err, req, res, obj) {
            assert.ok(err);
            assert.ok(err.message);
            assert.equal(err.statusCode, 404);
            assert.ok(req);
            assert.ok(res);
            assert.ok(obj);
            assert.equal(obj.code, 'ResourceNotFound');
            assert.ok(obj.message);
            done();
        });
    });


    it('HEAD json', function (done) {
        JSON_CLIENT.head('/json/mcavage', function (err, req, res) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            done();
        });
    });


    it('POST json', function (done) {
        var data = { hello: 'foo' };
        JSON_CLIENT.post('/json/mcavage', data, function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'foo'});
            done();
        });
    });

    it('POST with circular JSON', function (done) {
        var data = {
            hello: 'foo'
        };
        data.data = data;

        SAFE_STRINGIFY_CLIENT.post('/json/mcavage', data,
            function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'foo'});
            done();
        });
    });

    it('POST json empty body object', function (done) {
        var data = {};
        JSON_CLIENT.post('/json/mcavage', data, function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'mcavage'});
            done();
        });
    });

    it('POST json without body arg', function (done) {
        JSON_CLIENT.post('/json/mcavage', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'mcavage'});
            done();
        });
    });


    it('PUT json', function (done) {
        var data = { hello: 'foo' };
        JSON_CLIENT.put('/json/mcavage', data, function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'foo'});
            done();
        });
    });


    it('PATCH json', function (done) {
        var data = { hello: 'foo' };
        JSON_CLIENT.patch('/json/mcavage', data, function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {hello: 'foo'});
            done();
        });
    });


    it('GH-800 GET json 0', function (done) {
        JSON_CLIENT.get('/json/zero', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {});
            assert.strictEqual(res.body, '0');
            done();
        });
    });


    it('GH-800 GET json false', function (done) {
        JSON_CLIENT.get('/json/false', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {});
            assert.strictEqual(res.body, 'false');
            done();
        });
    });


    it('GH-800 GET json null', function (done) {
        JSON_CLIENT.get('/json/null', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {});
            assert.strictEqual(res.body, 'null');
            done();
        });
    });


    it('GET text', function (done) {
        STR_CLIENT.get('/str/mcavage', function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello mcavage');
            done();
        });
    });

    it('GET PARTIAL text', function (done) {
        var opts = {
            path: '/str/mcavage',
            headers: {
                Range: 'bytes=0-10'
            }
        };
        STR_CLIENT.get(opts, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello mcav');
            done();
        });
    });


    it('HEAD text', function (done) {
        STR_CLIENT.head('/str/mcavage', function (err, req, res) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            done();
        });
    });

    it('Check error (404)', function (done) {
        STR_CLIENT.get('/' + uuid(), function (err, req, res, message) {
            assert.ok(err);
            assert.ok(err.message);
            assert.equal(err.statusCode, 404);
            assert.ok(req);
            assert.ok(res);
            assert.ok(message);
            done();
        });
    });


    it('POST text', function (done) {
        var body = 'hello=foo';
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello foo');
            done();
        });
    });


    it('PATCH text', function (done) {
        var body = 'hello=foo';
        STR_CLIENT.patch('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello foo');
            done();
        });
    });


    it('POST text (object)', function (done) {
        var body = {hello: 'foo'};
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello foo');
            done();
        });
    });


    it('POST text empty body string', function (done) {
        var body = '';
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello mcavage');
            done();
        });
    });


    it('POST text null body', function (done) {
        var body = null;
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello mcavage');
            done();
        });
    });


    it('POST text empty body object', function (done) {
        var body = {};
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello mcavage');
            done();
        });
    });


    it('PUT text', function (done) {
        var body = 'hello=foo';
        STR_CLIENT.put('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello foo');
            done();
        });
    });

    it('PUT text empty body string', function (done) {
        var body = '';
        STR_CLIENT.put('/str/mcavage', body, function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.equal(res.body, data);
            assert.equal(data, 'hello mcavage');
            done();
        });
    });

    it('DELETE text', function (done) {
        STR_CLIENT.del('/str/mcavage', function (err, req, res) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            done();
        });
    });

    it('DELETE allows content-length', function (done) {
        var opts = {
            path: '/contentLengthAllowed',
            headers: {
                'content-length': '0'
            }
        };

        STR_CLIENT.del(opts, function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, 'Allowed');
            done();
        });
    });

    it('GET raw', function (done) {
        RAW_CLIENT.get('/str/mcavage', function (connectErr, req) {
            assert.ifError(connectErr);
            assert.ok(req);

            req.on('result', function (err, res) {
                assert.ifError(err);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    res.body += chunk;
                });

                res.on('end', function () {
                    assert.equal(res.body, 'hello mcavage');
                    done();
                });
            });
        });
    });


    it('POST raw', function (done) {
        var opts = {
            path: '/str/mcavage',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            }
        };
        RAW_CLIENT.post(opts, function (connectErr, req) {
            assert.ifError(connectErr);

            req.write('hello=snoopy');
            req.end();

            req.on('result', function (err, res) {
                assert.ifError(err);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    res.body += chunk;
                });

                res.on('end', function () {
                    assert.equal(res.body, 'hello snoopy');
                    done();
                });
            });
        });
    });

    it('PR-726 Enable {agent: false} option override per request',
        function (done) {
        var opts = {
            path: '/str/noagent',
            agent: false
        };
        RAW_CLIENT.get(opts, function (err, req, res) {
            assert.ifError(err);
            assert.notStrictEqual(req.agent, RAW_CLIENT.agent,
                'request should not use client agent');
            done();
        });
    });

    it('GH-20 connectTimeout', function (done) {
        var client = clients.createClient({
            url: 'http://169.254.1.10',
            type: 'http',
            accept: 'text/plain',
            connectTimeout: 100,
            retry: false,
            agent: false
        });

        client.get('/foo', function (err, req) {
            assert.ok(err);
            assert.equal(err.name, 'ConnectTimeoutError');
            done();
        });
    });

    it('requestTimeout', function (done) {
        TIMEOUT_CLIENT.get('/str/request_timeout',
            function (err, req, res, obj) {
            assert.ok(err);
            assert.equal(err.name, 'RequestTimeoutError');
            done();
        });
    });

    it('GH-169 PUT json Content-MD5', function (done) {
        var msg = {
            _id: '4ff71172bc148900000010a3',
            userId: '4f711b377579dbf65e000001',
            courseId: '4f69021bff338faffa000001',
            createdByUserId: '4f711b377579dbf65e000001',
            dateFrom: '2012-06-04',
            dateTo: '2012-09-30',
            notes: 'Rates do not include tax & are subject to change ' +
                'without notice\\nRental Clubs are available for $30 ' +
                'per set\\nAll major credit cards accepted',
            updatedAt: '2012-07-06T17:59:08.581Z',
            periods: [
                {
                    name: 'morning',
                    weekdayWalking: 1500,
                    weekdayCart: 3000,
                    weekendWalking: 2000,
                    weekendCart: 3500,
                    timeFrom: 0,
                    timeTo: 780,
                    _id: '4ff71172bc148900000010a4'
                },
                {
                    timeFrom: 780,
                    name: 'twilight',
                    timeTo: 900,
                    weekdayWalking: 1500,
                    weekdayCart: 2500,
                    weekendWalking: 1500,
                    weekendCart: 3000,
                    _id: '4ff7276cbc148900000010f4'
                },
                {
                    timeFrom: 900,
                    name: 'super twilight',
                    weekdayWalking: 1200,
                    weekdayCart: 2000,
                    weekendWalking: 1200,
                    weekendCart: 2500,
                    timeTo: 1439,
                    _id: '4ff7276cbc148900000010f3'
                }
            ],
            holidays: [
                {
                    country: 'US',
                    name: 'Flag Day',
                    start: 1339657200000,
                    end: 1339743600000,
                    date: '2012-06-14'
                },
                {
                    country: 'US / MX',
                    name: 'Father\'s Day, Día del Padre ' +
                        '(Father\'s Day)',
                    start: 1340262000000,
                    end: 1340348400000,
                    date: '2012-06-21'
                },
                {
                    country: 'US',
                    name: 'Independence Day',
                    start: 1341385200000,
                    end: 1341471600000,
                    date: '2012-07-04'
                },
                {
                    country: 'US',
                    name: 'Labor Day',
                    start: 1347001200000,
                    end: 1347087600000,
                    date: '2012-09-07'
                }
            ],
            weekdaySunday: false,
            weekdaySaturday: false,
            weekdayFriday: false,
            weekdayThursday: true,
            weekdayWednesday: true,
            weekdayTuesday: true,
            weekdayMonday: true
        };

        JSON_CLIENT.put('/json/md5', msg, function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            done();
        });
    });


    it('GH-203 GET json, body is whitespace', function (done) {
        JSON_CLIENT.get('/whitespace/spaces', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {});
            done();
        });
    });


    it('GH-203 GET json, body is tabs', function (done) {
        JSON_CLIENT.get('/whitespace/tabs', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, {});
            done();
        });
    });


    it('don\'t sign a request', function (done) {
        var client = clients.createClient({
            url: 'http://127.0.0.1:' + PORT,
            type: 'string',
            accept: 'text/plain',
            headers: { 'Gusty-Winds': 'May Exist' },
            agent: false
        });
        client.get('/signed', function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(data);
            assert.equal(data, 'request NOT signed');
            done();
        });
    });


    it('sign a request', function (done) {
        var called = 0;
        var signer = function sign(request) {
            called++;

            if (!request || !(request instanceof http.ClientRequest)) {
                throw new Error('request must be an instance of ' +
                    'http.ClientRequest');
            }
            var gw = request.getHeader('Gusty-Winds');

            if (!gw) {
                throw new Error('Gusty-Winds header was not ' +
                    'present in request');
            }
            request.setHeader('Awesome-Signature', 'Gusty Winds ' + gw);
        };
        var client = clients.createClient({
            url: 'http://127.0.0.1:' + PORT,
            type: 'string',
            accept: 'text/plain',
            signRequest: signer,
            headers: { 'Gusty-Winds': 'May Exist' },
            agent: false
        });
        client.get('/signed', function (err, req, res, data) {
            assert.ifError(err);
            assert.ok(data);
            assert.equal(called, 1);
            assert.equal(data, 'ok: Gusty Winds May Exist');
            done();
        });
    });

    it('secure client connection with timeout', function (done) {
        var server = restify.createServer({
            certificate: CERTIFICATE,
            key: KEY
        });

        server.get('/ping', function (req, res) {
            res.end('pong');
        });
        server.listen(8443);

        var client = clients.createStringClient({
            url: 'https://127.0.0.1:8443',
            connectTimeout: 2000,
            rejectUnauthorized: false
        });
        var timeout = setTimeout(function () {
            assert.ok(false, 'timed out');
            done();
        }, 2050);

        client.get('/ping', function (err, req, res, body) {
            assert.ifError(err);
            clearTimeout(timeout);
            assert.equal(body, 'pong');
            client.close();
            server.close();
            done();
        });
    });

    it('secure client connection with server identity check', function (done) {
        var server = restify.createServer({
            certificate: CERTIFICATE,
            key: KEY
        });

        server.get('/ping', function (req, res) {
            res.end('pong');
        });
        server.listen(8443);

        var client = clients.createStringClient({
            url: 'https://127.0.0.1:8443',
            connectTimeout: 2000,
            ca: CERTIFICATE,
            checkServerIdentity: function (servername, cert) {
                // servername = "127.0.0.1", cert is Object
                return undefined;
            }
        });
        var timeout = setTimeout(function () {
            assert.ok(false, 'timed out');
            done();
        }, 2050);

        client.get('/ping', function (err, req, res, body) {
            assert.ifError(err);
            clearTimeout(timeout);
            assert.equal(body, 'pong');
            client.close();
            server.close();
            done();
        });
    });

    it('create JSON client with url instead of opts', function (done) {
        var client = clients.createJsonClient('http://127.0.0.1:' + PORT);
        client.agent = false;

        client.get('/json/mcavage', function (err, req, res, obj) {
            assert.ifError(err);
            assert.deepEqual(obj, {hello: 'mcavage'});
            done();
        });
    });

    it('create JSON client with auditor on', function (done) {

        // Bunyan stream to capture the logs.
        function CapturingStream(recs) {

            this.entries = recs;
        }

        // Capture the bunyan logs as of
        // jscs:disable maximumLineLength
        // github.com/trentm/node-bunyan/blob/master/test/raw-stream.test.js#L19-L24
        // jscs:enable maximumLineLength
        CapturingStream.prototype.checkEntriesTest =
            function checkEntriesTest() {
            assert.equal(this.entries.length, 1);
        };

        // The write method to add log entries
        CapturingStream.prototype.write = function write(rec) {

            this.entries.push(rec);
        };

        // Instances of the log entries and the capturing stream
        var logEntries = [];
        var streamConfig = {
            name: 'capturingStream',
            level: 'info',
            stream: new CapturingStream(logEntries),
            type: 'raw'
        };

        // the logger instance
        var logger = bunyan.createLogger({
            url: 'http://127.0.0.1:' + PORT,
            name: 'http-json-client',
            streams: [streamConfig]
        });

        var httpClientOpts = {
            userAgent: pkgJson.name + '/' + pkgJson.version,
            auditor: auditor,
            log: logger,
            retry: false
        };

        var client = clients.createJsonClient(httpClientOpts);
        client.agent = false;

        client.get('/json/mcavage', function (err, req, res, obj) {
            err;
            // The verification is done in the
            // CapturingStream.checkEntriesTest()
            done();
        });
    });

    it('create string client with url instead of opts', function (done) {
        var client = clients.createStringClient('http://127.0.0.1:' + PORT);
        client.agent = false;

        client.get('/str/mcavage', function (err, req, res, data) {
            assert.ifError(err);
            assert.equal(data, 'hello mcavage');
            done();
        });
    });


    it('create http client with url instead of opts', function (done) {
        var client = clients.createHttpClient('http://127.0.0.1:' + PORT);
        client.agent = false;

        client.get('/str/mcavage', function (err, req) {
            assert.ifError(err);

            req.on('result', function (err2, res) {
                assert.ifError(err2);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    res.body += chunk;
                });

                res.on('end', function () {
                    assert.equal(res.body, '"hello mcavage"');
                    done();
                });
            });
        });
    });


    it('create base client with url instead of opts', function (done) {
        var client = clients.createClient('http://127.0.0.1:' + PORT);
        client.agent = false;

        client.get('/str/mcavage', function (err, req) {
            assert.ifError(err);
            req.on('result', function (err2, res) {
                assert.ifError(err2);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    res.body += chunk;
                });

                res.on('end', function () {
                    assert.equal(res.body, '"hello mcavage"');
                    done();
                });
            });
        });
    });


    it('GH-738 respect NO_PROXY while setting proxy', function (done) {
        var origProxy = process.env.https_proxy;
        var origNoProxy = process.env.NO_PROXY;

        process.env.https_proxy = 'http://192.168.1.1';
        process.env.NO_PROXY = '';
        var clientWithProxy = clients.createHttpClient('http://10.3.100.207');
        assert.ok(clientWithProxy.proxy);

        // Blanket wildcard
        process.env.NO_PROXY = '*';
        var clientWithoutProxy =
            clients.createHttpClient('http://192.168.2.1:');
        assert.equal(false, clientWithoutProxy.proxy);

        // Multiple addresses
        process.env.NO_PROXY = '192.168.2.1, 192.168.2.2';
        clientWithoutProxy = clients.createHttpClient('http://192.168.2.1:');
        assert.equal(false, clientWithoutProxy.proxy);
        clientWithoutProxy = clients.createHttpClient('http://192.168.2.2:');
        assert.equal(false, clientWithoutProxy.proxy);

        // Port specificity
        process.env.NO_PROXY = '192.168.2.1:8080';
        clientWithoutProxy =
            clients.createHttpClient('http://192.168.2.1:8080');
        clientWithProxy = clients.createHttpClient('http://192.168.2.1');
        assert.ok(clientWithProxy.proxy);
        assert.equal(false, clientWithoutProxy.proxy);
        done();

        // Setting process.env.https_proxy to undefined, converts it to
        // 'undefined'
        if (typeof (origProxy) === 'undefined') {
            delete process.env.https_proxy;
        } else {
            process.env.https_proxy = origProxy;
        }
        process.env.NO_PROXY = origNoProxy;
    });

    function build302RedirectUrl(numOfRedirects, targetUrl) {
        var url = targetUrl;

        for (var i = 0; i < numOfRedirects; i++) {
            url = 'redirect/302/' + encodeURIComponent(url);
        }

        return url;
    }

    it('should respect default (5) maxRedirects', function (done) {
        var url = '/' + build302RedirectUrl(6, 'str/mcavage');
        STR_CLIENT.get(url, function (err, req, res, data) {
            assert.equal(err.name, 'TooManyRedirectsError');
            done();
        });
    });

    it('should respect custom maxRedirects', function (done) {
        var client = clients.createStringClient({
            url: 'http://127.0.0.1:' + PORT,
            dtrace: dtrace,
            retry: false,
            followRedirects: true,
            maxRedirects: 2
        });
        var url = '/' + build302RedirectUrl(3, 'str/mcavage');

        client.get(url, function (err, req, res, data) {
            assert.equal(err.name, 'TooManyRedirectsError');
            client.close();
            done();
        });
    });

    /* 301 and 302 works like 303 for compatibility reasons */
    describe('follow 301/302/303 redirects', function () {
        var codes = [301, 302, 303];
        var readMethods = ['get', 'opts', 'del'];
        var writeMethods = ['post', 'put', 'patch'];

        codes.forEach(function (code) {
            readMethods.forEach(function (method) {
                var testTitle = method.toUpperCase() + ' ' + code + ' ';

                it(testTitle + ' text', function (done) {
                    STR_CLIENT[method]('/redirect/' + code + '/str%2Fmcavage',
                        function (err, req, res, data) {
                        assert.ifError(err);
                        assert.ok(req);
                        assert.ok(res);
                        assert.equal(res.body, data);
                        assert.equal(data, 'hello mcavage');
                        done();
                    });
                });

                it(testTitle + ' json', function (done) {
                    JSON_CLIENT[method]('/redirect/' + code + '/json%2Fmcavage',
                        function (err, req, res, obj) {
                        assert.ifError(err);
                        assert.ok(req);
                        assert.ok(res);
                        assert.deepEqual(obj, {hello: 'mcavage'});
                        done();
                    });
                });
            });

            writeMethods.forEach(function (method) {
                var testTitle = method.toUpperCase() + ' ' + code + ' ';

                it(testTitle + ' text', function (done) {
                    var body = 'hello=foo';
                    STR_CLIENT[method]('/redirect/' + code + '/str%2Fmcavage',
                        body, function (err, req, res, data) {
                        assert.ifError(err);
                        assert.ok(req);
                        assert.ok(res);
                        assert.equal(res.body, data);
                        assert.equal(data, 'hello mcavage');
                        done();
                    });
                });

                it(testTitle + ' json', function (done) {
                    var data = { hello: 'foo' };
                    JSON_CLIENT[method]('/redirect/' + code + '/json%2Fmcavage',
                        data, function (err, req, res, obj) {
                        assert.ifError(err);
                        assert.ok(req);
                        assert.ok(res);
                        assert.deepEqual(obj, {hello: 'mcavage'});
                        done();
                    });
                });
            });

            // do not assert body on head requests
            it('HEAD ' + code + ' text', function (done) {
                STR_CLIENT.head('/redirect/' + code + '/str%2Fmcavage',
                    function (err, req, res, data) {
                    assert.ifError(err);
                    assert.ok(req);
                    assert.ok(res);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });

            it('HEAD ' + code + ' json', function (done) {
                JSON_CLIENT.head('/redirect/' + code + '/json%2Fmcavage',
                    function (err, req, res, data) {
                    assert.ifError(err);
                    assert.ok(req);
                    assert.ok(res);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });
        });
    });

    describe('follow 307 redirects', function () {
        var readMethods = ['get', 'opts', 'del'];
        var writeMethods = ['post', 'put', 'patch'];

        readMethods.forEach(function (method) {
            var testTitle = method.toUpperCase() + ' 307 ';

            it(testTitle + ' text', function (done) {
                STR_CLIENT[method]('/redirect/307/str%2Fmcavage',
                    function (err, req, res, data) {
                    assert.ifError(err);
                    assert.ok(req);
                    assert.ok(res);
                    assert.equal(res.body, data);
                    assert.equal(data, 'hello mcavage');
                    done();
                });
            });

            it(testTitle + ' json', function (done) {
                JSON_CLIENT[method]('/redirect/307/json%2Fmcavage',
                    function (err, req, res, obj) {
                    assert.ifError(err);
                    assert.ok(req);
                    assert.ok(res);
                    assert.deepEqual(obj, {hello: 'mcavage'});
                    done();
                });
            });
        });

        writeMethods.forEach(function (method) {
            var testTitle = method.toUpperCase() + ' 307 ';

            it(testTitle + ' text', function (done) {
                var body = 'hello=foo';
                STR_CLIENT[method]('/redirect/307/str%2Fmcavage', body,
                    function (err, req, res, data) {
                    assert.ifError(err);
                    assert.ok(req);
                    assert.ok(res);
                    assert.equal(res.body, data);
                    assert.equal(data, 'hello foo');
                    done();
                });
            });

            it(testTitle + ' json', function (done) {
                var data = { hello: 'foo' };
                JSON_CLIENT[method]('/redirect/307/json%2Fmcavage', data,
                    function (err, req, res, obj) {
                    assert.ifError(err);
                    assert.ok(req);
                    assert.ok(res);
                    assert.deepEqual(obj, {hello: 'foo'});
                    done();
                });
            });
        });

        // do not assert body on head requests
        it('HEAD 307 text', function (done) {
            STR_CLIENT.head('/redirect/307/str%2Fmcavage',
                function (err, req, res, data) {
                assert.ifError(err);
                assert.ok(req);
                assert.ok(res);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('HEAD 307 json', function (done) {
            JSON_CLIENT.head('/redirect/307/json%2Fmcavage',
                function (err, req, res, data) {
                assert.ifError(err);
                assert.ok(req);
                assert.ok(res);
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });
});
