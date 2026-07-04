# Nestora Payments Backend (Starter)

Minimal Express + Razorpay backend that lets the Nestora Properties app charge
real subscription payments for buyer/tenant access (Rent ₹500/month, Sale
₹1999/month), instead of the simulated payment in the preview artifact.

## Why you need this

The React app on its own **cannot safely process real payments**. Prices and
"payment success" checks done only in the browser can be faked by anyone
with dev tools open. This backend does the two things that must happen on a
server:

1. **Creates the order** — the price comes from server-side config, not
   anything the browser sends.
2. **Verifies the payment signature** — using your Razorpay secret key,
   which must never be shipped to the frontend.

## Setup

```bash
cd nestora-backend
cp .env.example .env
# edit .env and paste your real Razorpay Key ID + Key Secret
# (get test keys free at https://dashboard.razorpay.com/app/keys)
npm install
npm start
```

Server runs on `http://localhost:4000` by default.

## Endpoints

| Method | Path                        | Purpose                                   |
|--------|-----------------------------|--------------------------------------------|
| POST   | `/api/create-order`         | Creates a Razorpay order for a plan       |
| POST   | `/api/verify-payment`       | Verifies signature, activates subscription |
| GET    | `/api/subscription/:userId` | Returns a user's current plan status      |

## Connecting the frontend

See `frontend-integration-example.jsx` — it shows the full flow:
load Razorpay checkout script → create order → open checkout →
verify payment → mark subscribed.

Swap the simulated `handlePay` function inside the `PaywallModal` component
of the Nestora app for the `payAndSubscribe()` helper shown there.

## Deploying this backend

Any Node-friendly host works. Easiest free/cheap options:

- **Railway** (railway.app) — connect GitHub repo, add env vars, deploy
- **Render** (render.com) — same idea, has a free tier
- **Fly.io** — good if you want more control

After deploying, put the backend's public URL into:
- `ALLOWED_ORIGINS` in your `.env` (your frontend's domain)
- `BACKEND_URL` in `frontend-integration-example.jsx`

## Before going live (important)

- [ ] Swap `store.js` (a JSON file) for a real database — Postgres, MongoDB,
      or similar. The file store here will not survive redeploys on most
      hosts and isn't safe under concurrent writes.
- [ ] Add real user login (email/mobile OTP, etc.) so `userId` is trustworthy
      — right now nothing stops the frontend from sending any `userId`.
- [ ] Switch from Razorpay test keys (`rzp_test_...`) to live keys
      (`rzp_live_...`) only after Razorpay KYC is approved.
- [ ] Add a Razorpay webhook as a safety net in case the browser closes
      before verification completes.
- [ ] Add rate limiting on the API routes.
- [ ] Confirm HTTPS is enforced (most hosts do this by default).
