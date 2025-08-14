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

    // -------- safe URL parse --------
    const url = new URL(
      event.rawUrl ||
      `http://local/?${new URLSearchParams(event.queryStringParameters || {}).toString()}`
    );

    const uiLocale = (url.searchParams.get('locale') || 'en').toLowerCase();
    const qRaw = (url.searchParams.get('keyword') || '').trim();
    const countryCodeRaw = (url.searchParams.get('countryCode') || '').trim(); // může být CSV
    const size = Math.max(1, Math.min(50, parseInt(url.searchParams.get('size') || '10', 10)));

    if (qRaw.length < 2) {
      return json(200, { cities: [] });
    }

    // ---------- helpers & normalization ----------
    const stripDiacritics = (s) =>
      (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Synonyma (silnější než jen "bez diakritiky")
    const SYNS = {
      prague:     ['praha','prague','prag','praga','prága'],
      vienna:     ['wien','vienna','vídeň','vieden','wiedeń','viedeň','bécs'],
      bratislava: ['bratislava','pressburg','pozsony'],
      budapest:   ['budapest','budapešť','budapeszt','budapesta'],
      munich:     ['münchen','munchen','munich','mnichov'],
      krakow:     ['krakow','kraków','krakov','krakau'],
      warsaw:     ['warsaw','warszawa','warschau','varšava','varsava'],
      ostrava:    ['ostrava','ostrawa','ostrau','osztrava'],
      pilsen:     ['plzeň','plzen','pilsen'],
    };
    const synToKey = new Map(
      Object.entries(SYNS).flatMap(([key, arr]) => arr.map(v => [stripDiacritics(v), key]))
    );

    // Základní město bez částí/okresů
    const collapseToBaseCity = (name) => {
      if (!name) return name;
      let s = String(name).trim();
      s = s.replace(/\s*[-–]\s*.+$/, '');                 // "Praha - Libuš" → "Praha"
      s = s.split(',')[0].trim();                         // "Praha, CZ" → "Praha"
      s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim(); // "Praha 7" → "Praha"
      s = s.replace(/\s+\d+\s*-.+$/i, '').trim();         // "Praha 4-Libuš" → "Praha"
      return s;
    };

    const normCityKey = (name) => {
      const base = collapseToBaseCity(name);
      const n = stripDiacritics(base);
      return synToKey.get(n) || n; // pokud je synonymum, vrať kanonický klíč
    };

    const q = qRaw;
    const qn = stripDiacritics(q);

    // ---------- TM fetch (s podporou fallback locale) ----------
    const tm = async (path, params, { cc = '', locale = 'en' } = {}) => {
      try {
        const u = new URL(`${BASE}${path}`);
        u.searchParams.set('apikey', API_KEY);
        if (locale) u.searchParams.set('locale', locale);
        if (cc) u.searchParams.set('countryCode', cc);
        for (const [k, v] of Object.entries(params || {})) {
          if (v !== undefined && v !== null && `${v}` !== '') u.searchParams.set(k, v);
        }
        const r = await fetch(u.toString(), { headers: { accept: 'application/json' } });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.warn(`[citySuggest] ${path} ${r.status} ${u.toString()}`, t.slice(0, 140));
          return null;
        }
        return r.json();
      } catch (e) {
        console.warn('[citySuggest] fetch failed', e);
        return null;
      }
    };

    // Fallback pořadí locale (Ticketmaster nepokrývá sk/hu konzistentně)
    const LOCALES = Array.from(new Set([
      uiLocale, 'en', 'de', 'cs', 'pl', 'hu'
    ].filter(Boolean)));

    // Country scope – podpora CSV (CZ,SK,PL,HU,DE,AT) nebo prázdné = global
    const CC_LIST = (countryCodeRaw
      ? countryCodeRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : ['']  // prázdný znamená "global"
    );

    const bucket = new Map();
    const add = (name, countryCode, lat, lon, w = 1) => {
      if (!name) return;
      const base = collapseToBaseCity(name);
      const key = `${normCityKey(base)}|${countryCode || ''}`;
      const cur = bucket.get(key) || {
        namePref: base, // zobrazovaný název
        nameAll: new Set([base]),
        countryCode: countryCode || '',
        lat, lon, score: 0
      };
      cur.score += w;
      if (!cur.lat && lat) cur.lat = Number(lat);
      if (!cur.lon && lon) cur.lon = Number(lon);

      // preferuj variantu, která líp odpovídá dotazu (prefix), jinak kratší
      const bestNow = stripDiacritics(cur.namePref);
      const candN = stripDiacritics(base);
      const better =
        (candN.startsWith(qn) && !bestNow.startsWith(qn)) ||
        (base.length < cur.namePref.length && (candN.startsWith(qn) === bestNow.startsWith(qn)));
      if (better) cur.namePref = base;

      cur.nameAll.add(base);
      bucket.set(key, cur);
    };

    // Iterate přes CC × LOCALES dokud nenaplníme košík
    outer:
    for (const cc of CC_LIST) {
      for (const loc of LOCALES) {
        // 1) venues by city
        const vCity = await tm('/venues.json', { city: q, size: Math.min(size * 2, 100) }, { cc, locale: loc });
        for (const v of vCity?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude, v?.location?.longitude, 3);
        }
        if (bucket.size >= size) continue;

        // 2) venues by keyword
        const vKey = await tm('/venues.json', { keyword: q, size: Math.min(size * 5, 200) }, { cc, locale: loc });
        for (const v of vKey?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude, v?.location?.longitude, 1);
        }
        if (bucket.size >= size) continue;

        // 3) fallback z events (někdy venue nenavrací všechna města)
        const evs = await tm('/events.json', { keyword: q, size: Math.min(size * 3, 100) }, { cc, locale: loc });
        for (const e of evs?._embedded?.events ?? []) {
          for (const v of e?._embedded?.venues ?? []) {
            add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
                v?.location?.latitude, v?.location?.longitude, 1);
          }
        }

        if (bucket.size >= size) {
          // máme dost – můžeme ukončit všechny smyčky
          break outer;
        }
      }
    }

    // ---------- Score boost & relevancy ----------
    const itemsRaw = Array.from(bucket.values()).map(x => {
      const ln = stripDiacritics(x.namePref);
      const starts = ln.startsWith(qn);
      const contains = !starts && ln.includes(qn);
      const boost = (starts ? 10 : 0) + (contains ? 5 : 0);
      return { ...x, score: (x.score || 0) + boost, _starts: starts, _contains: contains };
    });

    const relevant = itemsRaw.filter(it => it._starts || it._contains);
    const pool = relevant.length ? relevant : itemsRaw;

    const list = pool
      .sort((a, b) => b.score - a.score || a.namePref.localeCompare(b.namePref))
      .slice(0, size)
      .map(x => ({
        label: x.countryCode ? `${x.namePref}, ${x.countryCode}` : x.namePref,
        value: x.namePref,
        name: x.namePref,
        countryCode: x.countryCode,
        lat: x.lat,
        lon: x.lon,
        score: x.score
      }));

    return json(200, { cities: list });
  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    return json(200, { cities: [] });
  }
};

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
