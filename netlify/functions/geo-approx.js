export async function handler() {
  try {
    // Bez API klíče, free limit: ipapi.co
    const r = await fetch('https://ipapi.co/json/');
    if (!r.ok) return { statusCode: 200, body: '{}' };
    const j = await r.json();
    const lat = Number(j.latitude);
    const lon = Number(j.longitude);
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify({ lat: isFinite(lat) ? lat : null, lon: isFinite(lon) ? lon : null, city: j.city || null, country: j.country || null })
    };
  } catch {
    return { statusCode: 200, body: '{}' };
  }
}
