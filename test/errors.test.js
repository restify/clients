'use strict';

var dns = require('dns');

var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');
var restifyErrs = require('restify-errors');

var clients = require('../lib');


describe('Error factories', function () {

    var SERVER;
    var CLIENT;
    var PORT = 3000;

    beforeEach(function (done) {
        SERVER = restify.createServer({
            log: bunyan.createLogger({
                name: 'server'
            }),
            handleUncaughtExceptions: false
        });

        SERVER.listen(PORT, done);
    });

    afterEach(function (done) {
        CLIENT.close();
        SERVER.close(done);
    });


    it('should return ConnectTimeoutError on connect timeout', function (done) {
        CLIENT = clients.createClient({
            url: 'http://10.255.255.1:81',
            connectTimeout: 200,
            retry: false,
            agent: false
        });

        CLIENT.get({
            path: '/foo',
            query: { a: 1 }
        }, function (err, req) {
            assert.ok(err);
            assert.strictEqual(err.name, 'ConnectTimeoutError');
            assert.deepEqual(restifyErrs.info(err), {
                address: '10.255.255.1',
                connectTimeout: 200,
                fullUrl: 'http://10.255.255.1:81/foo?a=1',
                method: 'GET',
                port: '81'
            });
            done();
        });
    });


    it('should return DNSTimeoutError when dns resolution times out',
    function (done) {
        dns.oldLookup = dns.lookup;
        dns.lookup = function interceptLookup() {
            // do nothing, so it will stall and timeout
        };

        CLIENT = clients.createClient({
            url: 'http://www.restify.com',
            connectTimeout: 200,
            retry: false,
            agent: false
        });

        CLIENT.get({
            path: '/foo',
            query: { a: 1 }
        }, function (err, req) {
            assert.ok(err);
            assert.strictEqual(err.name, 'DNSTimeoutError');
            assert.deepEqual(restifyErrs.info(err), {
                address: null,
                connectTimeout: 200,
                fullUrl: 'http://www.restify.com/foo?a=1',
                method: 'GET',
                port: null
            });

            // restore dns behavior
            dns.lookup = dns.oldLookup;
            delete dns.oldLookup;
            return done();
        });
    });


    it('should return RequestTimeoutError on request timeout', function (done) {
        CLIENT = clients.createStringClient({
            url: 'http://127.0.0.1:' + PORT,
            requestTimeout: 150,
            retry: false
        });

        SERVER.get('/timeout', function (req, res, next) {
            setTimeout(function () {
                res.send('OK');
                next();
            }, 170);
        });

        CLIENT.get('/timeout', function (err, req, res, obj) {
            assert.isTrue(err instanceof Error);
            assert.equal(err.name, 'RequestTimeoutError');
            assert.equal(
                err.message,
                'GET request to ' +
                'http://127.0.0.1:' + PORT + '/timeout ' +
                'failed to complete within 150ms'
            );
            assert.deepEqual(restifyErrs.info(err), {
                address: '127.0.0.1',
                fullUrl: 'http://127.0.0.1:' + PORT + '/timeout',
                method: 'GET',
                port: PORT.toString(),
                requestTimeout: 150
            });
            done();
        });
    });


    it('should return error info for 4xx/5xx http errors', function (done) {
        CLIENT = clients.createStringClient({
            url: 'http://127.0.0.1:' + PORT
        });

        SERVER.get('/500', function (req, res, next) {
            res.send(500, 'boom');
        });

        CLIENT.get('/500', function (err, req, res, obj) {
            assert.isTrue(err instanceof Error);
            assert.strictEqual(err.name, 'InternalServerError');
            assert.deepEqual(restifyErrs.info(err), {
                address: '127.0.0.1',
                fullUrl: 'http://127.0.0.1:' + PORT + '/500',
                method: 'GET',
                port: PORT.toString()
            });
            return done();
        });
    });
});
