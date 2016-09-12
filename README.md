# restify-clients

[![NPM Version](https://img.shields.io/npm/v/restify-clients.svg)](https://npmjs.org/package/restify-clients)
[![Build Status](https://travis-ci.org/restify/clients.svg?branch=master)](https://travis-ci.org/restify/clients)
[![Coverage Status](https://coveralls.io/repos/restify/clients/badge.svg?branch=master)](https://coveralls.io/r/restify/clients?branch=master)
[![Dependency Status](https://david-dm.org/restify/clients.svg)](https://david-dm.org/restify/clients)
[![devDependency Status](https://david-dm.org/restify/clients/dev-status.svg)](https://david-dm.org/restify/clients#info=devDependencies)
[![bitHound Score](https://www.bithound.io/github/restify/clients/badges/score.svg)](https://www.bithound.io/github/restify/clients/master)
[![NSP Status](https://img.shields.io/badge/NSP%20status-vulnerabilities%20found-red.svg)](https://travis-ci.org/restify/clients)

> HttpClient, StringClient, and JsonClient extracted from restify

This module contains HTTP clients extracted from restify.

* JsonClient - sends and expects application/json
* StringClient - sends url-encoded request and expects text/plain
* HttpClient - thin wrapper over node's http/https libraries

The idea being that if you want to support "typical" control-plane REST APIs, you probably want the JsonClient, or if you're using some other serialization (like XML) you'd write your own client that extends the StringClient. If you need streaming support, you'll need to do some work on top of the HttpClient, as StringClient and friends buffer requests/responses.

All clients support retry with exponential backoff for getting a TCP connection; they do not perform retries on 5xx error codes like previous versions of the restify client. You can set retry to false to disable this logic altogether. Also, all clients support a connectTimeout field, which is use on each retry. The default is not to set a connectTimeout, so you end up with the node.js socket defaults.

## Getting Started

Install the module with: `npm install restify-clients`

## Usage

### Client API

There are actually three separate clients shipped in restify:

* **JsonClient:** sends and expects application/json
* **StringClient:** sends url-encoded request and expects text/plain
* **HttpClient:** thin wrapper over node's http/https libraries

The idea being that if you want to support "typical" control-plane
REST APIs, you probably want the `JsonClient`, or if you're using some
other serialization (like XML) you'd write your own client that
extends the `StringClient`. If you need streaming support, you'll need
to do some work on top of the `HttpClient`, as `StringClient` and
friends buffer requests/responses.

All clients support retry with exponential backoff for getting a TCP
connection; they do not perform retries on 5xx error codes like
previous versions of the restify client.  You can set `retry` to `false` to
disable this logic altogether.  Also, all clients support a `connectTimeout`
field, which is use *on each retry*.  The default is not to set a
`connectTimeout`, so you end up with the node.js socket defaults.

Here's an example of hitting the
[Joyent CloudAPI](https://api.us-east-1.joyent.com):

    var restify = require('restify');

    // Creates a JSON client
    var client = restify.createJsonClient({
      url: 'https://us-east-1.api.joyent.com'
    });


    client.basicAuth('$login', '$password');
    client.get('/my/machines', function(err, req, res, obj) {
      assert.ifError(err);

      console.log(JSON.stringify(obj, null, 2));
    });

As a short-hand, a client can be initialized with a string-URL rather than
an options object:

    var restify = require('restify');

    var client = restify.createJsonClient('https://us-east-1.api.joyent.com');

Note that all further documentation refers to the "short-hand" form of
methods like `get/put/del` which take a string path.  You can also
pass in an object to any of those methods with extra params (notably
headers):

    var options = {
      path: '/foo/bar',
      headers: {
        'x-foo': 'bar'
      },
      retry: {
        'retries': 0
      },
      agent: false
    };

    client.get(options, function(err, req, res) { .. });

If you need to interpose additional headers in the request before it is sent on
to the server, you can provide a synchronous callback function as the
`signRequest` option when creating a client.  This is particularly useful with
[node-http-signature](https://github.com/joyent/node-http-signature), which
needs to attach a cryptographic signature of selected outgoing headers.  If
provided, this callback will be invoked with a single parameter: the outgoing
`http.ClientRequest` object.

### JsonClient

The JSON Client is the highest-level client bundled with restify; it
exports a set of methods that map directly to HTTP verbs.  All
callbacks look like `function(err, req, res, [obj])`, where `obj` is
optional, depending on if content was returned. HTTP status codes are
not interpreted, so if the server returned 4xx or something with a
JSON payload, `obj` will be the JSON payload.  `err` however will be
set if the server returned a status code >= 400 (it will be one of the
restify HTTP errors).  If `obj` looks like a `RestError`:

    {
      "code": "FooError",
      "message": "some foo happened"
    }

then `err` gets "upconverted" into a `RestError` for you.  Otherwise
it will be an `HttpError`.

#### createJsonClient(options)

    var client = restify.createJsonClient({
      url: 'https://api.us-east-1.joyent.com',
      version: '*'
    });

### API Options:

|Name  | Type   | Description |
| :--- | :----: | :---- |
|accept|String|Accept header to send|
|audit|Boolean|Enable Audit logging|
|auditor|Function|Function for Audit logging|
|connectTimeout|Number|Amount of time to wait for a socket|
|requestTimeout|Number|Amount of time to wait for the request to finish|
|dtrace|Object|node-dtrace-provider handle|
|gzip|Object|Will compress data when sent using `content-encoding: gzip`|
|headers|Object|HTTP headers to set in all requests|
|log|Object|[bunyan](https://github.com/trentm/node-bunyan) instance|
|retry|Object|options to provide to node-retry;"false" disables retry; defaults to 4 retries|
|signRequest|Function|synchronous callback for interposing headers before request is sent|
|url|String|Fully-qualified URL to connect to|
|userAgent|String|user-agent string to use; restify inserts one, but you can override it|
|version|String|semver string to set the accept-version|
|followRedirects|Boolean|Follow redirects from server|
|maxRedirects|Number|Maximum number of redirects to follow|

#### get(path, callback)

Performs an HTTP get; if no payload was returned, `obj` defaults to
`{}` for you (so you don't get a bunch of null pointer errors).

    client.get('/foo/bar', function(err, req, res, obj) {
      assert.ifError(err);
      console.log('%j', obj);
    });

#### head(path, callback)

Just like `get`, but without `obj`:

    client.head('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

#### post(path, object, callback)

Takes a complete object to serialize and send to the server.

    client.post('/foo', { hello: 'world' }, function(err, req, res, obj) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%j', obj);
    });

#### put(path, object, callback)

Just like `post`:

    client.put('/foo', { hello: 'world' }, function(err, req, res, obj) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%j', obj);
    });

#### del(path, callback)

`del` doesn't take content, since you know, it should't:

    client.del('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

### StringClient

`StringClient` is what `JsonClient` is built on, and provides a base
for you to write other buffering/parsing clients (like say an XML
client). If you need to talk to some "raw" HTTP server, then
`StringClient` is what you want, as it by default will provide you
with content uploads in `application/x-www-form-url-encoded` and
downloads as `text/plain`.  To extend a `StringClient`, take a look at
the source for `JsonClient`. Effectively, you extend it, and set the
appropriate options in the constructor and implement a `write` (for
put/post) and `parse` method (for all HTTP bodies), and that's it.

#### createStringClient(options)

    var client = restify.createStringClient({
      url: 'https://example.com'
    })

#### get(path, callback)

Performs an HTTP get; if no payload was returned, `data` defaults to
`''` for you (so you don't get a bunch of null pointer errors).

    client.get('/foo/bar', function(err, req, res, data) {
      assert.ifError(err);
      console.log('%s', data);
    });

#### head(path, callback)

Just like `get`, but without `data`:

    client.head('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

#### post(path, object, callback)

Takes a complete object to serialize and send to the server.

    client.post('/foo', { hello: 'world' }, function(err, req, res, data) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%s', data);
    });

#### put(path, object, callback)

Just like `post`:

    client.put('/foo', { hello: 'world' }, function(err, req, res, data) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%s', data);
    });

#### del(path, callback)

`del` doesn't take content, since you know, it should't:

    client.del('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

### HttpClient

`HttpClient` is the lowest-level client shipped in restify, and is
basically just some sugar over the top of node's http/https modules
(with HTTP methods like the other clients).  It is useful if you want
to stream with restify.  Note that the event below is unfortunately
named `result` and not `response` (because
[Event 'response'](http://nodejs.org/docs/latest/api/all.html#event_response_)
is already used).

    client = restify.createClient({
      url: 'http://127.0.0.1'
    });

    client.get('/str/mcavage', function(err, req) {
      assert.ifError(err); // connection error

      req.on('result', function(err, res) {
        assert.ifError(err); // HTTP status code >= 400

        res.body = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          res.body += chunk;
        });

        res.on('end', function() {
          console.log(res.body);
        });
      });
    });

Or a write:

    client.post(opts, function(err, req) {
      assert.ifError(connectErr);

      req.on('result', function(err, res) {
        assert.ifError(err);
        res.body = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          res.body += chunk;
        });

        res.on('end', function() {
          console.log(res.body);
        });
      });

      req.write('hello world');
      req.end();
    });

Note that get/head/del all call `req.end()` for you, so you can't
write data over those. Otherwise, all the same methods exist as
`JsonClient/StringClient`.

One wishing to extend the `HttpClient` should look at the internals
and note that `read` and `write` probably need to be overridden.

#### Proxy

There are several options for enabling a proxy for the
http client. The following options are available to set a proxy url:

    // Set the proxy option in the client configuration
    restify.createClient({
        proxy: 'http://127.0.0.1'
    });

From environment variables:

    $ export HTTPS_PROXY = 'https://127.0.0.1'
    $ export HTTP_PROXY = 'http://127.0.0.1'

There is an option to disable the use of a proxy on a url basis or for
all urls. This can be enabled by setting an environment variable.

Don't proxy requests to any urls

    $ export NO_PROXY='*'

Don't proxy requests to localhost

    $ export NO_PROXY='127.0.0.1'

Don't proxy requests to localhost on port 8000

    $ export NO_PROXY='localhost:8000'

Don't proxy requests to multiple IPs

    $ export NO_PROXY='127.0.0.1, 8.8.8.8'

**Note**: The url being requested must match the full hostname in
the proxy configuration or NO_PROXY environment variable. DNS
lookups are not performed to determine the IP address of a hostname.

#### basicAuth(username, password)

Since it hasn't been mentioned yet, this convenience method (available
on all clients), just sets the `Authorization` header for all HTTP requests:

    client.basicAuth('mark', 'mysupersecretpassword');

#### Upgrades

If you successfully negotiate an Upgrade with the HTTP server, an
`upgradeResult` event will be emitted with the arguments `err`, `res`, `socket`
and `head`.  You can use this functionality to establish a WebSockets
connection with a server.  For example, using the
[watershed](https://github.com/jclulow/node-watershed) library:

    var ws = new Watershed();
    var wskey = ws.generateKey();
    var options = {
      path: '/websockets/attach',
      headers: {
        connection: 'upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': wskey,
      }
    };
    client.get(options, function(err, res, socket, head) {
      res.once('upgradeResult', function(err2, res2, socket2, head2) {
        var shed = ws.connect(res2, socket2, head2, wskey);
        shed.on('text', function(msg) {
          console.log('message from server: ' + msg);
          shed.end();
        });
        shed.send('greetings program');
      });
    });

## Tracing with .child()

This module allows the caller to create a "child" object of any of JsonClient,
StringClient or HttpClient. To create a `child` object one does:

    childClient = client.child(options);

and uses `childClient` in place of `client`. The options supported are:

|Name  | Type   | Description |
| :--- | :----: | :---- |
|afterSync|Function|Function for tracing (run after every request, after the client has received the response)|
|beforeSync|Function|Function for tracing (run before every request)|

where these hook functions (if passed) will be called before and/or after
every client request with this child client. These are useful for integrating
with a tracing framework such as [OpenTracing](http://opentracing.io/), as they
allow passing in a closure such that all outgoing requests for a given trace can
be tagged with the appropriate headers.

If passed, the value of the `beforeSync` parameter should be a function with the
following prototype:

    function beforeSync(opts) {

where `opts` is an object containing the options for the request. Some things
you might want to do in this beforeSync function include:

 * writing a trace log message indicating that you're making a request
 * modifying opts.headers to include additional headers in the outbound request

If passed, the value of the `afterSync` parameter should be a function with the
following prototype:

    function afterSync(err, req, res) {

which takes an error object (if the request failed), and the
[req](http://restify.com/#request-api) and
[res](http://restify.com/#response-api) objects as defined in the restify
documentation. The `afterSync` caller is most useful for logging the fact that a
request completed and indicating errors or response details to a tracing
system.

A full example might be:

    var clients = require('restify-clients');

    var client = clients.createJsonClient({url: 'http://127.0.0.1:8080'});

    var childClient1 = client.child({
        beforeSync: function (opts) {
            opts.headers['client-number'] = 1;
        }, afterSync: function (err, req, res) {
            console.error('code: %d', res.statusCode);
        }
    });

    var childClient2 = client.child({
        beforeSync: function (opts) {
            opts.headers['client-number'] = 2;
        }, afterSync: function (err, req, res) {
            console.error('code: %d', res.statusCode);
        }
    });

    // makes a `GET /hello` request with `client-number: 1` header
    childClient1.get('/hello', function(err, req, res, obj) {
        console.log('%j', obj);
    });

    // makes a `GET /hello` request with `client-number: 2` header
    childClient2.get('/hello', function(err, req, res, obj) {
        console.log('%j', obj);
    });


where the two clients will have the same base parameters but will include
different 'client-number' headers in their requests and:

    code: <HTTP status code>

will be written to stderr as each request completes.

The intention here is that you can use this to create a new client that wraps
some additional information. Especially when you'd like a client to always add
headers specific to that client. Another example using a restify server:

    var clients = require('restify-clients');
    var restify = require('restify');

    var exampleClient = clients.createStringClient({url: 'http://0.0.0.0:8080'});
    var server = restify.createServer({name: 'ExampleApp'});

    server.use(function (req, res, next) {
        // Add req.exampleClient to every req object so that handlers can use
        // that as their client and not have to remember to add the request-id
        // header themselves.
        req.exampleClient = exampleClient.child({
            beforeSync: function (opts) {
                opts.headers['request-id'] = req.getId()
            }
        });
        next();
    });

    server.get({
        name: 'GetHello',
        path: '/hello'
    }, function (req, res, next) {
        var client = req.exampleClient;

        // This request will have the 'request-id: ...' header added which
        // matches the *inbound* request we're handling, because the
        // req.exampleClient was created here with a beforeSync() function that
        // adds that to our request for us without modification to this client
        // call.
        client.get('/example', function (err, _req, _res, body) {
            // ... handle results
        });

        next();
    });

    server.listen(function () {
        console.log('listening at %s:%d', server.address().address,
            server.address().port);
    });

This shows a restify server where any call to `/hello` results in a call to
http://0.0.0.0:8080/example with a `request-id:` header added that matches the
original request this handler is part of.

### NOTES

 * The beforeSync() and afterSync() functions are *sychronous*.

 * It's not possible to call .child() on a client that's already a child.
   Doing so will throw an assertion indicating that grandchildren are not
   supported.

 * Child connections will share the same agent and connection pool as the
   parent object they were .child()ed from. This means only the parent should
   call .close().


## Contributing

Add unit tests for any new or changed functionality. Ensure that lint and style


## Contributing

Add unit tests for any new or changed functionality. Ensure that lint and style
checks pass.

To start contributing, install the git pre-push hooks:

```sh
make githooks
```

Before committing, run the prepush hook:

```sh
make prepush
```

If you have style errors, you can auto fix whitespace issues by running:

```sh
make codestyle-fix
```

## License

Copyright (c) 2015 Alex Liu

Licensed under the MIT license.
