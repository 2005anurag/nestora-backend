// server.js
// Minimal Express backend for Nestora Properties subscription payments.
//
// Endpoints:
//   POST /api/create-order          -> creates a Razorpay order
//   POST /api/verify-payment        -> verifies payment signature, activates subscription
//   GET  /api/subscription/:userId  -> returns a user's current subscription status
//
// Run:
//   1. cp .env.example .env   (then fill in your real Razorpay keys)
//   2. npm install
//   3. npm start
//
// This is a STARTER. See the "Production checklist" at the bottom of this
// file and in README.md before going live.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const store = require("./store");

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error(
    "Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Copy .env.example to .env and fill in your keys."
  );
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Plan catalogue — keep this on the server so the frontend can never
// tamper with the price by editing client-side JS.
const PLANS = {
  Rent: { amountPaise: 500 * 100, label: "Rent Access Plan" },
  Sale: { amountPaise: 1999 * 100, label: "Buyer Access Plan" },
};

// ---------------------------------------------------------------------------
// POST /api/create-order
// body: { plan: "Rent" | "Sale", userId: string }
// ---------------------------------------------------------------------------
app.post("/api/create-order", async (req, res) => {
  try {
    const { plan, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: "Invalid plan. Must be 'Rent' or 'Sale'." });
    }

    const order = await razorpay.orders.create({
      amount: planConfig.amountPaise,
      currency: "INR",
      receipt: `nestora_${plan}_${Date.now()}`,
      notes: { plan, userId },
    });

    store.saveOrder(order.id, { plan, userId, amount: planConfig.amountPaise, status: "created" });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // safe to expose — this is the public key
      planLabel: planConfig.label,
    });
  } catch (err) {
    console.error("create-order error:", err);
    res.status(500).json({ error: "Could not create order" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/verify-payment
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// This is the step that actually matters for security: we recompute the
// signature server-side using our secret key and compare it to what
// Razorpay sent back. Never trust a "payment succeeded" message that only
// came from the frontend.
// ---------------------------------------------------------------------------
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    const order = store.getOrder(razorpay_order_id);
    if (!order) {
      return res.status(400).json({ error: "Unknown order" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Signature verified — payment is genuine. Now activate the subscription.
    const subscriptions = store.activateSubscription(order.userId, order.plan, 30);

    res.json({ success: true, subscriptions });
  } catch (err) {
    console.error("verify-payment error:", err);
    res.status(500).json({ error: "Could not verify payment" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/subscription/:userId
// ---------------------------------------------------------------------------
app.get("/api/subscription/:userId", (req, res) => {
  const subscriptions = store.getSubscriptions(req.params.userId);
  res.json({ subscriptions });
});

app.get("/", (req, res) => {
  res.send("Nestora payments backend is running.");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Nestora payments backend listening on port ${PORT}`);
});

// ---------------------------------------------------------------------------
// PRODUCTION CHECKLIST before going live:
// 1. Replace store.js (JSON file) with a real database (Postgres/MongoDB).
// 2. Add real user authentication — userId here must come from a verified
//    login session, not something the frontend can freely set.
// 3. Use Razorpay LIVE keys (rzp_live_...) only after KYC is approved.
// 4. Set up a Razorpay webhook (Dashboard > Webhooks) pointing at an
//    endpoint here, as a backup in case the browser closes before
//    /api/verify-payment is called after a successful payment.
// 5. Add rate limiting (e.g. express-rate-limit) on these endpoints.
// 6. Serve this over HTTPS only (most hosts like Render/Railway do this
//    automatically).
// ---------------------------------------------------------------------------
