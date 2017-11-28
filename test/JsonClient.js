'use strict'

var assert = require('chai').assert;
var proxyquire = require('proxyquire');
var sinon = require('sinon');

describe.only('restify-clients JsonClient tests', function () {

    var JsonClient;
    var StringClient;

    before(function (callback) {
        StringClient = sinon.spy();

        JsonClient = proxyquire('../lib/JsonClient', {
            './StringClient': StringClient
        });

        callback();
    });

    it('should set options.accept to "application/json" by default',
        function () {
            var options = {};
            new JsonClient(options);

            assert.equal('application/json', options.accept);
        }
    );

    it('should set options.name to "JsonClient" by default', function () {
        var options = {};
        new JsonClient(options);

        assert.equal('JsonClient', options.name);
    });

    it('should set options.contentType to "application/json" by default',
        function () {
            var options = {};
            new JsonClient(options);

            assert.equal('application/json', options.contentType);
        }
    );

    it('should set _safeStringify to "false" as default', function () {
        var options = {};
        var newClient = new JsonClient(options);

        assert.equal(false, newClient._safeStringify);
    });

    it('should call StringClient with options', function () {
        var options = {};
        new JsonClient(options);

        assert.isOk(StringClient.calledWith(options));
    });

    it('should overwrite options.accept when provided', function () {
        var options = {
            accept: 'text/plain'
        };
        new JsonClient(options);

        assert.equal('text/plain', options.accept);
    });

    it('should overwrite options.name when provided', function () {
        var options = {
            name: 'MyCustomClient'
        };
        new JsonClient(options);

        assert.equal('MyCustomClient', options.name);
    });

    it('should overwrite options.contentType when provided', function () {
        var options = {
            contentType: 'application/vnd.trustvox-v2+json'
        };
        new JsonClient(options);

        assert.equal('application/vnd.trustvox-v2+json', options.contentType);
    });

    it('should overwrite _safeStringify when provided', function () {
        var options = {
            safeStringify: true
        };
        var newClient = new JsonClient(options);

        assert.equal(true, newClient._safeStringify);
    });
});
