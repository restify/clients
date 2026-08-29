'use strict';

// external files
var assert = require('chai').assert;
var proxyquire = require('proxyquire');

// local files
var clients = require('../lib');


describe('HttpClient', function () {

    var CLIENT;


    it('should invoke callbacks with reserved once state properties',
    function () {
        var callbackCalls = 0;
        var wrappedCallback;
        var fakeCall = {
            setStrategy: function () {},
            failAfter: function () {},
            on: function () {},
            start: function () {
                assert.isFalse(wrappedCallback.called);
                assert.isUndefined(wrappedCallback.value);
                wrappedCallback(null, {id: 'request'});
                wrappedCallback(new Error('second call'), {id: 'other'});
            }
        };
        var fakeBackoff = {
            call: function (_rawRequest, _opts, wrapped) {
                wrappedCallback = wrapped;
                return fakeCall;
            },
            ExponentialStrategy: function () {}
        };
        var HttpClient = proxyquire('../lib/HttpClient', {
            backoff: fakeBackoff
        });
        var client = {
            audit: {},
            _keep_alive: false,
            emit: function () {}
        };
        function decoratedCallback(err, request) {
            assert.isNull(err);
            assert.deepEqual(request, {id: 'request'});
            callbackCalls += 1;
        }
        decoratedCallback.called = true;
        decoratedCallback.value = 'consumer-owned';
        HttpClient.prototype.request.call(client, {
            retry: {minTimeout: 1, maxTimeout: 1, retries: 1}
        }, decoratedCallback);
        assert.strictEqual(callbackCalls, 1);
        assert.isTrue(wrappedCallback.called);
    });


    it('should throw on url without protocol', function () {
        assert.throws(function () {
            clients.createHttpClient({
                url: 'localhost:3000'
            });
        }, 'must specify http/https protocol!');
    });


    it('should not throw on url with protocol', function () {
        assert.doesNotThrow(function () {
            CLIENT = clients.createHttpClient({
                url: 'http://www.restify.com'
            });
        });
        assert.strictEqual(CLIENT.url.protocol, 'http:');

        assert.doesNotThrow(function () {
            CLIENT = clients.createHttpClient({
                url: 'https://www.restify.com'
            });
        });
        assert.strictEqual(CLIENT.url.protocol, 'https:');
    });


    it('should trim whitespaces in url', function () {
        CLIENT = clients.createHttpClient({
            url: 'https://www.  restify\t.com:3000'
        });
        assert.strictEqual(CLIENT.url.hostname, 'www.restify.com');
        assert.strictEqual(CLIENT.url.port, '3000');
    });

    it('should parse proxy url strings', function () {
        CLIENT = clients.createHttpClient({
            url: 'http://www.restify.com',
            proxy: 'proxy.example.com:4321',
            noProxy: ''
        });

        assert.deepEqual(CLIENT.proxy, {
            protocol: 'http:',
            host: 'proxy.example.com',
            port: 4321
        });
    });

    it('should parse proxy url auth', function () {
        CLIENT = clients.createHttpClient({
            url: 'http://www.restify.com',
            proxy: 'http://user%40name:p%3Aword@proxy.example.com:4321',
            noProxy: ''
        });

        assert.deepEqual(CLIENT.proxy, {
            protocol: 'http:',
            host: 'proxy.example.com',
            port: 4321,
            proxyAuth: 'user@name:p:word'
        });
    });

    it('should fill default User Agent when none is given', function () {
        CLIENT = clients.createHttpClient();
        assert.strictEqual(CLIENT.headers['user-agent'].slice(0, 8),
                           'restify/');
    });

    it('should keep User Agent from headers if none is given', function () {
        const userAgent = 'The Acme Browser 0.42';
        CLIENT = clients.createHttpClient({
            headers: {'user-agent': userAgent}
        });
        assert.strictEqual(CLIENT.headers['user-agent'], userAgent);
    });

    it('should use given User Agent', function () {
        const userAgent = 'The Acme Browser 0.42';
        CLIENT = clients.createHttpClient({
            headers: {'user-agent': 'Not The Acme Browser 0.00'},
            userAgent
        });
        assert.strictEqual(CLIENT.headers['user-agent'], userAgent);
    });
});
