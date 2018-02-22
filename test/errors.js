// Copyright (c) 2017, Joyent, Inc.

'use strict';

var assert = require('chai').assert;
var errors = require('restify-errors');



// -- Codes

var REST_CODES = [
    { name: 'BadDigestError', code: 400 },
    { name: 'BadMethodError', code: 405 },
    { name: 'ConnectTimeoutError', code: 408 },
    { name: 'InternalError', code: 500 },
    { name: 'InvalidArgumentError', code: 409 },
    { name: 'InvalidContentError', code: 400 },
    { name: 'InvalidCredentialsError', code: 401 },
    { name: 'InvalidHeaderError', code: 400 },
    { name: 'InvalidVersionError', code: 400 },
    { name: 'MissingParameterError', code: 409 },
    { name: 'NotAuthorizedError', code: 403 },
    { name: 'RequestExpiredError', code: 400 },
    { name: 'RequestThrottledError', code: 429 },
    { name: 'ResourceNotFoundError', code: 404 },
    { name: 'WrongAcceptError', code: 406 }
];

var HTTP_CODES = [
    { name: 'BadRequestError', code: 400 },
    { name: 'UnauthorizedError', code: 401 },
    { name: 'PaymentRequiredError', code: 402 },
    { name: 'ForbiddenError', code: 403 },
    { name: 'NotFoundError', code: 404 },
    { name: 'MethodNotAllowedError', code: 405 },
    { name: 'NotAcceptableError', code: 406 },
    { name: 'ProxyAuthenticationRequiredError', code: 407 },
    { name: 'RequestTimeoutError', code: 408 },
    { name: 'ConflictError', code: 409 },
    { name: 'GoneError', code: 410 },
    { name: 'LengthRequiredError', code: 411 },
    // The PreconditionFailedError exported by restify-errors is
    // actually a RestError, and not an HttpError:
    { name: 'PreconditionFailedError', code: 412 },
    { name: 'UnsupportedMediaTypeError', code: 415 },
    { name: 'ExpectationFailedError', code: 417 },
    { name: 'ImATeapotError', code: 418 },
    { name: 'UnprocessableEntityError', code: 422 },
    { name: 'LockedError', code: 423 },
    { name: 'FailedDependencyError', code: 424 },
    { name: 'UnorderedCollectionError', code: 425 },
    { name: 'UpgradeRequiredError', code: 426 },
    { name: 'PreconditionRequiredError', code: 428 },
    { name: 'TooManyRequestsError', code: 429 },
    { name: 'RequestHeaderFieldsTooLargeError', code: 431 },
    { name: 'InternalServerError', code: 500 },
    { name: 'NotImplementedError', code: 501 },
    { name: 'BadGatewayError', code: 502 },
    { name: 'ServiceUnavailableError', code: 503 },
    { name: 'GatewayTimeoutError', code: 504 },
    { name: 'HttpVersionNotSupportedError', code: 505 },
    { name: 'VariantAlsoNegotiatesError', code: 506 },
    { name: 'InsufficientStorageError', code: 507 },
    { name: 'BandwidthLimitExceededError', code: 509 },
    { name: 'NotExtendedError', code: 510 },
    { name: 'NetworkAuthenticationRequiredError', code: 511 }
];

if (process.version.slice(0, 2) === 'v0') {
    HTTP_CODES = HTTP_CODES.concat([
        { name: 'RequestEntityTooLargeError', code: 413 },
        { name: 'RequesturiTooLargeError', code: 414 },
        { name: 'RequestedRangeNotSatisfiableError', code: 416 }
    ]);
} else {
    HTTP_CODES = HTTP_CODES.concat([
        { name: 'PayloadTooLargeError', code: 413 },
        { name: 'UriTooLongError', code: 414 },
        { name: 'RangeNotSatisfiableError', code: 416 }
    ]);
}


// --- Tests


/*
 * WARNING: DO NOT CHANGE THESE TESTS!
 *
 * The names of the errors returned from this library, and the fields on them
 * like "statusCode" and "restCode" are an important part of the API, since
 * dependent libraries check these fields in order to determine what kind of
 * response they received from the server. These tests make sure that they
 * don't accidentally change.
 */
describe('errors are part of the interface', function() {
    it('check that codeToHttpError is present', function(done) {
        assert.equal('function', typeof (errors.codeToHttpError));

        HTTP_CODES.forEach(function(info) {
            var err = errors.codeToHttpError(info.code);
            assert.equal(info.name, err.name);
            assert.equal(info.code, err.statusCode);
        });

        done();
    });

    it('check that RestErrors are correct', function(done) {
        REST_CODES.forEach(function(info) {
            var shortName = info.name.replace(/Error$/, '');
            var constructor = errors[info.name];
            assert.isOk(constructor, info.name);

            var err = new constructor();
            assert.deepEqual(info.name, err.name);
            assert.deepEqual(shortName, err.body.code);
            assert.deepEqual(shortName, err.restCode);
            assert.deepEqual(info.code, err.statusCode);
            assert.isOk(err instanceof errors.RestError);
        });

        done();
    });

    it('check that HttpErrors are correct', function(done) {
        HTTP_CODES.forEach(function(info) {
            var shortName = info.name.replace(/Error$/, '');
            var constructor = errors[info.name];
            assert.isOk(constructor, info.name);

            var err = new constructor();
            assert.deepEqual(info.name, err.name);
            assert.deepEqual(shortName, err.body.code);
            assert.deepEqual(info.code, err.statusCode);
            assert.isOk(err instanceof errors.HttpError);
        });

        done();
    });
});
