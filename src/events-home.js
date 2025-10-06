// /src/events-home.js
// Front-end pro výpis událostí na homepage – sjednocené API + vlastní city typeahead.
import { fetchEvents } from './api/eventsApi.js';
import { canonForInputCity, guessCountryCodeFromCity } from './city/canonical.js';

const list = document.getElementById('eventsList');
const form = document.getElementById('events-filters-form');

const qs = new URLSearchParams(location.search);
const lang = (qs.get('lang') || document.documentElement.lang || 'cs').toLowerCase();

const localeMap = { cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB', de: 'de-DE', pl: 'pl-PL', hu: 'hu-HU' };
const locale = localeMap[lang] || 'en-GB';

// ----------------------- helpers: URL <-> filters ----------------------------
function mapSegmentToCategory(v) {
  const m = {
    concert: 'concert', concerts: 'concert', music: 'concert',
    sport: 'sport', sports: 'sport',
    theatre: 'theatre', theater: 'theatre', arts: 'theatre',
    festival: 'festival', festivals: 'festival'
  };
  return m[(v || '').toLowerCase()] || '';
}

function getFiltersFromQuery() {
  const f = {};
  const city = (qs.get('city') || '').trim();
  const seg = qs.get('segment') || qs.get('category');
  const sort = qs.get('sort');
  const kw   = qs.get('keyword') || qs.get('q');
  const df   = qs.get('dateFrom') || qs.get('from');
  const dt   = qs.get('dateTo')   || qs.get('to');

  if (city) f.city = city;
  const cat = mapSegmentToCategory(seg);
  if (cat) f.category = cat;
  if (sort === 'nearest' || sort === 'latest') f.sort = sort;
  if (kw) f.keyword = kw;
  if (df) f.dateFrom = df;
  if (dt) f.dateTo = dt;

  return f;
}

function applyFiltersToForm(f) {
  if (!form) return;
  if (f.category) form.querySelector('#filter-category').value = f.category;
  if (f.city)     form.querySelector('#filter-city').value     = f.city;
  if (f.sort)     form.querySelector('#filter-sort').value     = f.sort;
  if (f.keyword)  form.querySelector('#filter-keyword').value  = f.keyword;
  if (f.dateFrom) form.querySelector('#filter-date-from').value = f.dateFrom;
  if (f.dateTo)   form.querySelector('#filter-date-to').value   = f.dateTo;
}

function updateQueryFromFilters(f) {
  const next = new URL(location.href);
  next.searchParams.set('lang', lang);
  const set = (k, v) => v ? next.searchParams.set(k, v) : next.searchParams.delete(k);
  set('city', f.city);
  set('segment', f.category);
  set('sort', f.sort);
  set('keyword', f.keyword);
  set('dateFrom', f.dateFrom);
  set('dateTo', f.dateTo);
  history.replaceState(null, '', next);
}

// --------------------------- helpers: form -----------------------------------
function getFormFilters(formEl) {
  if (!formEl) return {};
  const catSel = formEl.querySelector('#filter-category')?.value || 'all';
  const category = catSel === 'all' ? undefined : catSel;
  const city = formEl.querySelector('#filter-city')?.value.trim();
  const sortSel = formEl.querySelector('#filter-sort')?.value;
  const sort = sortSel === 'latest' ? 'latest' : 'nearest';
  const keyword = formEl.querySelector('#filter-keyword')?.value.trim();
  const dateFrom = formEl.querySelector('#filter-date-from')?.value || '';
  const dateTo   = formEl.querySelector('#filter-date-to')?.value || '';
  return { keyword, city, sort, category, dateFrom, dateTo };
}

// ------------------------------ rendering ------------------------------------
function formatDate(isoOrLocal, loc = 'en-GB') {
  if (!isoOrLocal) return '';
  const d = new Date(isoOrLocal);
  if (isNaN(d)) return String(isoOrLocal);
  const day  = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d);
  const date = new Intl.DateTimeFormat(loc, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(d);
  return [day, date, time].filter(Boolean).join(' • ');
}

const BUY_CTA = {
  cs: 'Koupit vstupenky',
  sk: 'Kúpiť lístky',
  en: 'Buy tickets',
  de: 'Tickets kaufen',
  pl: 'Kup bilety',
  hu: 'Jegyek'
};
const buyLabel = (lng) => BUY_CTA[(lng || 'en').slice(0,2)] || BUY_CTA.en;

// Ticketmaster language enforcement (keeps UTM/affiliate params intact)
function mapLangToTm(lng) {
  const m = { cs:'cs-cz', sk:'sk-sk', pl:'pl-pl', de:'de-de', hu:'hu-hu', en:'en-gb' };
  const k = (lng || 'en').slice(0,2);
  return m[k] || 'en-gb';
}
function adjustTicketmasterLanguage(rawUrl, lng) {
  try {
    const u = new URL(rawUrl, location.href);
    const tmLang = mapLangToTm(lng);
    u.searchParams.set('language', tmLang);
    if (!u.searchParams.has('locale')) u.searchParams.set('locale', tmLang);
    return u.toString();
  } catch { return rawUrl; }
}

function renderCard(ev) {
  const title = ev.title?.[lang] || ev.title?.en || Object.values(ev.title || {})[0] || 'Event';
  const img   = ev.image || '/images/placeholder-event.jpg';
  const city  = ev.location?.city || '';
  const date  = formatDate(ev.datetime, locale);
  const rawUrl = ev.url || ev.tickets || '#';
  const url    = adjustTicketmasterLanguage(rawUrl, lang);

  // Markup zarovnaný se styles v events.scss (.event-img, .event-title, .event-date, .event-buttons-group, .btn-event.ticket)
  return `
    <article class="event-card">
      <img class="event-img" src="${img}" alt="${title}" loading="lazy" />
      <h3 class="event-title">${title}</h3>
      <p class="event-date">${city ? city + ' • ' : ''}${date}</p>

      <div class="event-buttons-group">
        <a class="btn-event ticket" href="${url}" target="_blank" rel="noopener">
          ${buyLabel(lang)}
        </a>
      </div>

      <small class="event-source">Ticketmaster</small>
    </article>
  `;
}

function renderList(items = []) {
  if (!items.length) {
    list.innerHTML = `<p>Nic jsme nenašli. Zkuste upravit filtry.</p>`;
    return;
  }
  list.innerHTML = items.map(renderCard).join('');
}

function renderSkeleton(n = 6) {
  list.innerHTML = Array.from({ length: n }).map(() => `
    <div class="event-card skeleton">
      <div class="ph-img"></div>
      <div class="ph-line"></div>
      <div class="ph-line short"></div>
    </div>
  `).join('');
}

// ----------------------------- data ------------------------------------------
async function fetchAndRender(filters = {}) {
  try {
    const items = await fetchEvents({
      locale: lang,
      filters: { size: 12, ...filters },
    });
    renderList(items);
    console.info('[events-home] rendered items:', items.length, 'for filters:', { ...filters });
  } catch (e) {
    console.error(e);
    list.innerHTML = `<p>Načítání událostí selhalo.</p>`;
  }
}

// ------------------------ CITY TYPEAHEAD (built-in) --------------------------
const cityInput = form?.querySelector('#filter-city');

// jednoduchá normalizace pro porovnávání
const norm = (s='') => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/ß/g,'ss').replace(/ł/g,'l').trim();

// lokální index nejčastějších měst (včetně aliasů)
const CITY_INDEX = [
  // UK & IE
  { label:'London', cc:'GB', aliases:['londyn','londýn','londra','londen','londres'] },
  { label:'Manchester', cc:'GB', aliases:[] },
  { label:'Birmingham', cc:'GB', aliases:[] },
  { label:'Leeds', cc:'GB', aliases:[] },
  { label:'Liverpool', cc:'GB', aliases:[] },
  { label:'Edinburgh', cc:'GB', aliases:['edinburk'] },
  { label:'Glasgow', cc:'GB', aliases:[] },
  { label:'Bristol', cc:'GB', aliases:[] },
  { label:'Cardiff', cc:'GB', aliases:[] },
  { label:'Dublin', cc:'IE', aliases:[] },

  // FR
  { label:'Paris', cc:'FR', aliases:['paříž','pariz','paríž','parigi','parís','paryż'] },
  { label:'Lyon', cc:'FR', aliases:[] },
  { label:'Marseille', cc:'FR', aliases:['marsej'] },

  // DE/AT/CH
  { label:'Berlin', cc:'DE', aliases:['berlín'] },
  { label:'Hamburg', cc:'DE', aliases:['hamburk'] },
  { label:'Munich', cc:'DE', aliases:['mnichov','muenchen','münchen'] },
  { label:'Cologne', cc:'DE', aliases:['kolín nad rýnem','koln','köln'] },
  { label:'Frankfurt', cc:'DE', aliases:[] },
  { label:'Stuttgart', cc:'DE', aliases:[] },
  { label:'Düsseldorf', cc:'DE', aliases:['dusseldorf'] },
  { label:'Vienna', cc:'AT', aliases:['wien','vídeň','viden'] },
  { label:'Zurich', cc:'CH', aliases:['zürich','curych'] },
  { label:'Geneva', cc:'CH', aliases:['ženeva','genève'] },

  // CZ/SK/PL/HU
  { label:'Prague', cc:'CZ', aliases:['praha','prag','praga'] },
  { label:'Brno', cc:'CZ', aliases:[] },
  { label:'Ostrava', cc:'CZ', aliases:[] },
  { label:'Bratislava', cc:'SK', aliases:['pressburg','pozsony'] },
  { label:'Warsaw', cc:'PL', aliases:['warszawa','varšava','warschau'] },
  { label:'Kraków', cc:'PL', aliases:['krakov','krakau'] },
  { label:'Budapest', cc:'HU', aliases:['budapešť'] },

  // ES/PT/IT/NL/BE
  { label:'Barcelona', cc:'ES', aliases:[] },
  { label:'Madrid', cc:'ES', aliases:[] },
  { label:'Rome', cc:'IT', aliases:['roma','řím','rim'] },
  { label:'Milan', cc:'IT', aliases:['milano','milán'] },
  { label:'Amsterdam', cc:'NL', aliases:[] },
  { label:'Rotterdam', cc:'NL', aliases:[] },
  { label:'Brussels', cc:'BE', aliases:['brusel','bruxelles'] }
];

// vytvoří/popne popover s návrhy – třídy zarovnané s .typeahead-* stylováním
function createTaUi(input) {
  const box = document.createElement('div');
  box.className = 'typeahead-panel';
  box.style.position = 'absolute';
  box.style.zIndex = '1000';
  box.style.minWidth = input.offsetWidth + 'px';
  box.hidden = true;
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(box);
  return box;
}

function renderTa(box, items) {
  if (!items.length) {
    box.hidden = false;
    box.innerHTML = `<div class="typeahead-empty">Žádné výsledky</div>`;
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <ul class="typeahead-list" role="listbox">
      ${items.map(it => `
        <li class="typeahead-item" role="option" data-city="${it.label}" data-cc="${it.cc || it.countryCode || ''}">
          <span class="ti-city">${it.label}</span>
          <kbd class="ti-meta">${(it.cc || it.countryCode || '').toUpperCase()}</kbd>
        </li>
      `).join('')}
    </ul>`;
}

function localSuggest(q) {
  const n = norm(q);
  if (!n) return [];
  return CITY_INDEX
    .filter(c => norm(c.label).startsWith(n) || c.aliases.some(a => norm(a).startsWith(n)))
    .slice(0, 8);
}

function dedupeByLabel(arr) {
  const seen = new Set();
  return arr.filter(x => (seen.has(x.label) ? false : (seen.add(x.label), true)));
}

// šetrný vzdálený suggest (rozšířený výčet zemí včetně GB)
const REMOTE_CC = 'GB,IE,CZ,SK,PL,HU,DE,AT,CH,FR,IT,ES,PT,NL,BE,DK,NO,SE,FI,US,CA';
const debounce = (fn, ms=300) => { let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

// Abort & anti-race
let currentSuggestAbort = null;
let taRequestSeq = 0;

async function remoteSuggest(q, reqId) {
  const keyword = q.trim();
  if (keyword.length < 2) return [];
  if (currentSuggestAbort) currentSuggestAbort.abort();
  const ctrl = new AbortController();
  currentSuggestAbort = ctrl;

  const url = `/.netlify/functions/ticketmasterCitySuggest?locale=${encodeURIComponent(lang)}&keyword=${encodeURIComponent(keyword)}&size=12&countryCode=${encodeURIComponent(REMOTE_CC)}`;
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.cities) ? data.cities : (Array.isArray(data?.items) ? data.items : []);
    if (reqId !== taRequestSeq) return [];
    return items
      .map(v => ({ label: v.label || v.name || v.city || '', cc: (v.countryCode || v.country || '').toString().slice(0,2).toUpperCase() }))
      .filter(v => v.label)
      .slice(0, 10);
  } catch { return []; }
}

const remoteSuggestDebounced = debounce(async (q, box) => {
  const reqId = ++taRequestSeq;
  const r = await remoteSuggest(q, reqId);
  if (reqId !== taRequestSeq) return;
  const l = localSuggest(q);
  const out = dedupeByLabel([...l, ...r]);
  renderTa(box, out);
}, 280);

// inicializace typeaheadu
function initCityTypeahead() {
  if (!cityInput) return;
  const box = createTaUi(cityInput);

  // klik na položku
  box.addEventListener('click', (e) => {
    const li = e.target.closest('.typeahead-item');
    if (!li) return;
    const city = li.getAttribute('data-city');
    cityInput.value = city;
    box.hidden = true;

    const f = { ...getFormFilters(form) };
    f.city = city; // uživateli necháme „lidský“ label
    updateQueryFromFilters(f);
    fetchAndRender(f);
  });

  // vstup
  cityInput.addEventListener('input', () => {
    const q = cityInput.value;
    const l = localSuggest(q);
    if (l.length) {
      renderTa(box, l);
    } else {
      remoteSuggestDebounced(q, box); // debounce + anti-race
    }
  });

  // zavření při kliknutí mimo
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== cityInput) box.hidden = true;
  });
}

// ------------------------------ init -----------------------------------------
if (list) {
  renderSkeleton(6);

  // 1) Hydratace z URL + první fetch
  const initial = getFiltersFromQuery();
  applyFiltersToForm(initial);
  fetchAndRender(initial);

  // 2) Odeslání formuláře
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = getFormFilters(form);

    // kanonizuj vstup pro TM – ale v URL necháme pův. text kvůli UX
    if (f.city) {
      const canon = canonForInputCity(f.city);
      const cc = guessCountryCodeFromCity(f.city);
      console.info('[events-home] submit city:', f.city, 'canon:', canon, 'cc:', cc);
    }

    updateQueryFromFilters(f);
    fetchAndRender(f);
  });

  // 3) Quick chips
  document.getElementById('chipToday')?.addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const f = { ...getFormFilters(form), dateFrom: today, dateTo: today, sort: 'nearest' };
    applyFiltersToForm(f);
    updateQueryFromFilters(f);
    fetchAndRender(f);
  });

  document.getElementById('chipWeekend')?.addEventListener('click', () => {
    const now = new Date();
    const day = now.getDay(); // 0=Ne
    const diffToSat = 6 - (day || 7);
    const sat = new Date(now); sat.setDate(now.getDate() + diffToSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    const d = (x) => x.toISOString().slice(0, 10);
    const f = { ...getFormFilters(form), dateFrom: d(sat), dateTo: d(sun), sort: 'nearest' };
    applyFiltersToForm(f);
    updateQueryFromFilters(f);
    fetchAndRender(f);
  });

  document.getElementById('chipClear')?.addEventListener('click', () => {
    form?.reset();
    const f = {};
    updateQueryFromFilters(f);
    fetchAndRender(f);
  });

  // 4) „V mém okolí“
  const nearBtns = [document.getElementById('chipNearMe'), document.getElementById('filter-nearme')].filter(Boolean);
  nearBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        renderSkeleton(6);
        try {
          const f = {
            ...getFormFilters(form),
            latlong: `${pos.coords.latitude},${pos.coords.longitude}`,
            radius: 100,
            unit: 'km',
            sort: 'nearest',
          };
          // nechceme cpát latlong do URL (citlivé)
          updateQueryFromFilters({ ...f, latlong: undefined, radius: undefined, unit: undefined });
          const items = await fetchEvents({ locale: lang, filters: { size: 12, ...f } });
          renderList(items);
        } catch (e) {
          console.error(e);
          list.innerHTML = `<p>Načítání událostí selhalo.</p>`;
        }
      });
    })
  );

  // 5) City typeahead
  initCityTypeahead();
}
