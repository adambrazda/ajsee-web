import COPY from '../../content/event-detail-copy.json' with { type: 'json' };
import { escapeHtml, renderEventDetail, buildEventSchema, dateText, localizeEvent } from '../../scripts/event-detail-pilot.mjs';
import { ORIGIN, detailPath, LANGUAGES, resolveEvent } from './state.js';

export const HEAD_TOKEN = '<!--AJSEE_EVENT_HEAD-->';
export const BODY_TOKEN = '<!--AJSEE_EVENT_BODY-->';

export function renderEventPage(shell, seed, snapshot, { lang = 'cs', now = new Date() } = {}) {
  if (!LANGUAGES.includes(lang) || !shell.includes(HEAD_TOKEN) || !shell.includes(BODY_TOKEN)) throw new Error('Incomplete event page shell');
  const event = resolveEvent(seed, snapshot, now), copy = localizeEvent(event, lang);
  const canonical = ORIGIN + detailPath(event.slug, lang);
  const title = `${event.title} – ${event.venue.city}, ${dateText(event.startDate, lang)} | AJSEE`;
  const e = escapeHtml;
  const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const schema = buildEventSchema(event, { lang, publicPage: true, now });
  const head = `<title>${e(title)}</title><meta name="description" content="${e(copy.introduction)}"><link rel="canonical" href="${e(canonical)}">
    ${LANGUAGES.map(language => `<link rel="alternate" hreflang="${language}" href="${ORIGIN + detailPath(event.slug, language)}">`).join('')}
    <link rel="alternate" hreflang="x-default" href="${ORIGIN + detailPath(event.slug)}">
    <meta property="og:type" content="website"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(copy.introduction)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(event.image.url)}">
    <meta property="og:locale" content="${({ cs: 'cs_CZ', en: 'en_GB', de: 'de_DE', sk: 'sk_SK', pl: 'pl_PL', hu: 'hu_HU' })[lang]}">
    <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(copy.introduction)}"><meta name="twitter:image" content="${e(event.image.url)}">
    <script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': [schema,
      { '@type': 'WebPage', '@id': canonical + '#webpage', url: canonical, name: title, description: copy.introduction, inLanguage: lang, isPartOf: { '@id': ORIGIN + '/#website' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AJSEE', item: ORIGIN + (lang === 'cs' ? '/' : '/' + lang + '/') },
        { '@type': 'ListItem', position: 2, name: COPY[lang].labels.events, item: ORIGIN + (lang === 'cs' ? '/events' : '/' + lang + '/events/') },
        { '@type': 'ListItem', position: 3, name: event.title, item: canonical } ] } ] })}</script>`;
  const names = { cs: 'Čeština', en: 'English', de: 'Deutsch', sk: 'Slovenčina', pl: 'Polski', hu: 'Magyar' };
  const languages = `<details class="detail-languages"><summary aria-label="${e(COPY[lang].labels.languages)}">${names[lang]}</summary><ul>${LANGUAGES.map(language => `<li><a href="${detailPath(event.slug, language)}" lang="${language}" hreflang="${language}"${lang === language ? ' aria-current="true"' : ''}>${names[language]}</a></li>`).join('')}</ul></details>`;
  return shell.replace(HEAD_TOKEN, head).replace('</header>', languages + '</header>').replace(BODY_TOKEN, renderEventDetail(event, { now, lang }));
}
