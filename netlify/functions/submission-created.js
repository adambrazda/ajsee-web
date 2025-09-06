// netlify/functions/submission-created.js
// Hook spouštěný po vytvoření jakéhokoli Netlify Form submission.
// My zpracujeme POUZE form "site-comments" a ověříme hCaptcha/reCAPTCHA.
// Pokud verifikace selže nebo chybí token, submission označíme jako SPAM.

export async function handler(event) {
  try {
    // 1) Parsuj payload
    const body = JSON.parse(event.body || '{}');
    const payload = body && body.payload ? body.payload : null;
    if (!payload) return ok('No payload');

    const formName = payload.form_name || payload.formName || '';
    if (formName !== 'site-comments') return ok(`Ignored form: ${formName}`);

    const submissionId = payload.id || payload.submission_id || null;
    const data = payload.data || {};
    const ip = (payload.remote_ip || payload.ip) || ''; // může/nebude

    // 2) Tokeny z formuláře
    const hToken = data['h-captcha-response'] || data['hcaptcha_response'] || '';
    const gToken = data['g-recaptcha-response'] || data['g-recaptcha'] || '';

    // 3) Env secrets
    const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '';
    const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';
    const TOKEN = process.env.NETLIFY_API_TOKEN || '';

    if (!TOKEN) return ok('NETLIFY_API_TOKEN not set – cannot mark spam on failure');

    // 4) Ověření (priorita: hCaptcha → reCAPTCHA)
    let verified = false;

    if (HCAPTCHA_SECRET && hToken) {
      verified = await verifyHCaptcha(HCAPTCHA_SECRET, hToken, ip);
    } else if (RECAPTCHA_SECRET && gToken) {
      verified = await verifyRecaptcha(RECAPTCHA_SECRET, gToken, ip);
    } else {
      // Nemáme token nebo secret → považuj za neověřené.
      verified = false;
    }

    // 5) Rozhodnutí: pokud NEověřeno → označ SPAM
    if (!verified && submissionId) {
      await markSpam(submissionId, TOKEN);
      return ok('Marked as spam (captcha failed or missing)');
    }

    return ok('Captcha verified (or gracefully skipped)');
  } catch (e) {
    // nikomu “nepolož” hook – vrať 200 a loguj
    return ok('Hook error: ' + e.message);
  }
}

// ---- helpers -------------------------------------------------------------

async function verifyHCaptcha(secret, token, remoteip) {
  try {
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteip ? { remoteip } : {})
      })
    });
    const json = await res.json();
    // json.success === true → ověřeno
    return !!json.success;
  } catch {
    return false;
  }
}

async function verifyRecaptcha(secret, token, remoteip) {
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteip ? { remoteip } : {})
      })
    });
    const json = await res.json();
    return !!json.success;
  } catch {
    return false;
  }
}

async function markSpam(id, token) {
  // Pozn.: tohle je Netlify Admin API; token musí mít práva k Forms
  await fetch(`https://api.netlify.com/api/v1/submissions/${id}/spam`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
}

function ok(message) {
  // Netlify hooky stačí 200; message uvidíš v function logs
  return { statusCode: 200, body: message };
}
