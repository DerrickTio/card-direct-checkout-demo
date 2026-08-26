var proxy = require('../lib/proxy');

// POST /api/order — creates the order, returns an Order Checkout ID.
module.exports = function handler(req, res) {
  proxy(req, res, {
    host: 'sb-open.revenuemonster.my',
    path: '/v3/payment/online',
    authType: 'bearer',
    method: 'POST',
    hasBody: true
  });
};
