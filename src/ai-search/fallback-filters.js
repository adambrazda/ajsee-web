import { canonForInputCity, guessCountryCodeFromCity, isInflectedCityName, labelForCanon, matchSearchCity, normalize } from '../../shared/city/canonical.js';
import { SUPPORTED_COUNTRY_CODES } from './intent-schema.js';

const CATEGORY_WORDS = {
  concert: /^(?:koncert(?:y|u|ek)?|koncet[yu]?|concerts?|konzerte?|hangverseny(?:ek)?)$/,
  festival: /^(?:festival[yu]?|festivals?|festywal[eu]?|fesztival(?:ok)?)$/,
  theatre: /^(?:divadl[oa]|theatre|theater|teatr|szinhaz)$/,
  sport: /^(?:sport[suy]?|sportesemeny)$/,
  film: /^(?:film[yus]?|kino|cinema|mozi)$/
};

const CITY_PREPOSITION = /^(?:v|ve|do|in|im|w|we)$/;
const EVENT_WORD = /^(?:akce|udalosti|events?|veranstaltungen|podujatia|wydarzenia|esemenyek)$/;
const ALTERNATIVE = /^(?:nebo|alebo|or|oder|lub|albo|vagy)$/;
const EXCLUSION = /^(?:ne|bez|not|no|without|ohne|nicht|kein(?:e[rmns]?)?|nie|nelkul|nem)$/;
const PLACE_MODIFIER = /^(?:okoli|blizkosti|around|near|umgebung|okolicach|kornyeken)$/;

function mentionedCity(words, start) {
  const precededByPlace = CITY_PREPOSITION.test(words[start - 1]);
  for (let end = Math.min(words.length, start + 4); end > start; end--) {
    const candidate = words.slice(start, end).join(' ');
    if (/\d/.test(candidate) || (!precededByPlace && !isInflectedCityName(candidate))) continue;
    const city = canonForInputCity(candidate);
    if (guessCountryCodeFromCity(city)) return { city, end };
  }
  return null;
}

function cityFilterFields(city, locale) {
  const countryCode = guessCountryCodeFromCity(city);
  return { placeType: 'city', city, cityLabel: labelForCanon(city, locale), cityCountryCode: countryCode, countryCode };
}

export function recognizeCategoryAndCity(query, locale, catalog = []) {
  const words = normalize(query).split(/\s+/);
  const category = Object.entries(CATEGORY_WORDS).find(([, pattern]) => pattern.test(words[0]))?.[0] ||
    (EVENT_WORD.test(words[0]) ? 'all' : '');

  const prefix = category ? 1 : 0;
  const prep = CITY_PREPOSITION.test(words[prefix]);
  const cityText = words.slice(prefix + (prep ? 1 : 0)).join(' ');
  const place = matchSearchCity(cityText, { locale, catalog, allowTypo: prep });
  if (!place || !SUPPORTED_COUNTRY_CODES.includes(place.countryCode)) return null;
  return { category: category || 'all', cityLabel: place.label, cityCountryCode: place.countryCode };
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
    Object.assign(filters, cityFilterFields(city, locale));
  }
  return filters;
}
