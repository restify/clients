'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('backoffs and retries', function () {

    var SERVER;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });
    var CLIENT = clients.createJSONClient({
        url: 'http://localhost:1000',
        log: LOG
    });

    before(function (done) {
        SERVER = restify.createServer({
            name: 'unittest',
            log: LOG
        });
        SERVER.listen(3000, done);
    });


    after(function (done) {
        SERVER.close(done);
    });

    it('should exponentially backoff and retry 4 times', function (done) {
        var start = Date.now();

        CLIENT.get({
            path: '/shouldfail',
            retry: {
                // set lower minTimeout so test doesn't take so long
                minTimeout: 100
            }
        }, function (err, req, res, data) {
            var elapsed = Date.now() - start;
            assert.ok(err);
            assert.include(err.message, 'ECONNREFUSED');
            assert.strictEqual(req.attempts(), 5);
            // in exponential back off, expect retries at:
            // 100, 200, 400, 800 ~= 1500 ms total
            assert.isAtLeast(elapsed, 1500);
            return done();
        });
    });

    it('should not exponentially backoff and retry 4 times', function (done) {
        var start = Date.now();

        CLIENT.get({
            path: '/shouldfail',
            exponentialBackoff: false
        }, function (err, req, res, data) {
            var elapsed = Date.now() - start;
            assert.ok(err);
            assert.include(err.message, 'ECONNREFUSED');
            assert.strictEqual(req.attempts(), 5);
            // this should be pretty instantaneous, usually 10ms but set 100
            // for tests being run on travis or otherwise
            assert.isBelow(elapsed, 100);
            return done();
        });
    });
});
