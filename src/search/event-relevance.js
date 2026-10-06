import { matchesKeywordPrefix } from './keyword-match.js';

// This is lexical relevance over available data, not inferred mood or quality.
const GENRE_ALIASES = [
  ['musical', 'muzikal', 'musicals', 'muzikale', 'muzikaly', 'musicalu'],
  ['rock', 'rockovy', 'rockova', 'rockove', 'rockowy', 'rockowa'],
  ['pop', 'popovy', 'popova', 'popove', 'popowy', 'popowa'],
  ['jazz', 'jazzovy', 'jazzova', 'jazzowy', 'dzsessz'],
  ['opera', 'operni', 'opern', 'operowy', 'operna'],
  ['comedy', 'komedie', 'komedia', 'komodie', 'vigjatek']
];

function textValues(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
}

function normalize(value) {
  return textValues(value).join(' ').toLowerCase().normalize('NFKD')
    .replace(/\p{M}+/gu, '').replace(/<[^>]*>/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function terms(value) {
  return normalize(value).split(' ').filter(Boolean).map(token =>
    GENRE_ALIASES.find(aliases => aliases.includes(token))?.[0] || token
  );
}

export function isSoftDiscovery(filters = {}) {
  return filters.searchMode === 'discovery' && filters.keywordMatch === 'soft';
}

export function hasAiRelevance(filters = {}) {
  return filters.sort === 'relevance' &&
    ['exact', 'discovery'].includes(filters.searchMode);
}

// Clear every legacy keyword alias before invoking providers. Otherwise an adapter
// could silently reintroduce a hard filter before the candidates reach ranking.
export function providerSearchFilters(filters = {}) {
  if (!isSoftDiscovery(filters)) return filters;
  return { ...filters, keyword: '', q: '', search: '' };
}

export function createEventRelevanceScorer(filters = {}) {
  const query = normalize(filters.keyword || '');
  const queryTerms = [...new Set(terms(query))];
  const soft = isSoftDiscovery(filters);
  if (!queryTerms.length) return () => 0;

  function overlap(value) {
    const words = new Set(terms(value));
    return queryTerms.filter(word => words.has(word)).length / queryTerms.length;
  }

  return event => {
    // Keep translations separate: joining two titles must not create a phrase match.
    const titles = textValues([event.title, event.titleI18n, event.name]).map(normalize);
    const artists = [event.artists, event.artist, event.production, event.attractions];
    const venue = [event.venue?.name, event.venueName];
    const taxonomy = [event.category, event.categories, event.types, event.genres];
    const description = [event.description, event.descriptionText];
    let score = 0;
    if (titles.some(title => title === query)) score = 100;
    else if (titles.some(title => ` ${title} `.includes(` ${query} `))) score = 60;
    else if (titles.some(title => matchesKeywordPrefix(title, query))) score = 45;

    if (soft) {
      return Math.max(score, 45 * overlap(titles)) +
        25 * overlap(taxonomy) + 20 * overlap(description) +
        30 * overlap(artists) + 10 * overlap(venue);
    }

    if (normalize(artists) && matchesKeywordPrefix(normalize(artists), query)) score = Math.max(score, 80);
    if (normalize(venue) && matchesKeywordPrefix(normalize(venue), query)) score = Math.max(score, 30);
    if (normalize(taxonomy) && matchesKeywordPrefix(normalize(taxonomy), query)) score = Math.max(score, 25);
    if (normalize(description) && matchesKeywordPrefix(normalize(description), query)) score = Math.max(score, 20);
    return score;
  };
}

// Score once per event per batch, not once per comparison. Ties preserve dates
// and stable provider order. Unknown dates sort last.
export function rankEventsByRelevance(events, filters = {}) {
  const score = createEventRelevanceScorer(filters);
  return events.map((event, index) => ({
    event, index, score: score(event),
    date: new Date(event.datetime || event.date || '').getTime()
  })).sort((a, b) => b.score - a.score ||
    ((Number.isFinite(a.date) ? a.date : Infinity) -
     (Number.isFinite(b.date) ? b.date : Infinity)) || a.index - b.index
  ).map(item => item.event);
}

export function syncAiSearchParams(params, filters = {}) {
  if (['exact', 'discovery'].includes(filters.searchMode)) {
    params.set('searchMode', filters.searchMode);
    params.set('keywordMatch', isSoftDiscovery(filters) ? 'soft' : 'strict');
  } else {
    params.delete('searchMode');
    params.delete('keywordMatch');
  }
}

export function readAiSearchParams(params) {
  const searchMode = params.get('searchMode');
  if (searchMode === 'discovery' && params.get('keywordMatch') === 'soft') {
    return { searchMode, keywordMatch: 'soft' };
  }
  if (searchMode === 'exact' && params.get('keywordMatch') === 'strict') {
    return { searchMode, keywordMatch: 'strict' };
  }
  return {};
}

// Editing the keyword field is an explicit conventional keyword search.
export function updateManualKeyword(filters, keyword) {
  if (keyword !== filters.keyword) {
    delete filters.searchMode;
    delete filters.keywordMatch;
    if (filters.sort === 'relevance') filters.sort = 'nearest';
  }
  filters.keyword = keyword;
}
