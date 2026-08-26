var proxy = require('../lib/proxy');

// POST /api/token — exchanges Client ID/Secret for a Bearer access token.
module.exports = function handler(req, res) {
  proxy(req, res, {
    host: 'sb-oauth.revenuemonster.my',
    path: '/v1/token',
    authType: 'basic',
    method: 'POST',
    hasBody: true
  });
};
