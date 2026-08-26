// Shared handler: signs a request and forwards it to Revenue Monster.
// Each file in /api calls this with its own route config.
var https = require('https');
var sign = require('./sign');

function proxyToRevenueMonster(req, res, route) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed. Use POST.' } });
    return;
  }

  var envelope = req.body || {};
  var privateKey = envelope.privateKey || '';
  var body = envelope.body || {};

  var authHeader;
  if (route.authType === 'basic') {
    var clientId = envelope.clientId || '';
    var clientSecret = envelope.clientSecret || '';
    if (!clientId || !clientSecret) {
      sign.sendJsonError(res, 400, 'Missing clientId or clientSecret.');
      return;
    }
    authHeader = 'Basic ' + Buffer.from(clientId + ':' + clientSecret, 'utf8').toString('base64');
  } else {
    var token = envelope.token || '';
    if (!token) {
      sign.sendJsonError(res, 400, 'Missing token.');
      return;
    }
    authHeader = 'Bearer ' + token;
  }

  if (!privateKey) {
    sign.sendJsonError(res, 400, 'Missing privateKey.');
    return;
  }

  var upstreamMethod = route.method || 'POST';
  var requestUrl = 'https://' + route.host + route.path;
  var signed;
  try {
    signed = sign.signRequest(privateKey, upstreamMethod, requestUrl, route.hasBody ? body : {});
  } catch (e) {
    sign.sendJsonError(res, 400, 'Failed to sign request — check the private key PEM: ' + e.message);
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
    var chunks = [];
    upstreamRes.on('data', function (c) { chunks.push(c); });
    upstreamRes.on('end', function () {
      res.setHeader('Content-Type', 'application/json');
      res.status(upstreamRes.statusCode).send(Buffer.concat(chunks));
    });
  });
  upstreamReq.on('error', function (err) {
    sign.sendJsonError(res, 502, 'Proxy error: ' + err.message);
  });
  upstreamReq.end(bodyBuffer || undefined);
}

module.exports = proxyToRevenueMonster;
