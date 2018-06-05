'use strict';

var assert = require('chai').assert;
var clients = require('../lib');


// --- Tests

describe('restify-client tests against real web server', function () {
    it('have timings', function (done) {
        this.timeout(10000);
        var client = clients.createStringClient({
            url: 'https://www.netflix.com'
        });

        client.get('/', function (err, req, res) {
            assert.ifError(err);

            var timings = req.getTimings();

            assert.isObject(timings);
            assert.isNumber(timings.dnsLookup);
            assert.isNumber(timings.tlsHandshake);
            assert.isNumber(timings.tcpConnection);
            assert.isNumber(timings.firstByte);
            assert.isNumber(timings.contentTransfer);
            assert.isNumber(timings.total);
            done();
        });
    });
});

