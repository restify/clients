'use strict';

// core modules
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('StringClient', function () {

    var SERVER;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });
    var CLIENT = clients.createStringClient({
        url: 'http://localhost:3000',
        log: LOG,
        retry: false
    });

    beforeEach(function (done) {
        SERVER = restify.createServer({
            name: 'unittest',
            log: LOG
        });
        SERVER.use(restify.plugins.queryParser());
        SERVER.listen(3000, done);
    });

    afterEach(function (done) {
        CLIENT.close();
        SERVER.close(done);
    });

    it('should make a request',
    function (done) {
        SERVER.get('/ping', function (req, res, next) {
            res.send('pong');
            return next();
        });

        CLIENT.get({
            path: '/ping'
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.equal(data, 'pong');
            return done();
        });
    });

    it('should support decoding gzipped utf8 multibyte responses',
    function (done) {
        var payload = fs.readFileSync(path.join(
            __dirname, './etc/multibyte.txt'
        )).toString();

        SERVER.use(restify.plugins.gzipResponse());
        SERVER.get('/multibyte', function (req, res, next) {
            res.send(payload);
            return next();
        });

        CLIENT.get({
            path: '/multibyte',
            headers: {
                'accept-encoding': 'gzip'
            }
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.deepEqual(data, payload);
            return done();
        });
    });


    it('should honor requestTimeout when socket has already been established',
    function (done) {
        SERVER.get('/foo', function (req, res, next) {
            res.send('foo');
            return next();
        });

        SERVER.get('/fooSlow', function (req, res, next) {
            setTimeout(function () {
                res.send('foo');
                return next();
            }, 200);
        });

        // first request should establish keep alive
        CLIENT.get('/foo', function (err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(data, 'foo');
            // second request should reuse existing socket
            CLIENT.get({
                path: '/fooSlow',
                requestTimeout: 100
            }, function (err2, req2, res2, data2) {
                assert.ok(err2);
                assert.strictEqual(err2.name, 'RequestTimeoutError');
                return done();
            });
        });
    });


    it('should support query option for querystring', function (done) {
        SERVER.get('/foo', function (req, res, next) {
            assert.deepEqual(req.query, {
                foo: 'bar'
            });
            res.send(200);
            return next();
        });

        CLIENT.get({
            path: '/foo',
            query: {
                foo: 'bar'
            }
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(req.path, '/foo?foo=bar');
            return done();
        });
    });


    it('should allow content-md5 with default encoding', function (done) {
        var result = '¥';

        SERVER.get('/foo', function (req, res, next) {
            var hash = crypto.createHash('md5').update(result);
            res.header('content-md5', hash.digest('base64'));
            res.send(result);
            return next();
        });

        CLIENT.get({
            path: '/foo'
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(res.body, result);
            assert.isOk(res.headers['content-md5'], 'Has content-md5 header');
            return done();
        });
    });

    it('GH-173 should allow content-md5 with binary encoding', function (done) {
        var result = '¥';

        SERVER.get('/foo', function (req, res, next) {
            var hash = crypto.createHash('md5').update(result, 'binary');
            res.header('content-md5', hash.digest('base64'));
            res.send(result);
            return next();
        });

        CLIENT.get({
            path: '/foo'
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(res.body, result);
            assert.isOk(res.headers['content-md5'], 'Has content-md5 header');
            return done();
        });

    });

    it('GH-173 should allow content-md5 with utf8 encoding', function (done) {
        var result = '¥';

        // Test with 'utf8' encoding.
        SERVER.get('/foo', function (req, res, next) {
            var hash = crypto.createHash('md5').update(result, 'utf8');
            res.header('content-md5', hash.digest('base64'));
            res.send(result);
            return next();
        });

        CLIENT.get({
            path: '/foo'
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(res.body, result);
            assert.isOk(res.headers['content-md5'], 'Has content-md5 header');
            return done();
        });
    });

    it('should disallow bogus content-md5', function (done) {
        var result = '¥';

        // Test with bad content-md5 header.
        SERVER.get('/foo', function (req, res, next) {
            var hash = crypto.createHash('md5').update(result);
            res.header('content-md5', hash.digest('base64'));
            res.send('bogus data');
            return next();
        });

        CLIENT.get({
            path: '/foo'
        }, function (err, req, res, data) {
            assert.isOk(err, 'expect an error');
            assert.strictEqual(err.message, 'BadDigest');
            assert.isOk(res.headers['content-md5'], 'Has content-md5 header');
            return done();
        });
    });
});
