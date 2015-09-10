// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.
/* eslint-disable no-console, no-undefined */
// jscs:disable maximumLineLength

'use strict';

var http = require('http');

var assert = require('chai').assert;
var bunyan = require('bunyan');
var crypto = require('crypto');
var uuid   = require('node-uuid');

var restify = require('restify');
var clients = require('../lib');

///--- Globals

var PORT = process.env.UNIT_TEST_PORT || 0;
var JSON_CLIENT;
var STR_CLIENT;
var RAW_CLIENT;
var TIMEOUT_CLIENT;
var SERVER;


///--- Helpers

function sendJson(req, res, next) {
    res.send({hello: req.params.hello || req.params.name || null});
    next();
}


function sendText(req, res, next) {
    var text = 'hello ' + (req.params.hello || req.params.name || '');

    if (req.headers.range) {
        var matched = req.headers.range.match(/bytes=([0-9]+)-([0-9]*)/);
        var start = parseInt(matched[1], 10);
        var length = ((matched[2]) ?
                      parseInt(matched[2], 10) - start :
                      undefined);
        var hash = crypto.createHash('md5');
        hash.update(text, 'utf8');
        res.header('content-md5', hash.digest('base64'));
        res.status(206);
        text = text.substr(start, length);
    }

    res.send(text);
    next();
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

///--- Tests

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

            SERVER.get('/str/request_timeout', requestThatTimesOut);
            SERVER.del('/str/:name', sendText);
            SERVER.get('/str/:name', sendText);
            SERVER.head('/str/:name', sendText);
            SERVER.put('/str/:name', sendText);
            SERVER.post('/str/:name', sendText);
            SERVER.patch('/str/:name', sendText);

            SERVER.listen(PORT, '127.0.0.1', function () {
                PORT = SERVER.address().port;

                JSON_CLIENT = clients.createJsonClient({
                    url: 'http://127.0.0.1:' + PORT,
                    dtrace: dtrace,
                    retry: false
                });
                STR_CLIENT = clients.createStringClient({
                    url: 'http://127.0.0.1:' + PORT,
                    dtrace: dtrace,
                    retry: false
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
            assert.equal(err.message,
                'Request path contains unescaped characters.');
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

    it('PR-726 Enable {agent: false} option override per request', function (done) {
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
        TIMEOUT_CLIENT.get('/str/request_timeout', function (err, req, res, obj) {
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
            certificate: '-----BEGIN CERTIFICATE-----\n' +
                'MIICgzCCAewCCQDutc3iIPK88jANBgkqhkiG9w0BAQUFADCBhTELMAkGA1UEBhMC\n' +
                'VVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28x\n' +
                'FTATBgNVBAoMDEpveWVudCwgSW5jLjEPMA0GA1UECwwGUG9ydGFsMSEwHwYJKoZI\n' +
                'hvcNAQkBFhJzdXBwb3J0QGpveWVudC5jb20wHhcNMTMxMjAyMjI0NjU3WhcNMTQx\n' +
                'MjAyMjI0NjU3WjCBhTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWEx\n' +
                'FjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFTATBgNVBAoMDEpveWVudCwgSW5jLjEP\n' +
                'MA0GA1UECwwGUG9ydGFsMSEwHwYJKoZIhvcNAQkBFhJzdXBwb3J0QGpveWVudC5j\n' +
                'b20wgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBANAWr+pYW+AEP4vC48fByPa2\n' +
                'Fw0h8FSSgVO2zHyibH9S6nSFaNSLeHRofFdK+cD7IRt4A6jxp57IItNwjFiNNMjF\n' +
                'CS5NXKIdPE6HMlb1X7ae+/nN3xRy5321Bi8yQZI6p6b9ATwP8mGBcvx4ta165YFt\n' +
                'M2FmaYWLSNbHIwCxTQMJAgMBAAEwDQYJKoZIhvcNAQEFBQADgYEAXFT1q/uB3/fg\n' +
                'Iq7iZ6R7q7tBYtd9ttQKp8by8jVToIXP4jUEWZ7vE9TZ1/Wm8ZHxlAPjZtN+rsmS\n' +
                'LvgDV22T/s0LgSrdbB/rpYgjsJarlAGfbUYQ6gZKvCMSiZI7oJfl89HDT3PgCtSx\n' +
                'RqHcNabt4hoSccUuACJ1FXkszJ312fA=\n' +
                '-----END CERTIFICATE-----',
            key: '-----BEGIN RSA PRIVATE KEY-----\n' +
                'MIICXAIBAAKBgQDQFq/qWFvgBD+LwuPHwcj2thcNIfBUkoFTtsx8omx/Uup0hWjU\n' +
                'i3h0aHxXSvnA+yEbeAOo8aeeyCLTcIxYjTTIxQkuTVyiHTxOhzJW9V+2nvv5zd8U\n' +
                'cud9tQYvMkGSOqem/QE8D/JhgXL8eLWteuWBbTNhZmmFi0jWxyMAsU0DCQIDAQAB\n' +
                'AoGBAJvz9OHAWRMae/mmFYqXfKMSM1J/Vhw8NLrl7HmYTZJbNSYg+kEZSiyMRmwx\n' +
                '3963F8f7eVq7yfFhc2BeIIEZSy23J9QJCqVIqzl6m2URP4+Dw7ZS2iWIsiPyy+L8\n' +
                'v8CXPQhRGouOXxU6h7WHpfw+Xy+WPVmIVARMi4UpmmOE52eBAkEA6gui4nD841Ds\n' +
                'UEQDMuxNpCf+B20BWKkt8PNODY1HS4rBVCh81oMbaV7VDSabZM7Ba4wrmTAhb1Sc\n' +
                'm7bc/YOb0QJBAOObuVTMCbJ7WZhAPHVYhGS5ptuL9fkktj2BPDcf/3KyuDsM6oVw\n' +
                'Rs9kUfQrSV+w7YALqxWzNCUgzq+qLYPaGbkCQF5hKuIdph0UuPb1NkUGvZiA+BOO\n' +
                'hYh3UKtlsggM/L8dyTBi01S9sgQf1dJjyy4vohf4gmxX2GPIvw6cAynINMECQEjc\n' +
                '7TOMLf6JJmFrDu+x6pAkLppR7+hWLFD8Mj6ja69YL0oYFGurSb/Sqbm0scSEa0N2\n' +
                'eMp1l9fa7M+ndvKiu2ECQGv4W2+yqlbD3Q3Dr14hiWaiYss5350Ohr5HiZZw2L3i\n' +
                's35vQZaHqRxUVZjOi6/MTCZmqvg/RpaVQYHiJHvxGzw=\n' +
                '-----END RSA PRIVATE KEY-----'
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


    it('create JSON client with url instead of opts', function (done) {
        var client = clients.createJsonClient('http://127.0.0.1:' + PORT);
        client.agent = false;

        client.get('/json/mcavage', function (err, req, res, obj) {
            assert.ifError(err);
            assert.deepEqual(obj, {hello: 'mcavage'});
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

        //Blanket wildcard
        process.env.NO_PROXY = '*';
        var clientWithoutProxy = clients.createHttpClient('http://192.168.2.1:');
        assert.equal(false, clientWithoutProxy.proxy);

        //Multiple addresses
        process.env.NO_PROXY = '192.168.2.1, 192.168.2.2';
        clientWithoutProxy = clients.createHttpClient('http://192.168.2.1:');
        assert.equal(false, clientWithoutProxy.proxy);
        clientWithoutProxy = clients.createHttpClient('http://192.168.2.2:');
        assert.equal(false, clientWithoutProxy.proxy);

        //Port specificity
        process.env.NO_PROXY = '192.168.2.1:8080';
        clientWithoutProxy = clients.createHttpClient('http://192.168.2.1:8080');
        clientWithProxy = clients.createHttpClient('http://192.168.2.1');
        assert.ok(clientWithProxy.proxy);
        assert.equal(false, clientWithoutProxy.proxy);
        done();

        //Setting process.env.https_proxy to undefined, converts it to 'undefined'
        if (typeof (origProxy) === 'undefined') {
            delete process.env.https_proxy;
        } else {
            process.env.https_proxy = origProxy;
        }
        process.env.NO_PROXY = origNoProxy;
    });
});
