'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('query string parameters', function () {

    var SERVER;
    var CLIENT;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
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


    describe('constructor time qs', function () {

        it('should support query option', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'bar'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000',
                query: {
                    foo: 'bar'
                }
            });
            CLIENT.get('/foo', done);
        });

        it('should not support existing query in url', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {});
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo?foo=bar'
            });
            CLIENT.get('/foo', done);
        });

        it('should support serializing objects into associative array',
        function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: {
                        a: 'coffee',
                        b: 'beans'
                    }
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo',
                query: {
                    foo: {
                        a: 'coffee',
                        b: 'beans'
                    }
                }
            });
            CLIENT.get('/foo', done);
        });

        it('should prefer query option over query in url', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'baz'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo?foo=bar',
                query: {
                    foo: 'baz'
                }
            });
            CLIENT.get('/foo', done);
        });
    });


    describe('verb time qs', function () {

        it('should support query option', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'bar'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000'
            });
            CLIENT.get({
                path: '/foo',
                query: {
                    foo: 'bar'
                }
            }, done);
        });

        it('should support query string in path', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'bar'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000'
            });
            CLIENT.get({
                path: '/foo?foo=bar'
            }, done);
        });

        it('should support serializing objects into associative array',
        function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: {
                        a: 'coffee',
                        b: 'beans'
                    }
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo'
            });
            CLIENT.get({
                path: '/foo',
                query: {
                    foo: {
                        a: 'coffee',
                        b: 'beans'
                    }
                }
            }, done);
        });

        it('should prefer query string in path over query option',
        function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'bar'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000'
            });
            CLIENT.get({
                path: '/foo?foo=bar',
                query: {
                    foo: 'baz'
                }
            }, done);
        });
    });


    describe('constructor + verb time overrides', function () {

        it('should prefer verb time query string in path over constructor ' +
        'query', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'qux'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo?foo=bar',
                query: {
                    foo: 'baz'
                }
            });
            CLIENT.get('/foo?foo=qux', done);
        });

        it('should prefer verb time query option over constructor query',
        function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.query, {
                    foo: 'boop'
                });
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo?foo=bar',
                query: {
                    foo: 'baz'
                }
            });
            CLIENT.get({
                path: '/foo',
                query: {
                    foo: 'boop'
                }
            }, done);
        });
    });
});
