'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('`appendPath` option', function () {

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


    describe('constructor time appendPath', function () {

        it('should append to existing constructor time path', function (done) {
            SERVER.get('/foo/bar', function (req, res, next) {
                assert.deepEqual(req.path(), '/foo/bar');
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo',
                appendPath: true
            });
            CLIENT.get('/bar', done);
        });

        it('should append to bare host', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.path(), '/foo');
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000',
                appendPath: true
            });
            CLIENT.get('/foo', done);
        });

        it('should dedupe url slashes', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.path(), '/foo');
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000//',
                appendPath: true
            });
            CLIENT.get('//foo', done);
        });
    });

    describe('verb time appendPath', function () {

        it('should append to existing constructor time path', function (done) {
            SERVER.get('/foo/bar', function (req, res, next) {
                assert.deepEqual(req.path(), '/foo/bar');
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000/foo'
            });
            CLIENT.get({
                path: '/bar',
                appendPath: true
            }, done);
        });

        it('should append to bare host', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.path(), '/foo');
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000'
            });
            CLIENT.get({
                path: '/foo',
                appendPath: true
            }, done);
        });

        it('should dedupe url slashes', function (done) {
            SERVER.get('/foo', function (req, res, next) {
                assert.deepEqual(req.path(), '/foo');
                res.send(200);
                return next();
            });

            CLIENT = clients.createJsonClient({
                url: 'http://localhost:3000//'
            });
            CLIENT.get({
                path: '//foo',
                appendPath: true
            }, done);
        });
    });
});
