// Modul „Near me“ (HTML5 geolokace → vícezdrojový IP fallback)
// Export: attachNearMeButton({ formEl, t, wireOnce, getLang, getFilters, setFilters, setFilterInputsFromState, renderAndSync })

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function fetchWithTimeout(url, { timeout = 7000, ...opts } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(t));
}

function isSecureContextLike() {
  if (location.protocol === 'https:') return true;
  const h = location.hostname || '';
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.)/i.test(h);
}

async function ipFallbackMulti() {
  const tryIpapi = async () => {
    const r = await fetchWithTimeout('https://ipapi.co/json/', { timeout: 6500 });
    if (!r.ok) throw new Error('ipapi_http');
    const j = await r.json();
    if (j?.latitude && j?.longitude) return { lat: +j.latitude, lon: +j.longitude, source: 'ipapi' };
    throw new Error('ipapi_bad');
  };
  const tryIpwho = async () => {
    const r = await fetchWithTimeout('https://ipwho.is/', { timeout: 6500 });
    if (!r.ok) throw new Error('ipwho_http');
    const j = await r.json();
    if (j?.success && j.latitude && j.longitude) return { lat: +j.latitude, lon: +j.longitude, source: 'ipwho' };
    throw new Error('ipwho_bad');
  };
  const tryGeojs = async () => {
    const r = await fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json', { timeout: 6500 });
    if (!r.ok) throw new Error('geojs_http');
    const j = await r.json();
    if (j?.latitude && j?.longitude) return { lat: +j.latitude, lon: +j.longitude, source: 'geojs' };
    throw new Error('geojs_bad');
  };

  const attempts = [tryIpapi, tryIpwho, tryGeojs];
  for (const fn of attempts) {
    try { return await fn(); } catch {}
  }
  throw new Error('POSITION_UNAVAILABLE');
}

async function getPositionWithFallback() {
  if (!isSecureContextLike() || !navigator.geolocation) {
    return ipFallbackMulti();
  }
  try {
    const pos = await new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 300000
      });
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'browser' };
  } catch (e) {
    // explicit deny → nechceme auto-fallback (kvůli UX), jen hodit PERMISSION_DENIED
    if (e && typeof e.code === 'number' && e.code === 1) {
      const err = new Error('PERMISSION_DENIED'); err.code = 1; throw err;
    }
    return ipFallbackMulti();
  }
}

async function reverseGeocode(lat, lon, lang) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;
    const r = await fetchWithTimeout(url, { timeout: 6500, headers: { 'Accept-Language': lang || 'en' } });
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || null;
  } catch { return null; }
}

let nearMeLock = null;
const _origLabel = new WeakMap();

function setBusy(btns, busy, t) {
  btns.forEach(b => {
    if (!b) return;
    b.disabled = !!busy;
    b.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (!_origLabel.has(b)) _origLabel.set(b, b.textContent);
    const finding = t?.('filters.finding', 'Detecting location…') || 'Detecting location…';
    b.textContent = busy ? finding : _origLabel.get(b);
  });
}

export function attachNearMeButton({ formEl, t, wireOnce, getLang, getFilters, setFilters, setFilterInputsFromState, renderAndSync }) {
  const form = formEl || document;
  const chip = form.querySelector('#chipNearMe') || document.getElementById('chipNearMe');
  const actions = form.querySelector('.filter-actions') || form;
  const ghost = actions.querySelector('#filter-nearme');

  // sjednocení: pokud máme chip v toolbaru, odstraň „ghost“ v .filter-actions
  if (chip && ghost) ghost.remove();

  const btn = chip || ghost || (() => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'filter-nearme';
    b.className = 'btn btn-ghost';
    b.textContent = t?.('filters.nearMe', 'Near me') || 'Near me';
    actions.prepend(b);
    return b;
  })();

  const onClick = async () => {
    if (nearMeLock) return nearMeLock;
    const btns = [btn, document.getElementById('filter-nearme')].filter(Boolean);
    nearMeLock = (async () => {
      try {
        setBusy(btns, true, t);
        const { lat, lon } = await getPositionWithFallback();

        // radius: z URL/filtrů → clamp 10–300 km
        const urlRad = Number(new URL(location.href).searchParams.get('radius') || NaN);
        const cur = getFilters?.() || {};
        const radiusKm = clamp(Number.isFinite(urlRad) ? urlRad : (cur.nearMeRadiusKm || 50), 10, 300);

        // UI label do city inputu (volitelné)
        const cityInput = form.querySelector('#filter-city') || form.querySelector('#events-city-filter');
        if (cityInput) {
          const label = await reverseGeocode(lat, lon, getLang?.() || 'en');
          if (label) {
            cityInput.value = `${label} (okolí)`;
            cityInput.dataset.autofromnearme = '1';
          }
        }

        // zapiš do stavů (nearMe + řazení na „nearest“, město vyčistit)
        setFilters?.({
          nearMeLat: +lat,
          nearMeLon: +lon,
          nearMeRadiusKm: radiusKm,
          sort: 'nearest',
          city: ''
        });
        setFilterInputsFromState?.();
        await renderAndSync?.();
      } catch (e) {
        const em = String(e?.message || '');
        let msg = t?.('filters.geoError', 'Location unavailable. Try again.') || 'Location unavailable. Try again.';
        if (em.includes('PERMISSION_DENIED')) {
          msg = t?.('filters.geoDenied', 'Access to location denied. Enable it in your browser.') || msg;
        }
        alert(msg);
      } finally {
        setBusy(btns, false, t);
        nearMeLock = null;
      }
    })();
    return nearMeLock;
  };

  wireOnce(btn, 'click', onClick, 'near-me');
}
