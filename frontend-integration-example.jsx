/**
 * frontend-integration-example.jsx
 * ---------------------------------------------------------------------------
 * This shows how PaywallModal in the Nestora app would call the real backend
 * instead of the simulated `setTimeout` payment used in the demo artifact.
 *
 * Steps this performs:
 *   1. Load the Razorpay checkout script
 *   2. Ask the backend to create an order (amount decided server-side)
 *   3. Open Razorpay's checkout widget
 *   4. On success, send the payment details back to the backend for
 *      signature verification
 *   5. Only mark the user as subscribed once the backend confirms success
 *
 * Replace BACKEND_URL with your deployed backend's URL.
 */

const BACKEND_URL = "https://your-backend-domain.com"; // <-- change this

// Dynamically load Razorpay's checkout.js once
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Call this instead of the simulated handlePay() in PaywallModal.
 * `userId` should come from your real auth system (not made up client-side).
 */
async function payAndSubscribe({ plan, userId, onSuccess, onError }) {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    onError("Could not load payment SDK. Check your connection.");
    return;
  }

  // 1. Ask backend to create the order (price is decided server-side —
  //    never trust a price sent from the frontend).
  let orderData;
  try {
    const res = await fetch(`${BACKEND_URL}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, userId }),
    });
    orderData = await res.json();
    if (!res.ok) throw new Error(orderData.error || "Order creation failed");
  } catch (err) {
    onError(err.message);
    return;
  }

  // 2. Open Razorpay checkout
  const options = {
    key: orderData.keyId,
    amount: orderData.amount,
    currency: orderData.currency,
    name: "Nestora Properties",
    description: orderData.planLabel,
    order_id: orderData.orderId,
    handler: async function (response) {
      // 3. Send payment details back to backend for verification
      try {
        const verifyRes = await fetch(`${BACKEND_URL}/api/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || "Payment verification failed");
        }
        // 4. Only now is the subscription actually active
        onSuccess(verifyData.subscriptions);
      } catch (err) {
        onError(err.message);
      }
    },
    theme: { color: "#BD6247" }, // matches Nestora's terracotta accent
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", function (response) {
    onError(response.error?.description || "Payment failed");
  });
  rzp.open();
}

/**
 * Example usage inside PaywallModal's handlePay():
 *
 * const handlePay = () => {
 *   setPaying(true);
 *   payAndSubscribe({
 *     plan: property.purpose,      // "Rent" or "Sale"
 *     userId: currentUser.id,      // from your real auth/session
 *     onSuccess: async (subscriptions) => {
 *       setPaying(false);
 *       await onSubscribed(property.purpose); // update local UI state
 *     },
 *     onError: (message) => {
 *       setPaying(false);
 *       alert("Payment failed: " + message);
 *     },
 *   });
 * };
 */

export { payAndSubscribe };
