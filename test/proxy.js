/*
 * Test handling for restify-clients' HTTP proxy handling.
 */

'use strict';

var assert = require('chai').assert;
var http = require('http');
var net = require('net');
var url = require('url');

var clients = require('../lib');


// --- Globals

var PORT = process.env.UNIT_TEST_PORT || 0;
var PROXYSERVER;
var PROXYURL;
var PROXIED = [];
const PROXYSOCKETS = [];


// --- Helpers

function stripProcessEnv() {
    // Ensure envvars don't get in the way.
    [
        'HTTP_PROXY',
        'http_proxy',
        'HTTPS_PROXY',
        'https_proxy',
        'NO_PROXY',
        'no_proxy'
    ].forEach(function (n) {
        delete process.env[n];
    });
}


// --- Tests

describe('restify-client proxy tests', function () {

    before(function (callback) {
        try {
            // A forward-proxy adapted from
            // jscs:disable maximumLineLength
            // <https://github.com/nodejitsu/node-http-proxy/blob/master/examples/http/reverse-proxy.js>
            // (where it is incorrectly named a "reverse" proxy).
            // jscs:enable maximumLineLength
            PROXYSERVER = http.createServer();

            PROXYSERVER.on('connect', function (req, socket) {
                PROXIED.push({url: req.url, headers: req.headers});
                var serverUrl = url.parse('https://' + req.url);

                var srvSocket = net.connect(serverUrl.port, serverUrl.hostname,
                function () {
                    socket.write('HTTP/1.1 200 Connection Established\r\n' +
                        'Proxy-agent: Node-Proxy\r\n' +
                        '\r\n');
                    srvSocket.pipe(socket);
                    socket.pipe(srvSocket);
                });
                PROXYSOCKETS.push(srvSocket);
                PROXYSOCKETS.push(socket);
            });

            PROXYSERVER.listen(PORT, '127.0.0.1', function () {
                PORT = PROXYSERVER.address().port;
                PROXYURL = 'http://127.0.0.1:' + PORT;
                setImmediate(callback);
            });
        } catch (e) {
            /* eslint-disable no-console */
            console.error(e.stack);
            /* eslint-enable no-console */
            process.exit(1);
        }
    });

    after(function (callback) {
        try {
            // TODO(mmarchini): Could the hanging sockets be a bug? Investigate
            for (const socket of PROXYSOCKETS) {
                if (socket.destroyed === false) {
                    socket.destroy();
                }
            }
            PROXYSERVER.close(callback);
        } catch (e) {
            /* eslint-disable no-console */
            console.error(e.stack);
            /* eslint-enable no-console */
            process.exit(1);
        }
    });

    it('GET https (without a proxy)', function (done) {
        stripProcessEnv();
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 0);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('GET http (without a proxy)', function (done) {
        stripProcessEnv();
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'http://www.google.com',
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 0);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('GET https with options.proxy', function (done) {
        stripProcessEnv();
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            proxy: PROXYURL,
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 1);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('GET http with options.proxy', function (done) {
        stripProcessEnv();
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'http://www.google.com',
            proxy: PROXYURL,
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 1);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    [
        'HTTP_PROXY',
        'http_proxy',
        'HTTPS_PROXY',
        'https_proxy'
    ].forEach(function (n) {
        it('GET https with ' + n + ' envvar', function (done) {
            stripProcessEnv();
            process.env[n] = PROXYURL;
            PROXIED = [];
            var client = clients.createStringClient({
                url: 'https://www.google.com',
                retry: false
            });
            client.get('/', function (err, req, res, body) {
                assert.ifError(err);
                assert.equal(PROXIED.length, 1);
                assert.ok(res.statusCode < 400);
                client.close();
                done();
            });
        });

        it('GET http with ' + n + ' envvar', function (done) {
            stripProcessEnv();
            process.env[n] = PROXYURL;
            PROXIED = [];
            var client = clients.createStringClient({
                url: 'http://www.google.com',
                retry: false
            });
            client.get('/', function (err, req, res, body) {
                assert.ifError(err);
                assert.equal(PROXIED.length, 1);
                assert.ok(res.statusCode < 400);
                client.close();
                done();
            });
        });
    });

    it('options.proxy=PROXYURL wins over envvar', function (done) {
        stripProcessEnv();
        process.env.https_proxy = 'https://example.com:1234';
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            proxy: PROXYURL,
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 1);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('options.proxy=false wins over envvar', function (done) {
        stripProcessEnv();
        process.env.https_proxy = PROXYURL;
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            proxy: false,
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 0);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('no_proxy=*', function (done) {
        stripProcessEnv();
        process.env.no_proxy = '*';
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            proxy: PROXYURL,
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 0);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('NO_PROXY=*', function (done) {
        stripProcessEnv();
        process.env.NO_PROXY = '*';
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            proxy: PROXYURL,
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 0);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    it('options.noProxy wins over NO_PROXY envvar', function (done) {
        stripProcessEnv();
        process.env.NO_PROXY = '*';
        PROXIED = [];
        var client = clients.createStringClient({
            url: 'https://www.google.com',
            proxy: PROXYURL,
            noProxy: '',
            retry: false
        });
        client.get('/', function (err, req, res, body) {
            assert.ifError(err);
            assert.equal(PROXIED.length, 1);
            assert.ok(res.statusCode < 400);
            client.close();
            done();
        });
    });

    // noProxy values that should result in NOT using the proxy.
    [
        '*',
        'google.com',
        'www.google.com',
        'example.com,www.google.com',
        'example.com, www.google.com'
    ].forEach(function (noProxy) {
        it('options.noProxy="' + noProxy + '" (match)', function (done) {
            stripProcessEnv();
            PROXIED = [];
            var client = clients.createStringClient({
                url: 'https://www.google.com',
                proxy: PROXYURL,
                noProxy: noProxy,
                retry: false
            });
            client.get('/', function (err, req, res, body) {
                assert.ifError(err);
                assert.equal(PROXIED.length, 0);
                assert.ok(res.statusCode < 400);
                client.close();
                done();
            });
        });
    });

    // noProxy values that should result in USING the proxy.
    [
        '.*',
        'oogle.com',
        'ww.google.com',
        'foo.google.com'
    ].forEach(function (noProxy) {
        it('options.noProxy="' + noProxy + '" (no match)', function (done) {
            stripProcessEnv();
            PROXIED = [];
            var client = clients.createStringClient({
                url: 'https://www.google.com',
                proxy: PROXYURL,
                noProxy: noProxy,
                retry: false
            });
            client.get('/', function (err, req, res, body) {
                assert.ifError(err);
                assert.equal(PROXIED.length, 1);
                assert.ok(res.statusCode < 400);
                client.close();
                done();
            });
        });
    });
});
