// store.js
// Minimal file-based persistence so this starter runs with zero extra setup.
// ---------------------------------------------------------------------------
// ⚠️ PRODUCTION NOTE: Replace this with a real database (Postgres, MongoDB,
// etc.) before going live. A JSON file is NOT safe for concurrent writes at
// scale and will not survive most hosting platforms' ephemeral filesystems
// (e.g. it resets on every deploy on platforms like Render/Railway free tier).
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data.json");

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { orders: {}, subscriptions: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch (e) {
    return { orders: {}, subscriptions: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function saveOrder(orderId, details) {
  const db = readDB();
  db.orders[orderId] = details;
  writeDB(db);
}

function getOrder(orderId) {
  const db = readDB();
  return db.orders[orderId];
}

function activateSubscription(userId, plan, days = 30) {
  const db = readDB();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  if (!db.subscriptions[userId]) db.subscriptions[userId] = {};
  db.subscriptions[userId][plan] = expiresAt.toISOString();
  writeDB(db);
  return db.subscriptions[userId];
}

function getSubscriptions(userId) {
  const db = readDB();
  return db.subscriptions[userId] || {};
}

module.exports = { saveOrder, getOrder, activateSubscription, getSubscriptions };
