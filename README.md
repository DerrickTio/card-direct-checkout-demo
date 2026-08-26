# card-direct-checkout-demo

Sandbox test page for Revenue Monster's card checkout + 3DS flow: get a token, create an order, get a checkout code, then run card checkout and open the 3DS challenge.

## Run

Requires **Node.js 14+** (no npm dependencies — uses only the built-in `http`, `https`, `crypto`, `fs`, `path` modules).

```
node server.js
```

Open http://localhost:8123/index.html

`server.js` proxies and signs the token/order/checkout-code calls (RSA-SHA256 `X-Signature`) — those RM endpoints don't support CORS or accept unsigned browser requests. The private key you paste in stays local; it's never sent to Revenue Monster.

## Deploying (so steps 1–3 work from a hosted URL, not just localhost)

GitHub Pages can't run `server.js` — it's static-only, so a page hosted there will 405 on every proxied request. The `/api` folder is a **Vercel** serverless-functions equivalent of `server.js` (same signing logic, same routes), for deploying somewhere that actually runs Node per request:

1. Push this repo to GitHub (already done if you're reading this from there).
2. Go to [vercel.com](https://vercel.com), sign up, and "Import" this GitHub repo — no configuration needed, Vercel auto-detects the `/api` functions and serves `index.html` as-is.
3. Open the `*.vercel.app` URL Vercel gives you. Steps 1–4 all work from there, same as `localhost:8123`.

`server.js` still works for local dev — the two are independent; `/api/*.js` is only used once deployed to Vercel (or another platform that runs the same file layout).

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
