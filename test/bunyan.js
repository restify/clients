/* eslint-disable no-console, no-undefined */
// jscs:disable maximumLineLength

/*
 * Test handling for Bunyan logging in restify-clients.
 */

'use strict';

var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

var clients = require('../lib');


///--- Globals

var PORT = process.env.UNIT_TEST_PORT || 0;
var SERVER;


///--- Helpers

function sendJsonPong(req, res, next) {
    res.header('content-type', 'json');
    res.send(200, 'pong');
    next();
}

function getLog(name, stream, level) {
    return (bunyan.createLogger({
        level: (process.env.LOG_LEVEL || level || 'fatal'),
        name: name || process.argv[1],
        stream: stream || process.stdout,
        src: true,
        serializers: restify.bunyan.serializers
    }));
}

function BunyanRecordCapturer() {
    this.records = [];
}
BunyanRecordCapturer.prototype.write = function (record) {
    this.records.push(record);
};


function assertCreateClientAndValidLog(log, capture, done) {
    var client = clients.createJsonClient({
        url: 'http://127.0.0.1:' + PORT,
        retry: false,
        log: log
    });
    client.get('/json/ping', function (err, req, res, obj) {
        assert.ifError(err);
        assert.isAtLeast(capture.records.length, 3);
        assert.ok(capture.records[0].client_req);
        assert.deepEqual(Object.keys(capture.records[0].client_req).sort(),
            ['method', 'url', 'address', 'port', 'headers'].sort());
        assert.ok(capture.records[1].client_res);
        assert.deepEqual(Object.keys(capture.records[1].client_res).sort(),
            ['statusCode', 'headers'].sort());
        client.close();
        done();
    });
}


///--- Tests

describe('restify-client bunyan usage tests', function () {

    before(function (callback) {
        try {
            SERVER = restify.createServer({
                log: getLog('server')
            });

            SERVER.get('/json/ping', sendJsonPong);

            SERVER.listen(PORT, '127.0.0.1', function () {
                PORT = SERVER.address().port;
                setImmediate(callback);
            });
        } catch (e) {
            console.error(e.stack);
            process.exit(1);
        }
    });


    after(function (callback) {
        try {
            SERVER.close(callback);
        } catch (e) {
            console.error(e.stack);
            process.exit(1);
        }
    });


    it('no logger', function (done) {
        var client = clients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT,
            retry: false
        });
        client.get('/json/ping', function (err, req, res, obj) {
            assert.ifError(err);
            assert.ok(req);
            assert.ok(res);
            assert.deepEqual(obj, 'pong');
            client.close();
            done();
        });
    });

    it('no serializers', function (done) {
        var capture = new BunyanRecordCapturer();
        var log = bunyan.createLogger({
            name: 'client',
            streams: [{type: 'raw', stream: capture, level: 'trace'}]
        });
        assertCreateClientAndValidLog(log, capture, done);
    });

    it('bunyan stdSerializers', function (done) {
        var capture = new BunyanRecordCapturer();
        var log = bunyan.createLogger({
            name: 'client',
            streams: [{type: 'raw', stream: capture, level: 'trace'}],
            serializers: bunyan.stdSerializers
        });
        assertCreateClientAndValidLog(log, capture, done);
    });

    it('some unrelated bunyan serializer "foo"', function (done) {
        var capture = new BunyanRecordCapturer();
        var log = bunyan.createLogger({
            name: 'client',
            streams: [{type: 'raw', stream: capture, level: 'trace'}],
            serializers: {
                foo: function serializeFoo(foo) {
                    return foo;
                }
            }
        });
        assertCreateClientAndValidLog(log, capture, done);
    });

    it('using restify-clients exported "bunyan.serializers"', function (done) {
        var capture = new BunyanRecordCapturer();
        var log = bunyan.createLogger({
            name: 'client',
            streams: [{type: 'raw', stream: capture, level: 'trace'}],
            serializers: clients.bunyan.serializers
        });
        assertCreateClientAndValidLog(log, capture, done);
    });
});
