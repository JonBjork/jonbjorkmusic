// =============================================================================
// Netlify function: the workbook PDF, behind the same gate as the routine.
//
// The PDF lives in netlify/assets/, which is bundled into this function by the
// included_files setting in netlify.toml and is NOT published as part of the
// site. So the only way to get it is with a licence key Lemon Squeezy says is
// good, exactly like the exercises.
//
// SECURITY: this uses ONLY the public licence endpoints, which authenticate
// with the user's own key. No store API token is used and none is needed.
// =============================================================================

const fs = require("fs");
const path = require("path");

const LS_API = "https://api.lemonsqueezy.com/v1/licenses";
const FILENAME = "The-Ultimate-Alternate-Picking-Workout-Workbook.pdf";

// Resolved relative to this file, which is where included_files puts it.
const PDF_PATH = path.join(__dirname, "..", "assets", "workbook.pdf");

async function ls(pathname, params) {
  const res = await fetch(`${LS_API}/${pathname}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  return data;
}

function wrongProduct(meta) {
  const want = process.env.PICKING_WORKOUT_PRODUCT_ID;
  if (!want) return false;                 // not configured yet
  return String(meta && meta.product_id) !== String(want);
}

function deny(message) {
  return {
    statusCode: 403,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ error: message }),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return deny("Method not allowed");

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return deny("Bad request"); }

  const key = String(body.key || "").trim();
  const instanceId = String(body.instanceId || "").trim();
  if (!key) return deny("No key.");

  // Validate rather than activate: the app has already claimed a device slot,
  // and downloading the workbook should not burn another one.
  const d = instanceId
    ? await ls("validate", { license_key: key, instance_id: instanceId })
    : await ls("validate", { license_key: key });

  const status = (d.license_key && d.license_key.status) || null;
  if (d.valid !== true) return deny("That key wasn't recognised.");
  if (status && status !== "active") return deny(`That key is ${status}.`);
  if (wrongProduct(d.meta)) return deny("That key is for a different product.");

  let pdf;
  try {
    pdf = fs.readFileSync(PDF_PATH);
  } catch (e) {
    // included_files did not bundle it. Fail loudly rather than serving nothing.
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "The workbook is missing from this deploy." }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${FILENAME}"`,
      "Cache-Control": "no-store",
    },
    body: pdf.toString("base64"),
    isBase64Encoded: true,
  };
};
