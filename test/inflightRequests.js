'use strict';

// external files
var _ = require('lodash');
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('inflightRequests', function () {

    var SERVER;
    var HTTPCLIENT = clients.createHttpClient({
        url: 'http://localhost:3000/',
        requestTimeout: 100
    });
    var STRINGCLIENT = clients.createStringClient({
        url: 'http://localhost:3000/',
        requestTimeout: 100
    });
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });

    beforeEach(function (done) {
        assert.strictEqual(HTTPCLIENT.inflightRequests(), 0);
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 0);

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
        assert.strictEqual(HTTPCLIENT.inflightRequests(), 0);
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 0);

        HTTPCLIENT.close();
        STRINGCLIENT.close();
        SERVER.close(done);
    });

    it('StringClient should increment and decrement inflight requests',
    function (done) {
        // request count decremented right before callback is fired.
        STRINGCLIENT.get('/200', function (err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(STRINGCLIENT.inflightRequests(), 0);
            return done();
        });

        // after firing one request
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 1);
    });

    it('StringClient should increment and decrement inflight on connection ' +
    'timeout',
    function (done) {
        // setup client to point to unresolvable IP
        var client = clients.createStringClient({
            url: 'http://10.255.255.1/',
            connectTimeout: 100,
            retry: {
                minTimeout: 100,
                maxTimeout: 500,
                // ensure even with retries we do correct counting
                retries: 1
            }
        });
        client.get('/foo', function (err, req, res, data) {
            assert.strictEqual(err.name, 'ConnectTimeoutError');
            assert.strictEqual(STRINGCLIENT.inflightRequests(), 0);
            return done();
        });
        assert.strictEqual(client.inflightRequests(), 1);
    });

    it('StringClient should increment and decrement inflight on request ' +
    'timeout', function (done) {
        // setup client to point to unresolvable IP
        STRINGCLIENT.get('/timeout', function (err, req, res, data) {
            assert.strictEqual(err.name, 'RequestTimeoutError');
            assert.strictEqual(STRINGCLIENT.inflightRequests(), 0);
            return done();
        });
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 1);
    });

    it('HttpClient should increment and decrement inflight requests',
    function (done) {
        HTTPCLIENT.get('/200', function (err, req) {
            assert.ifError(err);
            assert.strictEqual(HTTPCLIENT.inflightRequests(), 1);

            req.on('result', function (_err, res) {
                assert.ifError(_err);
                res.on('data', _.noop);
                res.on('end', function () {
                    assert.strictEqual(HTTPCLIENT.inflightRequests(), 0);
                    return done();
                });
            });
        });
    });

    it('HttpClient should increment and decrement connect timeout',
    function (done) {
        // setup client to point to unresolvable IP
        var client = clients.createHttpClient({
            url: 'http://10.255.255.1/',
            connectTimeout: 100,
            retry: false
        });

        client.get('/timeout', function (err, req) {
            assert.ok(err);
            assert.strictEqual(err.name, 'ConnectTimeoutError');
            assert.strictEqual(client.inflightRequests(), 0);
            return done();
        });

        assert.strictEqual(client.inflightRequests(), 1);
    });

    it('HttpClient should increment and decrement request timeout',
    function (done) {
        HTTPCLIENT.get('/timeout', function (err, req) {
            // no connect timeout
            assert.ifError(err);
            assert.strictEqual(HTTPCLIENT.inflightRequests(), 1);

            req.on('result', function (_err, res) {
                assert.ok(_err);
                assert.strictEqual(_err.name, 'RequestTimeoutError');
                assert.notOk(res);
                assert.strictEqual(HTTPCLIENT.inflightRequests(), 0);
                return done();
            });
        });
    });

    it('HttpClient should increment and decrement on forced req abort',
    function (done) {

        var client = clients.createHttpClient({
            url: 'http://localhost:3000'
        });

        client.get('/timeout', function (err, req) {
            // no connect timeout
            assert.ifError(err);
            assert.strictEqual(client.inflightRequests(), 1);

            req.on('result', function (_err, res) {
                assert.strictEqual(client.inflightRequests(), 0);
                assert.ok(_err);
                assert.ok(_err.message, 'socket hang up');
                assert.isNull(res);
                return done();
            });

            req.abort();
        });
    });

    it('should count multiple inflight requests', function (done) {

        STRINGCLIENT.get('/200', _.noop);
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 1);

        STRINGCLIENT.get('/200', _.noop);
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 2);

        STRINGCLIENT.get('/200', _.noop);
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 3);

        STRINGCLIENT.get('/200', _.noop);
        assert.strictEqual(STRINGCLIENT.inflightRequests(), 4);

        setTimeout(function () {
            // wait for all requests to complete
            assert.strictEqual(STRINGCLIENT.inflightRequests(), 0);
            return done();
        }, 500);
    });
});
