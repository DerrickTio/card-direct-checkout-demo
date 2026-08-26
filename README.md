# card-direct-checkout-demo

Sandbox test page for Revenue Monster's card checkout + 3DS flow: get a token, create an order, get a checkout code, then run card checkout and open the 3DS challenge.

## Run

Requires **Node.js 14+** (no npm dependencies — uses only the built-in `http`, `https`, `crypto`, `fs`, `path` modules).

```
node server.js
```

Open http://localhost:8123/index.html

`server.js` proxies and signs the token/order/checkout-code calls (RSA-SHA256 `X-Signature`) — those RM endpoints don't support CORS or accept unsigned browser requests. The private key you paste in stays local; it's never sent to Revenue Monster.

## You'll need

- **Client ID** + **Client Secret** — sandbox API credentials, used as Basic auth for step 1
- **Private Key (PEM)** — matches the public key uploaded to the RM sandbox portal for that Client ID; signs steps 1–3

Card details in step 4 are pre-filled with a sandbox test card.

If Client ID / Secret / Key don't all belong to the same credential set, step 1 still returns a token, but steps 2–3 fail with `INVALID_REQUEST_SIGNATURE`.

## Steps

1. Get Access Token → fills Bearer Token
2. Create Order → fills Order Checkout ID
3. Get Checkout Code (method hardcoded to `MASTERCARD_MY`) → fills Code
4. Card Checkout → opens the 3DS challenge iframe

Endpoint URLs and full request/response detail are shown live on the page itself.
