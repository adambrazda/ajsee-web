// /src/faq.js
// ---------------------------------------------------------
// AJSEE – FAQ page behavior only
// ---------------------------------------------------------
// Důležité:
// Jazyk, menu, URL a překlady řeší faq-entry.js + i18n.js + nav-core.js.
// Tento soubor už NESMÍ detekovat jazyk, načítat /locales/*.json,
// přepisovat navigaci ani přidávat ?lang= do odkazů.
// Řeší pouze FAQ akordeon a FAQPage JSON-LD podle aktuálního DOM.
// ---------------------------------------------------------

function textFrom(el) {
  return String(el?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function initFaqAccordion() {
  document.querySelectorAll('.faq-question').forEach((btn) => {
    if (btn.dataset.ajseeFaqBound === '1') return;
    btn.dataset.ajseeFaqBound = '1';

    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (!item) return;

      const expanded = btn.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-item').forEach((faq) => {
        faq.classList.remove('open');

        const question = faq.querySelector('.faq-question');
        if (question) question.setAttribute('aria-expanded', 'false');
      });

      if (!expanded) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

function getAnswerForItem(item) {
  if (!item) return '';

  const direct =
    item.querySelector('.faq-answer') ||
    item.querySelector('[data-faq-answer]') ||
    item.querySelector('.faq-response');

  if (direct) return textFrom(direct);

  const question = item.querySelector('.faq-question');
  const clone = item.cloneNode(true);

  clone.querySelectorAll('.faq-question, button, svg').forEach((el) => el.remove());

  const text = textFrom(clone);

  if (question) {
    return text.replace(textFrom(question), '').trim();
  }

  return text;
}

function collectFaqItemsFromDom() {
  return Array.from(document.querySelectorAll('.faq-item'))
    .map((item) => {
      const questionEl =
        item.querySelector('.faq-question') ||
        item.querySelector('[data-faq-question]');

      return {
        question: textFrom(questionEl),
        answer: getAnswerForItem(item)
      };
    })
    .filter((item) => item.question && item.answer);
}

function renderFAQJsonLD() {
  const items = collectFaqItemsFromDom();

  document.querySelectorAll('script[data-faq-jsonld]').forEach((el) => el.remove());

  if (!items.length) return;

  const faqJson = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-faq-jsonld', '1');
  script.textContent = JSON.stringify(faqJson, null, 2);

  document.head.appendChild(script);
}

function scheduleFAQJsonLD() {
  renderFAQJsonLD();

  window.requestAnimationFrame(() => {
    renderFAQJsonLD();
  });

  window.setTimeout(renderFAQJsonLD, 120);
  window.setTimeout(renderFAQJsonLD, 500);
}

function bootFaqBehavior() {
  initFaqAccordion();
  scheduleFAQJsonLD();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootFaqBehavior, { once: true });
} else {
  bootFaqBehavior();
}

window.addEventListener('ajsee:lang-changed', scheduleFAQJsonLD);
window.addEventListener('AJSEE:langChanged', scheduleFAQJsonLD);
window.addEventListener('ajsee:i18n-applied', scheduleFAQJsonLD);
