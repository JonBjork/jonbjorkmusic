// =============================================================================
// Netlify event function: runs automatically on EVERY verified form submission.
// (The filename "submission-created" is what wires it to the event.)
//
// What it does:
//   - "ask-jon" submissions WITH the newsletter box ticked
//       -> create/update Kit subscriber + tag "Ask Jon"
//   - "coaching-apply" submissions
//       -> create/update Kit subscriber + tag "Coaching Applicant"
//   - everything else (contact form, ask-jon without consent) -> ignored
//
// Setup (one time): add KIT_API_KEY in Netlify
//   Site configuration -> Environment variables -> Add a variable
//   Key:   KIT_API_KEY
//   Value: create one at https://app.kit.com/account_settings/developer_settings
//
// Kit API v4 docs: https://developers.kit.com/api-reference/overview
// =============================================================================

const KIT_API = 'https://api.kit.com/v4';

// Tag IDs in Jon's Kit account (created 2026-07-10)
const TAGS = {
  ASK_JON: 21033901,
  COACHING_APPLICANT: 21033902,
};

exports.handler = async function (event) {
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) {
    console.warn('KIT_API_KEY not set; skipping Kit sync.');
    return { statusCode: 200, body: 'skipped' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body).payload;
  } catch (e) {
    console.error('Could not parse submission payload:', e);
    return { statusCode: 200, body: 'ignored' };
  }

  const formName = payload.form_name;
  const data = payload.data || {};
  const email = (data.email || '').trim();
  const name = (data.name || '').trim();

  if (!email) return { statusCode: 200, body: 'no email' };

  // Decide what to do per form
  let tagId = null;
  if (formName === 'ask-jon' && data.newsletter === 'yes') {
    tagId = TAGS.ASK_JON;
  } else if (formName === 'coaching-apply') {
    tagId = TAGS.COACHING_APPLICANT;
  }
  if (!tagId) return { statusCode: 200, body: 'no action for this form' };

  const headers = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };

  try {
    // 1) Upsert the subscriber (creates if new, updates first name if existing)
    const subRes = await fetch(`${KIT_API}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email_address: email, first_name: name || undefined }),
    });
    if (!subRes.ok && subRes.status !== 409) {
      const t = await subRes.text();
      throw new Error(`Kit create subscriber failed (${subRes.status}): ${t}`);
    }

    // 2) Tag them by email address
    const tagRes = await fetch(`${KIT_API}/tags/${tagId}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email_address: email }),
    });
    if (!tagRes.ok) {
      const t = await tagRes.text();
      throw new Error(`Kit tag subscriber failed (${tagRes.status}): ${t}`);
    }

    console.log(`Kit sync OK: ${email} tagged ${tagId} (form: ${formName})`);
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    // Log and return 200 so Netlify doesn't retry-spam; the submission itself
    // is already safely stored in Netlify Forms either way.
    console.error('Kit sync error:', err.message);
    return { statusCode: 200, body: 'kit error logged' };
  }
};
