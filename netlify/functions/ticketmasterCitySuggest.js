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

    const qRaw = (url.searchParams.get('keyword') || '').trim();
    const countryCodeRaw = (url.searchParams.get('countryCode') || '').toUpperCase();
    const locale = url.searchParams.get('locale') || 'en';
    const size = Math.max(1, Math.min(50, parseInt(url.searchParams.get('size') || '10', 10)));

    if (qRaw.length < 2) {
      return json(200, { cities: [] });
    }

    // ---------- Normalizace a pomocníci ----------
    const stripDiacritics = (s) =>
      (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Mapy synonym pro velká města (aby „praha / prague / prag / praga / prága“ splynulo)
    const SYNS = {
      prague: ['praha', 'prague', 'prag', 'praga', 'praga ', 'pr\xa1ga', 'praga', 'prága'],
      vienna: ['wien', 'vienna', 'vieden', 'viedeň', 'vídeň'],
      warsaw: ['warszawa', 'warsaw', 'warschau'],
      budapest: ['budapest', 'budapešť', 'budapesti'],
      munich: ['münchen', 'munchen', 'munich', 'mnichov'],
      cologne: ['köln', 'koln', 'cologne', 'kolín nad rýnem'],
      bratislava: ['bratislava', 'pozsony', 'pressburg'],
    };
    const synToKey = new Map(
      Object.entries(SYNS).flatMap(([key, arr]) => arr.map(v => [stripDiacritics(v), key]))
    );

    // Odstranění obvodu: „Praha 5“, „Prague 7“, „Budapest I.“,
    // „Warszawa-Śródmieście“, „Praha-Libuš“, apod.
    const collapseToBaseCity = (name) => {
      if (!name) return name;
      let s = name.trim();

      // Pokud je to tvar "Město - cokoliv" → nech "Město"
      s = s.replace(/\s*[-–]\s*.+$/, '');

      // "- část / okres" za čárkou necháme, ale pouze pokud nejde o statní zemi
      // (většina TM měst nemá za čárkou nic – pro jistotu necháme jen před čárkou)
      s = s.split(',')[0].trim();

      // Tvary "Město 1", "Město 12", "Město IV", "Město IX"
      s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim();

      // Speciál pro Prahu/Prague/Prag/Praga: "Praha 4-Libuš" → "Praha"
      s = s.replace(/\s+\d+\s*-.+$/i, '').trim();

      return s;
    };

    const normCityKey = (name) => {
      const base = collapseToBaseCity(name);
      const n = stripDiacritics(base);
      return synToKey.get(n) || n; // pokud je to synonymum, vrať kanonický klíč
    };

    const q = qRaw;
    const qn = stripDiacritics(q);

    // ---------- Volání TM (venues + fallback events) ----------
    const tm = async (path, params, cc) => {
      try {
        const u = new URL(`${BASE}${path}`);
        u.searchParams.set('apikey', API_KEY);
        u.searchParams.set('locale', locale);
        if (cc) u.searchParams.set('countryCode', cc);
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

    // Primárně bereme VENUES (města jsou v nich nejkonzistentnější)
    const collect = async (cc) => {
      const bucket = new Map();
      const add = (name, countryCode, lat, lon, w = 1) => {
        if (!name) return;
        const base = collapseToBaseCity(name);
        const key = `${normCityKey(base)}|${countryCode || ''}`;
        const cur = bucket.get(key) || {
          namePref: base, // název, který budeme zobrazovat
          nameAll: new Set([base]),
          countryCode: countryCode || '',
          lat, lon, score: 0
        };
        cur.score += w;
        if (!cur.lat && lat) cur.lat = Number(lat);
        if (!cur.lon && lon) cur.lon = Number(lon);
        cur.nameAll.add(base);
        // Preferuj variantu, která nejlépe odpovídá dotazu (prefix); jinak nejkratší
        const cand = base;
        const bestNow = stripDiacritics(cur.namePref);
        const candN = stripDiacritics(cand);
        const better =
          (candN.startsWith(qn) && !bestNow.startsWith(qn)) ||
          (cand.length < cur.namePref.length && (candN.startsWith(qn) === bestNow.startsWith(qn)));
        if (better) cur.namePref = cand;
        bucket.set(key, cur);
      };

      // 1) venues by city:
      const vCity = await tm('/venues.json', { city: q, size: Math.min(size * 2, 100) }, cc);
      for (const v of vCity?._embedded?.venues ?? []) {
        add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
            v?.location?.latitude, v?.location?.longitude, 3);
      }

      // 2) venues by keyword:
      if (bucket.size < size) {
        const vKey = await tm('/venues.json', { keyword: q, size: Math.min(size * 5, 200) }, cc);
        for (const v of vKey?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
              v?.location?.latitude, v?.location?.longitude, 1);
        }
      }

      // 3) fallback z events:
      if (bucket.size < size) {
        const evs = await tm('/events.json', { keyword: q, size: Math.min(size * 3, 100) }, cc);
        for (const e of evs?._embedded?.events ?? []) {
          for (const v of e?._embedded?.venues ?? []) {
            add(v?.city?.name, v?.country?.countryCode || v?.country?.name,
                v?.location?.latitude, v?.location?.longitude, 1);
          }
        }
      }

      return bucket;
    };

    // 1) Zkus s countryCode (když ho klient poslal)
    let bucket = await collect(countryCodeRaw);

    // 2) Pokud nic rozumného, zkuste to bez countryCode (globální vyhledávání)
    if ((!bucket || bucket.size === 0) && countryCodeRaw) {
      bucket = await collect('');
    }

    // ---------- Seřazení + vyfiltrování ----------
    const itemsRaw = Array.from(bucket.values()).map(x => {
      const ln = stripDiacritics(x.namePref);
      const starts = ln.startsWith(qn);
      const contains = !starts && ln.includes(qn);
      const boost = (starts ? 10 : 0) + (contains ? 5 : 0);
      return { ...x, score: (x.score || 0) + boost, _starts: starts, _contains: contains };
    });

    // Když máme relevantní (starts/contains), ostatní odhoď
    const relevant = itemsRaw.filter(it => it._starts || it._contains);
    const pool = relevant.length ? relevant : itemsRaw;

    const list = pool
      .sort((a, b) => b.score - a.score || a.namePref.localeCompare(b.namePref))
      .slice(0, size)
      .map(x => ({
        // zobraz pouze základní město
        label: x.countryCode ? `${x.namePref}, ${x.countryCode}` : x.namePref,
        value: x.namePref,
        name: x.namePref,
        countryCode: x.countryCode,
        lat: x.lat,
        lon: x.lon,
        score: x.score
      }));

    console.log('[citySuggest] return', list.length, 'items');
    return json(200, { cities: list });
  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    // Vždy vrať platnou odpověď
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
