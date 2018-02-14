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
});
