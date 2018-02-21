'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('JsonClient', function () {

    var SERVER;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });
    var CLIENT = clients.createJsonClient({
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
});
