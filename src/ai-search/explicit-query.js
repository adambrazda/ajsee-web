import { normalize } from '../../shared/city/canonical.js';
import { normalizePriceCurrency, parsePriceAmount } from '../event-price.js';
import { recognizeCategoryAndCity } from './fallback-filters.js';
import { createEmptyFilterIntent } from './intent-schema.js';

const MAXIMUM = /(?:do(?: max\.?)?|max\.?|maximalne|nejvyse|nanejvys|nanajvys|najviac|pod|ponizej|do kwoty|up to|at most|under|below|no more than|maximum|bis(?: zu)?|hochstens|unter|legfeljebb)/.source;
const AMOUNT = /(?:\d{1,3}(?:[ .,]\d{3})+|\d+)(?:[.,]\d{1,2})?/.source;
const CURRENCY = /(?:czk|kc|eur|€|gbp|£|usd|pln|zl|huf|ft)/.source;
const PRICE = new RegExp(
  '(?<![\\p{L}\\p{N}])' + MAXIMUM + '\\s+' +
  '(?:(?<prefix>' + CURRENCY + ')\\s*(?<prefixAmount>' + AMOUNT + ')|(?<suffixAmount>' + AMOUNT + ')\\s*(?<suffix>' + CURRENCY + '))' +
  '(?![\\p{L}\\p{N}])',
  'gu'
);
const TOTAL_PRICE = /(?<!\p{L})(?:celkem|celkovo|dohromady|spolu|in total|total budget|altogether|insgesamt|zusammen|lacznie|razem|osszesen|egyutt)(?!\p{L})/u;
const PRICE_ALTERNATIVE = /^\s*(?:[-–—/]|(?:nebo|alebo|or|oder|lub|albo|vagy)(?!\p{L}))/u;
const NEGATED_PRICE = /(?<!\p{L})(?:ne|nie|not|nicht|nem)\s+$/u;

const DATE_PHRASES = {
  cs: {
    today: 'dnes', tomorrow: 'zitra', thisWeek: 'tento tyden', weekend: 'tento vikend|o vikendu',
    thisMonth: 'v tomto mesici|(?:na )?tento mesic',
    nextMonth: 'v pristim mesici|(?:na )?(?:pristi|nasledujici) mesic'
  },
  sk: {
    today: 'dnes', tomorrow: 'zajtra', thisWeek: 'tento tyzden', weekend: 'tento vikend|cez vikend',
    thisMonth: 'v tomto mesiaci|(?:na )?tento mesiac',
    nextMonth: 'v (?:buducom|nasledujucom) mesiaci|(?:na )?(?:buduci|nasledujuci) mesiac'
  },
  en: {
    today: 'today', tomorrow: 'tomorrow', thisWeek: 'this week', weekend: 'this weekend|at the weekend',
    thisMonth: 'this (?:calendar )?month', nextMonth: 'next (?:calendar )?month'
  },
  de: {
    today: 'heute', tomorrow: 'morgen', thisWeek: 'diese woche', weekend: 'dieses wochenende|am wochenende',
    thisMonth: '(?:in diesem|diesen) monat', nextMonth: '(?:im )?(?:nachsten|kommenden) monat'
  },
  pl: {
    today: 'dzis(?:iaj)?', tomorrow: 'jutro', thisWeek: 'w tym tygodniu', weekend: 'w (?:ten )?weekend',
    thisMonth: 'w tym miesiacu', nextMonth: '(?:w|na) (?:przyszlym|przyszly|nastepnym|nastepny) (?:miesiacu|miesiac)'
  },
  hu: {
    today: 'ma', tomorrow: 'holnap', thisWeek: 'ezen a heten', weekend: 'ezen a hetvegen',
    thisMonth: '(?:ebben a|e) honapban', nextMonth: '(?:a )?(?:jovo|kovetkezo) honapban'
  }
};

const SEARCH_PREAMBLE = {
  cs: /^(?:(?:najdi|najdete|ukaz|ukazte) mi|hledam|chci) /,
  sk: /^(?:(?:najdi|ukaz) mi|hladam|chcem) /,
  en: /^(?:(?:find|show) me|i(?:['’]m| am) looking for) (?:an? )?/,
  de: /^(?:(?:finde|zeig) mir|ich suche) (?:ein(?:en|e)? )?/,
  pl: /^(?:(?:znajdz|pokaz) mi|szukam) /,
  hu: /^(?:keresek|mutass) /
};

function findPrice(text) {
  const matches = [...text.matchAll(PRICE)];
  if (matches.length !== 1 || TOTAL_PRICE.test(text)) return null;
  const [match] = matches;
  if (PRICE_ALTERNATIVE.test(text.slice(match.index + match[0].length)) ||
      NEGATED_PRICE.test(text.slice(0, match.index))) return null;

  const { prefix, prefixAmount, suffix, suffixAmount } = match.groups;
  const value = parsePriceAmount(prefixAmount || suffixAmount);
  const currency = normalizePriceCurrency(prefix || suffix);
  return value === null || !currency ? null : { match, value, currency };
}

export function calendarMonthRange(now, offset) {
  // The ISO date before the time is the user's local date, including when the
  // corresponding UTC instant falls in a different month.
  const parts = /^(\d{4})-(\d{2})-\d{2}(?=T|$)/.exec(now);
  if (!parts) return null;
  const [, year, month] = parts;
  const from = new Date(0);
  from.setUTCFullYear(Number(year), Number(month) - 1 + offset, 1);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function findDate(text, locale, now) {
  const matches = Object.entries(DATE_PHRASES[locale] || {}).flatMap(([preset, phrase]) => {
    const pattern = new RegExp('(?<![\\p{L}\\p{N}])(?:' + phrase + ')(?![\\p{L}\\p{N}])', 'gu');
    return [...text.matchAll(pattern)].map(match => ({ match, preset }));
  });
  if (matches.length !== 1) return null;
  const [{ match, preset }] = matches;
  if (preset === 'thisMonth' || preset === 'nextMonth') {
    const range = calendarMonthRange(now, preset === 'nextMonth' ? 1 : 0);
    return range ? { match, date: { type: 'range', preset: '', ...range } } : null;
  }
  return { match, date: { type: 'preset', preset, from: '', to: '' } };
}

export function readExplicitEventQuery({ query, locale, now }) {
  let text = normalize(query).replace(/\s+/gu, ' ');
  const price = findPrice(text);
  const date = findDate(text, locale, now);
  const priceLimit = price ? { type: 'max_price', value: price.value, currency: price.currency, unit: '' } : null;
  if (!price && !date) return { priceLimit, intent: null };

  // Use the deterministic interpretation only when every part of the request
  // is understood. Artist names, narrower date ranges and other modifiers go
  // to the model along with the complete query.
  const spans = [price?.match, date?.match].filter(Boolean).sort((a, b) => b.index - a.index);
  for (const match of spans) {
    text = text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length);
  }
  const core = text.trimStart().replace(SEARCH_PREAMBLE[locale] || /$^/, '').replace(/[,.?!\s]+$/u, '');
  const selection = recognizeCategoryAndCity(core, locale);
  if (!selection) return { priceLimit, intent: null };

  const intent = createEmptyFilterIntent(locale);
  intent.category = selection.category;
  intent.place = { type: 'city', label: selection.cityLabel, countryCode: selection.cityCountryCode, nearby: false, radiusKm: null };
  intent.sort = 'relevance';
  intent.searchMode = 'discovery';
  intent.keywordMatch = 'soft';
  if (date) intent.date = date.date;
  if (priceLimit) intent.unsupportedPreferences.push(priceLimit);
  return { priceLimit, intent };
}
