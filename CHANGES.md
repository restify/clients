# restify-clients Changelog

## 1.3.0 (not yet released)

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
