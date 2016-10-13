# restify-clients Changelog

## not yet released

- Switch back to restify-errors@3 to fix backward incompatiblity in
  `<err>.code` for some error classes. See
  <https://github.com/restify/clients/pull/42> for discussion.

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
