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
    var STRINGCLIENT = clients.createStringClient({
        url: 'http://localhost:3000/'
    });
    var JSONCLIENT = clients.createJsonClient({
        url: 'http://localhost:3000/'
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
        SERVER.use(restify.plugins.queryParser());
        SERVER.listen(3000, done);
    });

    afterEach(function (done) {
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
});

