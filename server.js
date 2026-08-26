// Minimal static file server + proxy for RM's sb-open API (no CORS support there).
// Also signs requests (X-Signature) with a client-supplied RSA private key,
// same algorithm as RM's Postman pre-request script — but done server-side
// with Node's built-in crypto instead of loading jsrsasign from a CDN.
// No dependencies — run with: node server.js
var http = require('http');
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 8124;

var PROXY_ROUTES = {
  '/api/token': { host: 'sb-oauth.revenuemonster.my', path: '/v1/token', authType: 'basic', method: 'POST', hasBody: true },
  '/api/order': { host: 'sb-open.revenuemonster.my', path: '/v3/payment/online', authType: 'bearer', method: 'POST', hasBody: true },
  '/api/order-checkout': { host: 'sb-open.revenuemonster.my', path: '/v3/payment/online/checkout', authType: 'bearer', method: 'POST', hasBody: true },
  '/api/stores': { host: 'sb-open.revenuemonster.my', path: '/v3/stores', authType: 'bearer', method: 'GET', hasBody: false }
};

function sendJsonError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: message } }));
}

function generateNonce(len) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var out = '';
  for (var i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).sort().reduce(function (acc, k) {
      acc[k] = sortDeep(value[k]);
      return acc;
    }, {});
  }
  return value;
}

function canonicalDataB64(body) {
  if (body === undefined || body === null || Object.keys(body).length === 0) {
    return '';
  }
  var compact = JSON.stringify(sortDeep(body))
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return Buffer.from(compact, 'utf8').toString('base64');
}

function signRequest(privateKeyPem, method, requestUrl, body) {
  var timestamp = String(Math.floor(Date.now() / 1000));
  var nonceStr = generateNonce(32);
  var dataB64 = canonicalDataB64(body);

  var parts = [];
  if (dataB64) parts.push('data=' + dataB64);
  parts.push('method=' + method.toLowerCase());
  parts.push('nonceStr=' + nonceStr);
  parts.push('requestUrl=' + requestUrl);
  parts.push('signType=sha256');
  parts.push('timestamp=' + timestamp);
  var signBase = parts.join('&');

  var signatureB64 = crypto.createSign('RSA-SHA256').update(signBase, 'utf8').sign(privateKeyPem, 'base64');

  return {
    nonceStr: nonceStr,
    timestamp: timestamp,
    signature: 'sha256 ' + signatureB64
  };
}

function proxyToRevenueMonster(req, res, route) {
  var chunks = [];
  req.on('data', function (chunk) { chunks.push(chunk); });
  req.on('end', function () {
    var envelope;
    try {
      envelope = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (e) {
      sendJsonError(res, 400, 'Invalid JSON from client: ' + e.message);
      return;
    }

    var privateKey = envelope.privateKey || '';
    var body = envelope.body || {};

    var authHeader;
    if (route.authType === 'basic') {
      var clientId = envelope.clientId || '';
      var clientSecret = envelope.clientSecret || '';
      if (!clientId || !clientSecret) {
        sendJsonError(res, 400, 'Missing clientId or clientSecret.');
        return;
      }
      authHeader = 'Basic ' + Buffer.from(clientId + ':' + clientSecret, 'utf8').toString('base64');
    } else {
      var token = envelope.token || '';
      if (!token) {
        sendJsonError(res, 400, 'Missing token.');
        return;
      }
      authHeader = 'Bearer ' + token;
    }

    if (!privateKey) {
      sendJsonError(res, 400, 'Missing privateKey.');
      return;
    }

    var upstreamMethod = route.method || 'POST';
    var requestUrl = 'https://' + route.host + route.path;
    var signed;
    try {
      signed = signRequest(privateKey, upstreamMethod, requestUrl, route.hasBody ? body : {});
    } catch (e) {
      sendJsonError(res, 400, 'Failed to sign request — check the private key PEM: ' + e.message);
      return;
    }

    var bodyBuffer = route.hasBody ? Buffer.from(JSON.stringify(body), 'utf8') : null;

    var upstreamHeaders = {
      'Authorization': authHeader,
      'X-Signature': signed.signature,
      'X-Nonce-Str': signed.nonceStr,
      'X-Timestamp': signed.timestamp
    };
    if (bodyBuffer) {
      upstreamHeaders['Content-Type'] = 'application/json';
      upstreamHeaders['Content-Length'] = bodyBuffer.length;
    }

    var upstreamReq = https.request({
      host: route.host,
      path: route.path,
      method: upstreamMethod,
      headers: upstreamHeaders
    }, function (upstreamRes) {
      res.writeHead(upstreamRes.statusCode, { 'Content-Type': 'application/json' });
      upstreamRes.pipe(res);
    });
    upstreamReq.on('error', function (err) {
      sendJsonError(res, 502, 'Proxy error: ' + err.message);
    });
    upstreamReq.end(bodyBuffer || undefined);
  });
}

function serveStatic(req, res) {
  var filePath = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
  var fullPath = path.join(__dirname, filePath);
  fs.readFile(fullPath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    var ext = path.extname(fullPath);
    var contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

http.createServer(function (req, res) {
  if (req.method === 'POST' && PROXY_ROUTES[req.url]) {
    proxyToRevenueMonster(req, res, PROXY_ROUTES[req.url]);
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}).listen(PORT, function () {
  console.log('Server running at http://localhost:' + PORT + '/');
});
