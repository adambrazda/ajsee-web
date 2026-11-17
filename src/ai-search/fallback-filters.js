import { canonForInputCity, guessCountryCodeFromCity, labelForCanon, normalize } from '../../shared/city/canonical.js';

const CATEGORY_WORDS = {
  concert: /^(?:koncert[yu]?|concerts?|konzerte?|hangverseny(?:ek)?)$/,
  festival: /^(?:festival[yu]?|festivals?|festywal[eu]?|fesztival(?:ok)?)$/,
  theatre: /^(?:divadl[oa]|theatre|theater|teatr|szinhaz)$/,
  sport: /^(?:sport[suy]?|sportesemeny)$/,
  film: /^(?:film[yus]?|kino|cinema|mozi)$/
};

const CITY_LOCATIVES = {
  praze: 'Praha', pradze: 'Praha', brne: 'Brno', ostrave: 'Ostrava',
  plzni: 'Plzeň', olomouci: 'Olomouc', bratislave: 'Bratislava',
  vidni: 'Vídeň', warszawie: 'Warszawa', krakowie: 'Kraków',
  wroclawiu: 'Wrocław', budapesten: 'Budapest', debrecenben: 'Debrecen',
  szegeden: 'Szeged', pecsen: 'Pécs'
};

const CITY_PREPOSITION = /^(?:v|ve|in|im|w|we)$/;
const ALTERNATIVE = /^(?:nebo|alebo|or|oder|lub|albo|vagy)$/;
const EXCLUSION = /^(?:ne|bez|not|no|without|ohne|nicht|kein(?:e[rmns]?)?|nie|nelkul|nem)$/;
const PLACE_MODIFIER = /^(?:okoli|blizkosti|around|near|umgebung|okolicach|kornyeken)$/;

function mentionedCity(words, start) {
  // Match full, known city names only. The shared canonical lookup also knows
  // translated labels. Explicit locatives cover common inflections.
  const locative = Object.hasOwn(CITY_LOCATIVES, words[start]) ? CITY_LOCATIVES[words[start]] : '';
  if (locative) return { city: canonForInputCity(locative), end: start + 1 };
  if (!CITY_PREPOSITION.test(words[start - 1])) return null;

  for (let end = Math.min(words.length, start + 4); end > start; end--) {
    const candidate = words.slice(start, end).join(' ');
    if (/\d/.test(candidate)) continue;
    const city = canonForInputCity(candidate);
    if (guessCountryCodeFromCity(city)) return { city, end };
  }
  return null;
}

export function recognizeFallbackFilters(query, locale) {
  const words = normalize(query).match(/[a-z0-9]+/g) || [];
  if (words.some(word => EXCLUSION.test(word))) return {};

  const filters = {};
  const categories = Object.entries(CATEGORY_WORDS).filter(([, pattern]) => words.some(word => pattern.test(word)));
  if (categories.length === 1 && !words.some(word => ALTERNATIVE.test(word))) {
    filters.category = categories[0][0];
  }

  const cities = new Set();
  let ambiguousPlace = false;
  for (let start = 0; start < words.length; start++) {
    const match = mentionedCity(words, start);
    if (!match) continue;
    cities.add(match.city);
    ambiguousPlace ||= PLACE_MODIFIER.test(words[start - 1]) || PLACE_MODIFIER.test(words[match.end]) ||
      ALTERNATIVE.test(words[match.end]);
    start = match.end - 1;
  }

  if (cities.size === 1 && !ambiguousPlace) {
    const [city] = cities;
    const countryCode = guessCountryCodeFromCity(city);
    Object.assign(filters, {
      placeType: 'city', city, cityLabel: labelForCanon(city, locale), cityCountryCode: countryCode, countryCode
    });
  }
  return filters;
}
