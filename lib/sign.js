// Shared RM request-signing helpers, used by every function in /api.
// Same algorithm as server.js's local proxy — kept in sync deliberately,
// since this is what actually runs once deployed (e.g. on Vercel).
var crypto = require('crypto');

// Random alphanumeric nonce for X-Nonce-Str.
function generateNonce(len) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var out = '';
  for (var i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// Recursively sorts object keys so JSON serialization is deterministic.
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

// Builds the base64 `data` param RM expects: sorted, escaped, compact JSON.
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

// Computes X-Signature/X-Nonce-Str/X-Timestamp for a request via RSA-SHA256.
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

// Sends a { error: { message } } JSON response with the given status.
function sendJsonError(res, status, message) {
  res.status(status).json({ error: { message: message } });
}

module.exports = {
  signRequest: signRequest,
  sendJsonError: sendJsonError
};
