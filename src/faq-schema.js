// One source of truth for schema: the questions and answers actually on the page.
const clean = (node) => String(node?.textContent || '').replace(/\s+/g, ' ').trim();

export function createFaqSchema(doc) {
  const language = ['cs','en','de','sk','pl','hu'].includes(doc.documentElement.lang) ? doc.documentElement.lang : 'cs';
  const url = 'https://ajsee.cz' + (language === 'cs' ? '/faq' : '/' + language + '/faq/');
  const questions = [...doc.querySelectorAll('[data-faq-item]')].map((item) => ({
    '@type': 'Question', name: clean(item.querySelector('[data-faq-question]')),
    acceptedAnswer: { '@type': 'Answer', text: clean(item.querySelector('[data-faq-answer-text]')) },
  })).filter((item) => item.name && item.acceptedAnswer.text);
  return { '@context': 'https://schema.org', '@type': 'FAQPage', '@id': url + '#faq', url,
    inLanguage: language, mainEntity: questions };
}

export function syncFaqSchema(doc) {
  const data = createFaqSchema(doc);
  // Remove any old FAQ graph rather than publishing two conflicting FAQPage entities.
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    if (script.hasAttribute('data-faq-jsonld')) { script.remove(); continue; }
    try {
      const parsed = JSON.parse(script.textContent);
      if (parsed['@type'] === 'FAQPage') script.remove();
      else if (Array.isArray(parsed['@graph'])) {
        parsed['@graph'] = parsed['@graph'].filter((item) => item['@type'] !== 'FAQPage');
        script.textContent = JSON.stringify(parsed).replace(/</g, '\\u003c');
      }
    } catch { /* Unrelated structured data is not changed. */ }
  }
  const script = doc.createElement('script');
  script.type = 'application/ld+json'; script.dataset.faqJsonld = '1';
  script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  doc.head.appendChild(script);
  doc.querySelector('link[rel="canonical"]')?.setAttribute('href', data.url);
  doc.querySelector('meta[property="og:url"]')?.setAttribute('content', data.url);
  const locales = { cs: 'cs_CZ', en: 'en_GB', de: 'de_DE', sk: 'sk_SK', pl: 'pl_PL', hu: 'hu_HU' };
  doc.querySelector('meta[property="og:locale"]')?.setAttribute('content', locales[data.inLanguage]);
  return data;
}
