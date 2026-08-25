'use strict';

var https = require('https');

var assert = require('chai').assert;

var clients = require('../lib');
var tlsCredentials = require('./helpers/tls');


// --- Tests

describe('restify-client tests against local TLS web server', function () {
    var SERVER;
    var PORT;

    before(function (done) {
        SERVER = https.createServer({
            cert: tlsCredentials.CERTIFICATE,
            key: tlsCredentials.KEY
        }, function (req, res) {
            res.writeHead(200, {
                'content-type': 'text/plain'
            });
            res.end('ok');
        });

        SERVER.listen(0, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            done();
        });
    });

    after(function (done) {
        SERVER.close(done);
    });

    it('have timings', function (done) {
        var client = clients.createStringClient({
            url: 'https://localhost:' + PORT,
            rejectUnauthorized: false
        });

        client.get('/', function (err, req, res) {
            client.close();
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
