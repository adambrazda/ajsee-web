// netlify/edge-functions/geo-country.js
// Nastaví/aktualizuje cookie "ajsee_cc" (country code) podle Geo IP nebo lang,
// ale jen pro HTML odpovědi a jen když se hodnota změní.

const COOKIE_NAME = "ajsee_cc";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dní

export default async (request, context) => {
  // 1) přečti aktuální cookie (pokud existuje)
  const existing = readCookie(request, COOKIE_NAME); // <— proměnná je opravdu použitá

  // 2) zjisti kandidáta countryCode
  const geoCC = (context.geo?.country?.code || "").toUpperCase();
  const url = new URL(request.url);
  const langParam = (url.searchParams.get("lang") || "").toLowerCase();

  // fallback podle jazyka (když geo chybí)
  const ccFromLang = langToCC(langParam);
  const nextCC = geoCC || ccFromLang || existing || "";

  // 3) pokračuj na origin
  let response = await context.next();

  // 4) nastav cookie jen pro HTML odpovědi a jen když se hodnota mění
  if (nextCC && existing !== nextCC && isHtml(response)) {
    const headers = new Headers(response.headers);
    headers.append(
      "Set-Cookie",
      cookieString(COOKIE_NAME, nextCC, {
        path: "/",
        maxAge: MAX_AGE,
        sameSite: "Lax",
      })
    );
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
};

// -------- helpers --------
function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const idx = p.indexOf("=");
    const k = idx >= 0 ? p.slice(0, idx) : p;
    if (k === name) return decodeURIComponent(idx >= 0 ? p.slice(idx + 1) : "");
  }
  return "";
}

function isHtml(response) {
  const ct = response.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function cookieString(name, value, opts = {}) {
  const { path = "/", maxAge, sameSite = "Lax", secure } = opts;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${maxAge}`);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  // v devu to klidně nech bez Secure; v produkci se hodí:
  if (secure || typeof window === "undefined") parts.push("Secure");
  return parts.join("; ");
}

function langToCC(lang) {
  switch ((lang || "").slice(0, 2)) {
    case "cs":
      return "CZ";
    case "sk":
      return "SK";
    case "de":
      return "DE";
    case "pl":
      return "PL";
    case "hu":
      return "HU";
    case "en":
      return "US"; // neutrální fallback
    default:
      return "";
  }
}
