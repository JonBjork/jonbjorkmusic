// =============================================================================
// Netlify function: the gate for /picking-warmup
//
// The app shell on the site is public and empty. The routine itself only ever
// leaves this function, and only for a license key Lemon Squeezy says is good.
// Nothing about the exercises is in the page source.
//
// Everyone comes through the same door. Buyers pay; members of The Practice
// Room and Practice Room Pro check out with a 100% code, which issues them a
// real key the same way. Same as the Looper.
//
// SECURITY: this uses ONLY the public license endpoints, which authenticate
// with the user's own key. No store API token is used and none is needed.
//
// Setup (one time), Netlify -> Site configuration -> Environment variables:
//   PICKING_WARMUP_PRODUCT_ID   the Lemon Squeezy product id for this product.
//   Without it, ANY key from Jon's store unlocks this, including a $5 Looper
//   key. Set it as soon as the product exists.
// =============================================================================

const LS_API = "https://api.lemonsqueezy.com/v1/licenses";

const { buildRoutine, ROUTINE_META } = require("./picking-warmup-routine.js");

async function ls(path, params) {
  const res = await fetch(`${LS_API}/${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  return { httpStatus: res.status, data };
}

function friendlyError(data, httpStatus) {
  const e = (data && data.error) || "";
  if (/activation limit|reached the.*limit|maximum.*activations/i.test(e))
    return "That key is already active on the maximum number of devices. Deactivate one and try again.";
  if (/not found|invalid/i.test(e) || httpStatus === 404)
    return "That key wasn't recognised. Check for a stray space at either end.";
  if (/expired/i.test(e)) return "That key has expired.";
  if (/disabled/i.test(e)) return "That key has been disabled.";
  return e || "That key could not be checked right now. Try again in a moment.";
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

// Is this key for THIS product, rather than another one in the same store?
function wrongProduct(meta) {
  const want = process.env.PICKING_WARMUP_PRODUCT_ID;
  if (!want) return false;                 // not configured yet, see the note above
  return String(meta && meta.product_id) !== String(want);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Bad request" }); }

  const key = String(body.key || "").trim();
  const instanceId = String(body.instanceId || "").trim();
  if (!key) return json(400, { error: "Enter your key." });

  // A stored instance revalidates; a fresh key activates and claims a device slot.
  const r = instanceId
    ? await ls("validate", { license_key: key, instance_id: instanceId })
    : await ls("activate", { license_key: key, instance_name: String(body.deviceName || "Browser").slice(0, 60) });

  const d = r.data || {};
  const status = (d.license_key && d.license_key.status) || null;
  const ok = instanceId ? d.valid === true : d.activated === true;

  if (!ok) return json(200, { unlocked: false, error: friendlyError(d, r.httpStatus) });
  if (status && status !== "active")
    return json(200, { unlocked: false, error: `That key is ${status}.` });
  if (wrongProduct(d.meta))
    return json(200, { unlocked: false, error: "That key is for a different product." });

  return json(200, {
    unlocked: true,
    instanceId: instanceId || String((d.instance && d.instance.id) || ""),
    meta: ROUTINE_META,
    exercises: buildRoutine(),
  });
};
