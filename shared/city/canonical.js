// shared/city/canonical.js
// ---------------------------------------------------------
// Jediný "zdroj pravdy" pro práci s názvy měst napříč FE i Netlify funkcemi.
// - robustní normalizace (bez diakritiky, lower, trim)
// - baseCityKey(): sloučí "Praha 1/2/7…" → prague, "Bratislava - Staré Mesto" → bratislava
// - canonForInputCity(): převede aliasy na kanonické endonym/exonym používané v TM (EN varianty)
// - labelForCanon(): vrátí preferovaný popisek podle UI jazyka
// ---------------------------------------------------------

/** Základní normalizace textu: lower + odstranění diakritiky + trim */
export function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diakritika pryč
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .trim();
}

/**
 * Vrátí "základní" klíč města (slučuje městské části a pomlčky/čárky).
 * Příklady:
 *  - "Praha 7" → "prague"
 *  - "Praha-Dejvice" → "prague"
 *  - "Bratislava - Staré Mesto" → "bratislava"
 *  - "Wien" / "Vídeň" / "Vienna" / "Wiedeń" / "Viedeň" / "Bécs" → "vienna"
 */
export function baseCityKey(input) {
  const n = normalize(input);

  // Praha – čísla, římské číslice, textové části
  // "praha", "praha 1", "praha-7", "praha dejvice" → prague
  if (/^praha(?:\s*[-–]?\s*(?:\d+|[ivxlcdm]+|[a-z\u00e1-\u017e]+))?$/i.test(n)) {
    return 'prague';
  }

  // Bratislava – libovolná městská část
  if (/^bratislava(?:\s*[-–]?\s*.+)?$/.test(n)) {
    return 'bratislava';
  }

  // Vídeň / Wien / Vienna / Wiedeń / Viedeň / Bécs → vienna
  if (['vienna', 'wien', 'viden', 'vieden', 'wieden', 'becs'].includes(n)) {
    return 'vienna';
  }

  // Jednoduchý fallback: vezmi text do čárky/pomlčky (často "Město - část")
  return n.split(/[,-]/)[0].trim();
}

/**
 * Převede aliasy měst na kanonický "TM-friendly" název pro dotaz do Ticketmasteru.
 * Preferujeme zde EN endonym/exonym, které TM nejlépe chápe u parametru `city`.
 */
export function canonForInputCity(input) {
  const n = normalize(input);
  if (!n) return '';

  // Praha & spol.
  if (n === 'praha' || n === 'prague' || n === 'prag' || n === 'praga' || n.startsWith('praha')) {
    return 'Prague';
  }

  // Brno
  if (n === 'brno' || n === 'bruen' || n === 'brunn') {
    return 'Brno';
  }

  // Ostrava (německy/PL/HU občas v datech)
  if (['ostrava', 'ostrau', 'ostrawa', 'osztrava'].includes(n)) {
    return 'Ostrava';
  }

  // Pilsen / Plzeň
  if (['plzen', 'plzeň', 'pilsen'].includes(n)) {
    return 'Pilsen';
  }

  // Bratislava + historické/maďarské názvy
  if (['bratislava', 'pressburg', 'pozsony'].includes(n)) {
    return 'Bratislava';
  }

  // Vídeň / Wien / Vienna / Wiedeń / Viedeň / Bécs
  if (['vienna', 'wien', 'viden', 'vieden', 'wieden', 'becs'].includes(n)) {
    return 'Vienna';
  }

  // Kraków
  if (['krakow', 'kraków', 'krakau', 'krakov', 'krakow\u0144'].includes(n)) {
    return 'Kraków';
  }

  // Warsaw
  if (['warsaw', 'warszawa', 'warschau', 'varsava', 'varšava', 'varso'].includes(n)) {
    return 'Warsaw';
  }

  // fallback: zkusit base klíč
  const base = baseCityKey(n);
  if (base === 'prague') return 'Prague';
  if (base === 'bratislava') return 'Bratislava';
  if (base === 'vienna') return 'Vienna';

  // Nic nemapujeme → vrať původní vstup (TM si občas poradí)
  return input;
}

// Preferované popisky podle jazyka UI (používá se v typeaheadu apod.)
export const CANON_LABEL = {
  prague:     { cs:'Praha',     sk:'Praha',     en:'Prague',  de:'Prag',     pl:'Praga',    hu:'Prága' },
  brno:       { cs:'Brno',      sk:'Brno',      en:'Brno',    de:'Brünn',    pl:'Brno',     hu:'Brünn' },
  ostrava:    { cs:'Ostrava',   sk:'Ostrava',   en:'Ostrava', de:'Ostrau',   pl:'Ostrawa',  hu:'Osztrava' },
  pilsen:     { cs:'Plzeň',     sk:'Plzeň',     en:'Pilsen',  de:'Pilsen',   pl:'Pilzno',   hu:'Pilsen' },
  bratislava: { cs:'Bratislava',sk:'Bratislava',en:'Bratislava', de:'Pressburg', pl:'Bratysława', hu:'Pozsony' },
  vienna:     { cs:'Vídeň',     sk:'Viedeň',    en:'Vienna',  de:'Wien',     pl:'Wiedeń',   hu:'Bécs' },
  krakow:     { cs:'Krakov',    sk:'Krakov',    en:'Kraków',  de:'Krakau',   pl:'Kraków',   hu:'Krakkó' },
  warsaw:     { cs:'Varšava',   sk:'Varšava',   en:'Warsaw',  de:'Warschau', pl:'Warszawa', hu:'Varsó' }
};

/** Vrátí user-friendly label pro kanonický klíč podle jazyka UI */
export function labelForCanon(canonKey, lang = 'cs') {
  const key = normalize(canonKey);
  const map = CANON_LABEL[key];
  return map?.[lang] || canonKey;
}
