'use strict';

// external files
var assert = require('chai').assert;

// local files
var clients = require('../lib');


describe('HttpClient', function () {

    var CLIENT;


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
