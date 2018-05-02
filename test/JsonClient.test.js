'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('JsonClient', function() {

    var SERVER;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });
    var CLIENT = clients.createJsonClient({
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


    it('should support default query option in constructor', function(done) {
        SERVER.get('/foo', function(req, res, next) {
            assert.deepEqual(req.query, {
                foo: 'i am default'
            });
            res.send(200);
            return next();
        });

        CLIENT = clients.createJsonClient({
            url: 'http://localhost:3000',
            query: {
                foo: 'i am default'
            },
            retry: false
        });

        CLIENT.get('/foo', function(err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(req.path, '/foo?foo=i%20am%20default');
            return done();
        });
    });


    it('should support query option per request', function(done) {
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


    it('should override default query option per request', function(done) {
        SERVER.get('/foo', function(req, res, next) {
            assert.deepEqual(req.query, {
                baz: 'qux'
            });
            res.send(200);
            return next();
        });

        CLIENT = clients.createJsonClient({
            url: 'http://localhost:3000',
            query: {
                foo: 'bar'
            },
            retry: false
        });

        CLIENT.get({
            path: '/foo',
            query: {
                baz: 'qux'
            }
        }, function(err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(req.path, '/foo?baz=qux');
            return done();
        });
    });


    it('should ignore query option if querystring exists in url',
    function(done) {
        SERVER.get('/foo', function(req, res, next) {
            assert.deepEqual(req.query, {
                a: '1'
            });
            res.send(200);
            return next();
        });

        CLIENT.get({
            path: '/foo?a=1',
            query: {
                b: 2
            }
        }, function(err, req, res, data) {
            assert.ifError(err);
            assert.strictEqual(req.path, '/foo?a=1');
            return done();
        });
    });
});
