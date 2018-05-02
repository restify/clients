'use strict';

// core modules
var fs = require('fs');
var path = require('path');

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('StringClient', function() {

    var SERVER;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });
    var CLIENT = clients.createStringClient({
        url: 'http://localhost:3000',
        log: LOG,
        retry: false
    });

    beforeEach(function(done) {
        SERVER = restify.createServer({
            name: 'unittest',
            log: LOG
        });
        SERVER.use(restify.plugins.queryParser());
        SERVER.listen(3000, done);
    });

    afterEach(function(done) {
        CLIENT.close();
        SERVER.close(done);
    });

    it('should support decoding gzipped utf8 multibyte responses',
    function(done) {
        var payload = fs.readFileSync(path.join(
            __dirname, './etc/multibyte.txt'
        )).toString();

        SERVER.use(restify.plugins.gzipResponse());
        SERVER.get('/multibyte', function(req, res, next) {
            res.send(payload);
            return next();
        });

        CLIENT.get({
            path: '/multibyte',
            headers: {
                'accept-encoding': 'gzip'
            }
        }, function(err, req, res, data) {
            assert.ifError(err);
            assert.deepEqual(data, payload);
            return done();
        });
    });


    it('should honor requestTimeout when socket has already been established',
    function(done) {
        SERVER.get('/foo', function(req, res, next) {
            res.send('foo');
            return next();
        });

        SERVER.get('/fooSlow', function(req, res, next) {
            setTimeout(function() {
                res.send('foo');
                return next();
            }, 200);
        });

        // first request should establish keep alive
        CLIENT.get('/foo', function(err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(data, 'foo');
            // second request should reuse existing socket
            CLIENT.get({
                path: '/fooSlow',
                requestTimeout: 100
            }, function(err2, req2, res2, data2) {
                assert.ok(err2);
                assert.strictEqual(err2.name, 'RequestTimeoutError');
                return done();
            });
        });
    });


    it('should support query option for querystring', function(done) {
        SERVER.get('/foo', function(req, res, next) {
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
        }, function(err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(req.path, '/foo?foo=bar');
            return done();
        });
    });
});
