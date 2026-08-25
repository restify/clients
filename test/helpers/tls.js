'use strict';

// Self-signed 2048-bit cert valid until year 2126 with
// CN=does.not.exist.com/emailAddress=support@restify.com
var CERTIFICATE = '-----BEGIN CERTIFICATE-----\n' +
    'MIIEHzCCAwegAwIBAgIUMiIFqqplRIom2/RiKDWKqG8JW4YwDQYJKoZIhvcNAQEL\n' +
    'BQAwgZ0xCzAJBgNVBAYTAlVTMREwDwYDVQQIDAhOZXcgWW9yazERMA8GA1UEBwwI\n' +
    'TmV3IFlvcmsxEDAOBgNVBAoMB1Jlc3RpZnkxFTATBgNVBAsMDFJlc3RpZnkgdGVh\n' +
    'bTEbMBkGA1UEAwwSZG9lcy5ub3QuZXhpc3QuY29tMSIwIAYJKoZIhvcNAQkBFhNz\n' +
    'dXBwb3J0QHJlc3RpZnkuY29tMCAXDTI2MDgyNTA5NTU0NFoYDzIxMjYwODAxMDk1\n' +
    'NTQ0WjCBnTELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3JrMREwDwYDVQQH\n' +
    'DAhOZXcgWW9yazEQMA4GA1UECgwHUmVzdGlmeTEVMBMGA1UECwwMUmVzdGlmeSB0\n' +
    'ZWFtMRswGQYDVQQDDBJkb2VzLm5vdC5leGlzdC5jb20xIjAgBgkqhkiG9w0BCQEW\n' +
    'E3N1cHBvcnRAcmVzdGlmeS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK\n' +
    'AoIBAQDhrtcEIjF2JpOKk+pnTH2m9O4nprwH4oVASxWJOhuT0ue9XMmyKBK2UU9K\n' +
    'tAFW2Pfau7CCL7mF5yh/qlNXW2g8oEyvMlbPbypK2jzfYg4lFqLPhXDu5yw7b8LB\n' +
    'J6jn9MBAND5/XiXp2cJECoEGRMEv/DStzOmW0W4oCu471+2bSlTD7IroIecK9W2N\n' +
    'rXd3L0avdDIT9JbyNJeHKh7jfyNAznGkUGLNP82vXCKsSzORYFRVoKUo2kFpauDE\n' +
    'qfWgaXJALSRsS9CptFjWAmUux8Wg5/CdmDKZsa3J+i4q5x/RNAeocpeubzA5IRDm\n' +
    'rlfKKf3DJhfl3HnfstjL9u/8/CkxAgMBAAGjUzBRMB0GA1UdDgQWBBSZsFFuHmI/\n' +
    'n0Hm3y9dZ+xIUDF8qzAfBgNVHSMEGDAWgBSZsFFuHmI/n0Hm3y9dZ+xIUDF8qzAP\n' +
    'BgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBAdnMiXclyFD+uDK5m\n' +
    'kp97qYujZMFvg0cQDC3W75AEFJnMwNvxooBJhVcfKGMQURXsOCtwYYIujYIdA+Qg\n' +
    '0JJZWO32V2t5NUZ2Yqlq9POj65OpKY3n9undUjwvUIO/DcMY3zQrdvL0bKgLprBo\n' +
    'EnOx4DkZraK8XsbmX/hfIgnLpJpf013G3qPPQsnUjrx7L6FWQZd0/qXHUtKIzbTb\n' +
    'NoGgKXa5QAsVakc2xhChJFP0SGMTMOdfD1YqMOjCiGyeskLQrGrtTjaIM/DsFEYt\n' +
    '7FRX96OwJg2uRcG7hSga3G1pS4XfRke0Ahd1OVuhygtI5N0LtZhx0Nrlev244BzM\n' +
    'i8UN\n' +
    '-----END CERTIFICATE-----';

var KEY = '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDhrtcEIjF2JpOK\n' +
    'k+pnTH2m9O4nprwH4oVASxWJOhuT0ue9XMmyKBK2UU9KtAFW2Pfau7CCL7mF5yh/\n' +
    'qlNXW2g8oEyvMlbPbypK2jzfYg4lFqLPhXDu5yw7b8LBJ6jn9MBAND5/XiXp2cJE\n' +
    'CoEGRMEv/DStzOmW0W4oCu471+2bSlTD7IroIecK9W2NrXd3L0avdDIT9JbyNJeH\n' +
    'Kh7jfyNAznGkUGLNP82vXCKsSzORYFRVoKUo2kFpauDEqfWgaXJALSRsS9CptFjW\n' +
    'AmUux8Wg5/CdmDKZsa3J+i4q5x/RNAeocpeubzA5IRDmrlfKKf3DJhfl3HnfstjL\n' +
    '9u/8/CkxAgMBAAECggEAFeRNKLI9bInc7YggKJGPrcKcGH4Qxs4HIX+3ENbxZmNC\n' +
    'xghqa0z+Va+o+qTf7WICFvZ2boZ9H1tXPx0RVQvBnoHpNmRybdBJgLXPSlb7ascZ\n' +
    'l3pJBG+px4E1meGEPa3s+T1oI5hJIrhUIyAGuIoyWDqFjKdwMEhUAG/hAK6XNqUu\n' +
    'VSrAjQeQo6iivtGatOKam4XMxpWtKVikt3VYYjdyaXIihobLRN1r6Q5d22Doy7NH\n' +
    '0Epuh5y+Wx+KiI9vhpL5alPIj1Gkp1PJJccOwkl0bK1kOvZQHgEdw+W+HceDbZLY\n' +
    '2ZOfNxtpioJ+5CftZxn64agc5kA+AHFbW39gn44CrQKBgQDzzzx51+Hct9iNex1g\n' +
    'ma3Sdj5QlcI+xPr9maCdn8cQG+jKT6VFge66cAgaheRIDidSAzDAPXNA3R2u2yYk\n' +
    't6BYdE6i8wBzuybY3wTTJGpY928P2s5r8dRabFOQ/dF8yYO5pU4v0lKl4kXZepBE\n' +
    'o1IgPfs6sLvATRfvkVYk007xJQKBgQDs95VuFWPNbc9kPLXcUIgWrwBAK4Qr0cgw\n' +
    '893vavfOKuzsYB9EuzTbDYts4hCd1E0c4GVAE6FQGtPjbxQLyDz3EoXtuQgyCVgY\n' +
    'GTX8YIMG9RWorqG+1KyuD6OxpFX9Bxf9iawFF0WEp4ijjGumkLR9XMcivMc8rliY\n' +
    'mKL7wAP4HQKBgDFvC2wJAZqnDBljpQk5H61UnD3qn3/qoJla1N4gz1PM1N5wV6pI\n' +
    'NgdHP91g2HBjrkVKsE/KJdw4+RPDC3DWaoSE0IzpiGXuxGmkjm3hLE7tnG8yhjgM\n' +
    'yGmtHSSA0kDi+vphMgEwO+G2h0MZPrcsBjLTXmUAAJF1EC1a4oSE87ShAoGAbvFf\n' +
    'UaHMDxK5RUmzL0m43T3jlSeKguV9n4WdQ4lGKY0pTWWXXhtznJcTzs9sTihmTf21\n' +
    'CbHnFVTqHRIVRYrjGB3g/DJj5uE/EFFFWDprPeei002nRmvVyMxjrDivVX5rufUp\n' +
    'x1xk3L1/GGsWv24CQqscRGQzt3I84nyb2dfFQ/UCgYEA5FnSQhwAbuMcY14zaOMr\n' +
    'GMGcrvGJa1oYUj2Ictcd0tXi0z9xBRvxg6CoA1pQB96ZSSmzuekqwfCK4B4Ktg2U\n' +
    'LFAwvjJ+5uLDWEVQ6yy/09G4Ki0U1b4q12xNsBw42qCeUW1LuvxzjxKiuoPhFwmY\n' +
    'HQ436p0nUfdnCSZrLWP47D4=\n' +
    '-----END PRIVATE KEY-----';

module.exports = {
    CERTIFICATE: CERTIFICATE,
    KEY: KEY
};
