// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.

'use strict';

var assert = require('chai').assert;
var nock;
var clients = require('../lib');


// --- Tests

describe('restify-client tests against nock', function() {

    before(function() {
        // Lazy initialization of nock, as it otherwise interferes with the
        // regular tests
        // eslint-disable-next-line global-require
        nock = require('nock');
    });

    after(function() {
        nock.restore();
    });

    it('sign the request made against nock', function(done) {
        function signFunction(request) {
            request.setHeader('X-Awesome-Signature', 'ken sent me');
        }

        nock('http://127.0.0.1', { allowUnmocked: true })
            .filteringRequestBody(/.*/, '*')
            .get('/nock')
            .reply(200, function(uri, requestBody) {
                assert.equal(
                    this.req.headers['x-awesome-signature'],
                    'ken sent me',
                    'signature header was missing from the request'
                );
            });

        var client = clients.createJsonClient({
            url: 'http://127.0.0.1',
            signRequest: signFunction
        });

        client.get('/nock', done);
    });

});

