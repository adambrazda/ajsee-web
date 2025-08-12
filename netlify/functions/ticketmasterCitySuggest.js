// netlify/functions/ticketmasterCitySuggest.js
export const handler = async (event) => {
  try {
    const API_KEY =
      process.env.TICKETMASTER_API_KEY ||
      process.env.TM_API_KEY;

    const BASE =
      process.env.TM_BASE_URL ||
      'https://app.ticketmaster.com/discovery/v2';

    if (!API_KEY) {
      return json(500, { error: 'Missing Ticketmaster API key' });
    }

    // Bezpečné parsování query (funguje i v Lambda compat režimu)
    const url = new URL(
      event.rawUrl ||
      `http://local/?${new URLSearchParams(event.queryStringParameters || {}).toString()}`
    );

    const q = (url.searchParams.get('keyword') || '').trim();
    const countryCode = (url.searchParams.get('countryCode') || '').toUpperCase();
    const locale = url.searchParams.get('locale') || 'en';
    const size = Math.max(1, Math.min(50, parseInt(url.searchParams.get('size') || '10', 10)));

    if (q.length < 2) {
      return json(200, { cities: [] });
    }

    // Pomocná funkce na TM fetch (s apikey + společnými parametry)
    const tm = async (path, params) => {
      try {
        const u = new URL(`${BASE}${path}`);
        u.searchParams.set('apikey', API_KEY);
        u.searchParams.set('locale', locale);
        if (countryCode) u.searchParams.set('countryCode', countryCode);
        for (const [k, v] of Object.entries(params || {})) {
          if (v !== undefined && v !== null && `${v}` !== '') u.searchParams.set(k, v);
        }
        console.log('[citySuggest] →', u.toString());
        const r = await fetch(u.toString(), { headers: { accept: 'application/json' } });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.warn(`[citySuggest] ${path} ${r.status}`, t.slice(0, 180));
          return null;
        }
        return r.json();
      } catch (e) {
        console.warn('[citySuggest] fetch failed', e);
        return null;
      }
    };

    // Unikátní koš na města
    const bucket = new Map();
    const add = (name, cc, lat, lon, weight = 1) => {
      if (!name) return;
      const key = `${name}|${cc || ''}`;
      const cur = bucket.get(key) || { name, countryCode: cc || '', lat, lon, score: 0 };
      cur.score += weight;
      if (!cur.lat && lat) cur.lat = lat;
      if (!cur.lon && lon) cur.lon = lon;
      bucket.set(key, cur);
    };

    // 1) venues podle 'city' (větší váha)
    const vCity = await tm('/venues.json', { city: q, size: Math.min(size * 2, 100) });
    for (const v of vCity?._embedded?.venues ?? []) {
      add(v?.city?.name, v?.country?.countryCode || v?.country?.name, v?.location?.latitude, v?.location?.longitude, 3);
    }

    // 2) venues podle 'keyword' (fallback)
    if (bucket.size < size) {
      const vKey = await tm('/venues.json', { keyword: q, size: Math.min(size * 5, 200) });
      for (const v of vKey?._embedded?.venues ?? []) {
        add(v?.city?.name, v?.country?.countryCode || v?.country?.name, v?.location?.latitude, v?.location?.longitude, 1);
      }
    }

    // 3) events → vytáhnout města z embedded venues (když je toho málo)
    if (bucket.size < size) {
      const evs = await tm('/events.json', { keyword: q, size: Math.min(size * 3, 100) });
      for (const e of evs?._embedded?.events ?? []) {
        for (const v of e?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name, v?.location?.latitude, v?.location?.longitude, 1);
        }
      }
    }

    // --- Postprocess: preferuj prefix/substring shodu s dotazem ---
    const norm = (s) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // diakritika pryč

    const qn = norm(q);

    let itemsRaw = Array.from(bucket.values()).filter(x => x.name);

    // přidej boost podle relevance
    itemsRaw = itemsRaw.map(x => {
      const ln = norm(x.name);
      const starts = ln.startsWith(qn);
      const contains = !starts && ln.includes(qn);
      const boost = (starts ? 10 : 0) + (contains ? 5 : 0); // silná preference prefixu
      return { ...x, score: (x.score || 0) + boost, _starts: starts, _contains: contains };
    });

    // jestli existují relevantní (starts/contains), ostatní odhoď
    const relevant = itemsRaw.filter(it => it._starts || it._contains);
    const pool = relevant.length ? relevant : itemsRaw;

    const list = pool
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, size)
      .map(x => ({
        label: x.countryCode ? `${x.name}, ${x.countryCode}` : x.name,
        value: x.name,
        name: x.name,            // pro jistotu, kdyby FE četl "name"
        countryCode: x.countryCode,
        lat: x.lat,
        lon: x.lon,
        score: x.score
      }));

    console.log('[citySuggest] return', list.length, 'items');
    return json(200, { cities: list });
  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    // Vždy vrať platnou odpověď – už žádné "statusCode: undefined"
    return json(200, { cities: [] });
  }
};

// Jednotný způsob odpovědi pro Netlify Functions (Lambda compat)
function json(status, data) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(data)
  };
}
