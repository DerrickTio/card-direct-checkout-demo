var proxy = require('../lib/proxy');

// POST /api/stores — signed as a GET to RM, lists the merchant's stores.
module.exports = function handler(req, res) {
  proxy(req, res, {
    host: 'sb-open.revenuemonster.my',
    path: '/v3/stores',
    authType: 'bearer',
    method: 'GET',
    hasBody: false
  });
};
