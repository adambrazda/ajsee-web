// netlify/functions/ticketmasterCitySuggest.js
// ---------------------------------------------------------
// City suggest přes Ticketmaster Discovery API (venues + fallback events)
// - sjednocení měst (Praha 1/2/… → Praha)
// - aliasy (Praha/Prague/Prag/Praga… → jedna položka)
// - jazykový label (Praha / Prague / Wien / Vídeň … podle UI jazyka)
// - podpora countryCode i jako CSV (CZ,SK,PL,HU,DE,AT)
// ---------------------------------------------------------

import {
  normalize as norm,
  baseCityKey,
  canonForInputCity,
  labelForCanon
} from '../../shared/city/canonical.js';

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

    // --- Bezpečné parsování query (funguje i v Lambda compat režimu) ---
    const url = new URL(
      event.rawUrl ||
      `http://local/?${new URLSearchParams(event.queryStringParameters || {}).toString()}`
    );

    const q = (url.searchParams.get('keyword') || '').trim();
    const ccParam = (url.searchParams.get('countryCode') || '').trim();
    const locale = (url.searchParams.get('locale') || 'en').slice(0, 2).toLowerCase();
    const size = Math.max(1, Math.min(50, parseInt(url.searchParams.get('size') || '10', 10)));

    if (q.length < 2) {
      return json(200, { cities: [] });
    }

    // --- Připrav CC seznam (CSV i single hodnotu) ---
    // Prázdný seznam znamená "globální" dotaz (bez countryCode)
    const ccList = ccParam
      ? ccParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    // --- Jednotné volání na TM (venues + fallback events) ---
    const tm = async (path, params, cc) => {
      try {
        const u = new URL(`${BASE}${path}`);
        u.searchParams.set('apikey', API_KEY);
        u.searchParams.set('locale', locale || 'en');
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

    // --- Sběr kandidátů pro 1 CC (nebo globálně, když cc = ''/null) ---
    const collectForCC = async (cc) => {
      const bucket = new Map();

      // vnitřní akumulace
      const add = (rawName, countryCode, lat, lon, weight = 1) => {
        if (!rawName) return;

        // 1) získej kanonický název pro dotaz (sjednotí Praha/Prague/Prag/…)
        const canonForQuery = canonForInputCity(rawName) || rawName;

        // 2) "base" bez městských částí: "Praha 7" → "Praha"
        const baseHuman = collapseDistricts(rawName);

        // 3) klíč skupiny: podle kanonické formy (aby "Prag" splynul s "Praha")
        const groupKeyCanon = norm(canonForQuery); // např. "prague"

        // 4) preferovaný zobrazovací label podle UI jazyka
        //    (když CANON_LABEL nezná město, necháme baseHuman)
        const displayLabel = labelForCanon(groupKeyCanon, locale) || baseHuman;

        const key = `${groupKeyCanon}|${countryCode || ''}`;
        const cur = bucket.get(key) || {
          namePref: displayLabel,          // co budeme ukazovat
          countryCode: countryCode || '',
          lat: undefined,
          lon: undefined,
          score: 0
        };

        cur.score += weight;
        if (cur.lat == null && lat != null) cur.lat = Number(lat);
        if (cur.lon == null && lon != null) cur.lon = Number(lon);

        // Pokud nová varianta lépe odpovídá dotazu, preferuj ji (prefix)
        const bestN = norm(cur.namePref);
        const candN = norm(displayLabel);
        const qn = norm(q);
        const better =
          (candN.startsWith(qn) && !bestN.startsWith(qn)) ||
          (displayLabel.length < cur.namePref.length && (candN.startsWith(qn) === bestN.startsWith(qn)));
        if (better) cur.namePref = displayLabel;

        bucket.set(key, cur);
      };

      // 1) venues by city (vyšší váha)
      const vCity = await tm('/venues.json', { city: q, size: Math.min(size * 2, 100) }, cc);
      for (const v of vCity?._embedded?.venues ?? []) {
        add(v?.city?.name, v?.country?.countryCode || v?.country?.name, v?.location?.latitude, v?.location?.longitude, 3);
      }

      // 2) venues by keyword (fallback)
      if (bucket.size < size) {
        const vKey = await tm('/venues.json', { keyword: q, size: Math.min(size * 5, 200) }, cc);
        for (const v of vKey?._embedded?.venues ?? []) {
          add(v?.city?.name, v?.country?.countryCode || v?.country?.name, v?.location?.latitude, v?.location?.longitude, 1);
        }
      }

      // 3) events (další fallback – vyjmout města z embedded venues)
      if (bucket.size < size) {
        const evs = await tm('/events.json', { keyword: q, size: Math.min(size * 3, 100) }, cc);
        for (const e of evs?._embedded?.events ?? []) {
          for (const v of e?._embedded?.venues ?? []) {
            add(v?.city?.name, v?.country?.countryCode || v?.country?.name, v?.location?.latitude, v?.location?.longitude, 1);
          }
        }
      }

      return bucket;
    };

    // --- Kolekce přes více CC (CSV), případně globální fallback ---
    let merged = new Map();

    const mergeBuckets = (src) => {
      for (const [k, v] of src.entries()) {
        const cur = merged.get(k);
        if (!cur) { merged.set(k, { ...v }); continue; }
        cur.score = (cur.score || 0) + (v.score || 0);
        if (cur.lat == null && v.lat != null) cur.lat = v.lat;
        if (cur.lon == null && v.lon != null) cur.lon = v.lon;
        // preferuj lepší label (prefix k dotazu / kratší)
        const qn = norm(q);
        const bestN = norm(cur.namePref || '');
        const candN = norm(v.namePref || '');
        const better =
          (candN.startsWith(qn) && !bestN.startsWith(qn)) ||
          (v.namePref?.length < (cur.namePref?.length || Infinity) && (candN.startsWith(qn) === bestN.startsWith(qn)));
        if (better) cur.namePref = v.namePref;
        merged.set(k, cur);
      }
    };

    if (ccList.length) {
      for (const cc of ccList) {
        const b = await collectForCC(cc);
        mergeBuckets(b);
      }
      // pokud po regionálním kolekci je výsledek prázdný → zkus globálně
      if (merged.size === 0) {
        const bGlobal = await collectForCC('');
        mergeBuckets(bGlobal);
      }
    } else {
      // rovnou globální vyhledávání
      const bGlobal = await collectForCC('');
      mergeBuckets(bGlobal);
    }

    // --- Postprocess: boost podle relevance k dotazu + seřazení ---
    const qn = norm(q);
    let items = Array.from(merged.values()).map(x => {
      const ln = norm(x.namePref);
      const starts = ln.startsWith(qn);
      const contains = !starts && ln.includes(qn);
      const boost = (starts ? 10 : 0) + (contains ? 5 : 0);
      return { ...x, score: (x.score || 0) + boost, _starts: starts, _contains: contains };
    });

    // Pokud máme nějaké relevantní (starts/contains), ostatní odhoď
    const relevant = items.filter(it => it._starts || it._contains);
    if (relevant.length) items = relevant;

    items.sort((a, b) => (b.score - a.score) || a.namePref.localeCompare(b.namePref));
    items = items.slice(0, size);

    // --- Výstup: jen základní město (bez částí), + country code ---
    const out = items.map(x => ({
      label: x.countryCode ? `${x.namePref}, ${x.countryCode}` : x.namePref,
      value: x.namePref,
      name: x.namePref,
      countryCode: x.countryCode,
      lat: x.lat,
      lon: x.lon,
      score: x.score
    }));

    console.log('[citySuggest] return', out.length, 'items');
    return json(200, { cities: out });

  } catch (err) {
    console.error('ticketmasterCitySuggest crashed:', err);
    // Vždy vrať platnou odpověď
    return json(200, { cities: [] });
  }
};

// --- Pomocné: kolaps městských částí (Praha 1/2/… → Praha) ---
function collapseDistricts(name) {
  if (!name) return name;
  let s = String(name).trim();

  // "Město - část" → jen "Město"
  s = s.replace(/\s*[-–]\s*.+$/, '');

  // před čárkou je nejčastěji město
  s = s.split(',')[0].trim();

  // "Město 1", "Město 12", "Město IV"
  s = s.replace(/\s+(?:\d+|[IVXLCDM]+)\.?$/i, '').trim();

  // "Praha 4-Libuš" → "Praha"
  s = s.replace(/\s+\d+\s*-.+$/i, '').trim();

  // Pokud jde o známé aliasy, vrať „kanonické“ base město (Praha/Wien…)
  const baseKey = baseCityKey(s); // např. "prague", "bratislava", "vienna", nebo normalizovaný název bez částí
  // label necháme na vyšší vrstvě (labelForCanon), zde vracíme "human" tvar (bez částí)
  return s;
}

// --- Jednotný způsob odpovědi pro Netlify Functions (Lambda compat) ---
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
