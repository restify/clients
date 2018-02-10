'use strict';

// external files
var assert = require('chai').assert;
var bunyan = require('bunyan');
var restify = require('restify');

// local files
var clients = require('../lib');


describe('StringClient', function () {

    var SERVER;
    var LOG = bunyan.createLogger({
        name: 'clientlog'
    });
    var CLIENT = clients.createJSONClient({
        url: 'http://localhost:3000',
        log: LOG,
        retry: false,
        headers: {
            connection: 'close'
        }
    });

    before(function (done) {
        SERVER = restify.createServer({
            name: 'unittest',
            log: LOG
        });
        SERVER.listen(3000, done);
    });


    after(function (done) {
        SERVER.close(done);
    });

    it('should support decoding gzipped utf8 multibyte responses',
    function (done) {
        SERVER.use(restify.plugins.gzipResponse());
        SERVER.get('/multibyte', function (req, res, next) {
            var payload = require('./etc/multibyte.json');
            res.send(payload);
            return next();
        });

        CLIENT.get({
            path: '/multibyte',
            headers: {
                'accept-encoding': 'gzip'
            }
        }, function (err, req, res, data) {
            assert.ifError(err);
            assert.deepEqual(data, require('./etc/multibyte.json'));
            return done();
        });
    });
});
