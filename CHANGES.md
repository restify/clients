# restify-clients Changelog

## not yet released

(nothing yet)

## 2.6.4

* #195: fix: read from response stream using non-flowing mode
* #197: docs: remove duplicated and confusing content
* #200: fix: double inflight request decrement

## 2.6.3

* #192: ensure `req.getMetrics()` and `req.getTimings()` methods are always
  available.

## 2.6.2

* #189: swap querystring for qs to support object serialization in query params

## 2.5.2

* #187: fix callback getting invoked more than once causing throw

## 2.5.1

* #184: fix: bump once dependency to version 1.4.0 to get missing once.strict API

## 2.5.0

* #173: support content-md5 header generated from different node versions. This
  adds a new [contentMd5](README.md#contentMd5) StringClient option that can be
  used to control content-md5 response header validation.

## 2.4.0

* #81: add `inflightRequests()` API

## 2.3.0

* #179: add `after` event

## 2.2.0

* #178: add metrics event

## 2.0.3

* #175: fix(HttpClient): attach readable event after data to keep response
  stream flow

## 2.0.2

* #169: Restore 'dtrace-provided' optional dependency (accidentally removed
  in v1.5.1)

## 2.0.1

### Fix ###
* #160: handle request timeouts when a response object has not yet been created

## 2.0.0

### Breaking ###
* #109: Migrate to restify-errors@6.0.0. This migrates all errors to using
  VError under the hood.
* #141: Throw when the `url` option does not have a valid http/https protocol.
* #148: JSONClient is now strict about valid responses. Non JSON responses
  return parse errors to the caller. HTTP errors supersede parse errors. JSONP
  is also no longer supported. Empty responses return an empty pojo `{}`.

### Fix ###
* #132: Handle multibyte characters properly in gzipped responses
* #152: Honor `requestTimeout` when re-using existing socket/connection
* #154: Trim extraneous whitespace characters in `url` option

### New ###
* #109: Add DNSTimeoutError.
* #105: Support for checkServerIdentity https option (#155)
* #139: Record request lifecyclet timings. Retrievable via `req.getTimings()`
* #153: Support `query` option at both constructor and request time

### Chore ###
* Makefile now uses Yarn under the hood.
* #158: Upgrade to new major versions, mime@2.x and fast-safe-stringify@2.x

## 1.5.2

- Switch back to restify-errors@3 to fix backward incompatiblity in
  `<err>.code` for some error classes.

## 1.5.1

Note: *Bad Release*. `restify-errors` was erroneously updated, breaking
the API.

## 1.5.0

Add a `safeStringify` option to the JSON client to safely stringify request
bodies that may be circular.

## 1.4.1

- #90 Fix `<jsonclient>.post(...)` without a body argument.

## 1.4.0

- Update bunyan and dtrace-provider deps to avoid some deprecation warnings
  with node 6 in some cases. See
  <https://github.com/chrisa/node-dtrace-provider/issues/74> for deeper
  details.
- restify/node-restify#878 Improved HTTP proxy handling.
    - There is a new `options.noProxy` option to `create*Client` that overrides
      the `NO_PROXY` envvar.
    - `options.proxy` overrides `*_proxy` environment variables (e.g.
      `HTTPS_PROXY`, `http_proxy`).
    - Compatibility note: To maintain backward compatibility in 1.x, any of
      these environment variables (in the order shown, first wins) are used to
      proxy for http or https URLs: `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`,
      `http_proxy`. In a future major version, behaviour might be changed
      to ignore `HTTPS_PROXY` and `https_proxy` environment variables when
      proxying a *http* URL. See
      <https://github.com/restify/node-restify/issues/878#issuecomment-249673285>
      for discussion.

## 1.3.3

- Correct usage of `assert.number` (and variants) for update from
  assert-plus@0.1 to 1.0.

## 1.3.2

Note: *Bad release.* The changes for the assert-plus upgrade broke
creating a client without a given `options.retry.maxTimeout`.

- Switch back to restify-errors@3 to fix backward incompatiblity in
  `<err>.code` for some error classes. See
  <https://github.com/restify/clients/pull/42> for discussion.
- Update to node-uuid 1.4.6 or greater to get a security fix
  (https://nodesecurity.io/advisories/uuid_insecure-entropy-source-mathrandom)
  though the only current usage in restify-clients isn't anything
  exploitable. Also update some other deps.

## 1.3.1

Note: *Bad release.* This release introduced an update from restify-errors@3 to
restify-errors@4 which included a backward incompatible change in `<err>.code`
for created errors. Switch to version 1.3.2 or greater.

- #65 accidentally didn't work. Fix that to correctly export
  `.bunyan.serializers`.

## 1.3.0

- #65 Export `require('restify-clients').bunyan.serializers` for use in
  creating the Bunyan logger to pass a client constructor.
- The clients will now properly ensure that the given
  [Bunyan](https://github.com/trentm/node-bunyan) logger `log` has the
  serializers required by logging in this module. This fixes a regression
  from restify/node-restify#501.
- #68 Fix 'make test' on node 6.x.

## 1.2.1 and earlier
- #15 Add audit logger (Marcello de Sales)
- #22 Follow Redirects (Wagner Francisco Mezaroba)
