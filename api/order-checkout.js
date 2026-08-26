var proxy = require('../lib/proxy');

// POST /api/order-checkout — selects the payment method, returns the checkout code.
module.exports = function handler(req, res) {
  proxy(req, res, {
    host: 'sb-open.revenuemonster.my',
    path: '/v3/payment/online/checkout',
    authType: 'bearer',
    method: 'POST',
    hasBody: true
  });
};
