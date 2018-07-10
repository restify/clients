'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');
var _ = require('lodash');

// local files
var clients = require('../lib');


describe('`after` event', function () {

    var SERVER;
    var HTTPCLIENT = clients.createHttpClient({
        url: 'http://localhost:3000/',
        requestTimeout: 100
    });
    var STRINGCLIENT = clients.createStringClient({
        url: 'http://localhost:3000/',
        requestTimeout: 100
    });
    var JSONCLIENT = clients.createJsonClient({
        url: 'http://localhost:3000/',
        requestTimeout: 100
    });
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });

    beforeEach(function (done) {
        SERVER = restify.createServer({
            name: 'unittest',
            log: LOG
        });
        SERVER.get('/200', function (req, res, next) {
            res.send(200, { hello: 'world' });
            return next();
        });
        SERVER.get('/500', function (req, res, next) {
            res.send(500, { empty: 'world' });
            return next();
        });
        SERVER.get('/timeout', function (req, res, next) {
            setTimeout(function () {
                return next();
            }, 1000);
        });
        SERVER.use(restify.plugins.queryParser());
        SERVER.listen(3000, done);
    });

    afterEach(function (done) {
        HTTPCLIENT.close();
        STRINGCLIENT.close();
        JSONCLIENT.close();
        SERVER.close(done);
    });

    it('StringClient should emit after event on 200', function (done) {
        STRINGCLIENT.get('/200', _.noop);
        STRINGCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.ok(res);
            assert.ok(res.socket);
            assert.equal(res.statusCode, 200);
            assert.ifError(err);
            return done();
        });
    });

    it('StringClient should emit after event on 500', function (done) {
        STRINGCLIENT.get('/500', _.noop);
        STRINGCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.ok(res);
            assert.ok(res.socket);
            assert.equal(res.statusCode, 500);
            assert.ok(err);
            return done();
        });
    });

    it('StringClient should emit after event on connect timeout',
    function (done) {
        // setup client to point to unresolvable IP
        var client = clients.createStringClient({
            url: 'http://10.255.255.1/',
            connectTimeout: 100,
            retry: false
        });
        client.get('/timeout', _.noop);
        client.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.isNull(res);
            assert.ok(err);
            assert.equal(err.name, 'ConnectTimeoutError');
            return done();
        });
    });

    it('StringClient should emit after event on request timeout',
    function (done) {
        STRINGCLIENT.get('/timeout', _.noop);
        STRINGCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.isNull(res);
            assert.ok(err);
            assert.equal(err.name, 'RequestTimeoutError');
            return done();
        });
    });

    it('StringClient should emit after event after userland callback',
    function (done) {
        var afterFired = false;
        var callbackFired = false;

        STRINGCLIENT.get('/200', function () {
            assert.isFalse(afterFired);
            callbackFired = true;
        });
        STRINGCLIENT.once('after', function (req, res, err) {
            assert.isTrue(callbackFired);
            afterFired = true;

            if (callbackFired && afterFired) {
                done();
            }
        });
    });

    it('JSONClient should emit after event on 200', function (done) {
        JSONCLIENT.get('/200', _.noop);
        JSONCLIENT.once('after', function (req, res, err, data) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.ok(res);
            assert.ok(res.socket);
            assert.equal(res.statusCode, 200);
            assert.ifError(err);
            return done();
        });
    });

    it('JSONClient should emit after event on 500', function (done) {
        JSONCLIENT.get('/500', _.noop);
        JSONCLIENT.once('after', function (req, res, err, data) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.ok(res);
            assert.ok(res.socket);
            assert.equal(res.statusCode, 500);
            assert.ok(err);
            return done();
        });
    });

    it('JSONClient should emit after event on connect timeout',
    function (done) {
        // setup client to point to unresolvable IP
        var client = clients.createJsonClient({
            url: 'http://10.255.255.1/',
            connectTimeout: 100,
            retry: false
        });
        client.get('/timeout', _.noop);
        client.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.isNull(res);
            assert.ok(err);
            assert.equal(err.name, 'ConnectTimeoutError');
            return done();
        });
    });

    it('JSONClient should emit after event on request timeout',
    function (done) {
        JSONCLIENT.get('/timeout', _.noop);
        JSONCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.isNull(res);
            assert.ok(err);
            assert.equal(err.name, 'RequestTimeoutError');
            return done();
        });
    });

    it('JSONClient should emit after event after userland callback',
    function (done) {
        var afterFired = false;
        var callbackFired = false;

        JSONCLIENT.get('/200', function () {
            assert.isFalse(afterFired);
            callbackFired = true;
        });
        JSONCLIENT.once('after', function (req, res, err) {
            assert.isTrue(callbackFired);
            afterFired = true;

            if (callbackFired && afterFired) {
                done();
            }
        });
    });

    it('HttpClient should emit after event on 200', function (done) {
        HTTPCLIENT.get('/200', function (err, req) {
            assert.ifError(err);
            req.on('result', function (_err, res) {
                assert.ifError(_err);
                res.on('data', _.noop);
            });
        });
        HTTPCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.ok(res);
            assert.ok(res.socket);
            assert.equal(res.statusCode, 200);
            assert.ifError(err);
            return done();
        });
    });

    it('HttpClient should emit after event on 500', function (done) {
        HTTPCLIENT.get('/500', function (err, req) {
            assert.ifError(err);
            req.on('result', function (_err, res) {
                assert.ok(_err);
                res.on('data', _.noop);
            });
        });
        HTTPCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.ok(res);
            assert.ok(res.socket);
            assert.equal(res.statusCode, 500);
            assert.ok(err);
            return done();
        });
    });

    it('HttpClient should emit after event on connect timeout',
    function (done) {
        // setup client to point to unresolvable IP
        var client = clients.createHttpClient({
            url: 'http://10.255.255.1/',
            connectTimeout: 100,
            retry: false
        });
        client.get('/timeout', _.noop);
        client.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.isNull(res);
            assert.ok(err);
            assert.equal(err.name, 'ConnectTimeoutError');
            return done();
        });
    });

    it('HttpClient should emit after event on request timeout',
    function (done) {
        HTTPCLIENT.get('/timeout', _.noop);
        HTTPCLIENT.once('after', function (req, res, err) {
            assert.ok(req);
            assert.ok(req.socket);
            assert.isNull(res);
            assert.ok(err);
            assert.equal(err.name, 'RequestTimeoutError');
            return done();
        });
    });

    it('HttpClient should emit after event after userland callback',
    function (done) {
        var afterFired = false;
        var callbackFired = false;

        HTTPCLIENT.get('/200', function (err, req) {
            assert.ifError(err);
            req.on('result', function (_err, res) {
                assert.ifError(_err);
                assert.isFalse(afterFired);
                callbackFired = true;
                res.on('data', _.noop);
            });
        });

        HTTPCLIENT.once('after', function (req, res, err) {
            assert.isTrue(callbackFired);
            afterFired = true;

            if (callbackFired && afterFired) {
                done();
            }
        });
    });

    it('HttpClient should allow mutation of req/res to propagate error info',
    function (done) {
        HTTPCLIENT.get('/500', function (err, req) {
            assert.ifError(err);
            req.on('result', function (_err, res) {
                assert.ok(_err);
                // consume the stream
                res.on('data', function (chunk) {
                    var invalidDataError = new Error('invalid data format!');
                    // attach it to the req or res object
                    req.myErr = invalidDataError;
                });
            });
        });

        HTTPCLIENT.once('after', function (req, res, err) {
            assert.ok(err);
            assert.deepEqual(err.name, 'InternalServerError');
            assert.ok(req.myErr);
            assert.deepEqual(req.myErr.message, 'invalid data format!');
            return done();
        });
    });
});
