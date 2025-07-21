// /src/faq.js

// --- Detekce a aplikace jazyka, načtení překladů ---
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(urlLang)) return urlLang;
  let lang = (navigator.language || 'cs').slice(0, 2).toLowerCase();
  if (!["cs", "en", "de", "sk", "pl", "hu"].includes(lang)) lang = "cs";
  return lang;
}

// Načti překladový soubor
async function loadTranslations(lang) {
  const resp = await fetch(`/locales/${lang}.json`);
  return await resp.json();
}

// Aplikuj překlady do stránky
async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  window.translations = translations;

  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    if (translations[key]) el.textContent = translations[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) el.placeholder = translations[key];
  });

  // Po každém překladu znovu renderuj FAQ JSON-LD (SEO)
  renderFAQJsonLD();
}

// --- FAQ rozbalování, OPRAVENO pro .open ---
function initFaqAccordion() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const expanded = btn.getAttribute('aria-expanded') === 'true';

      // Zavři všechny ostatní (akordeon styl)
      document.querySelectorAll('.faq-item').forEach(faq => {
        faq.classList.remove('open');
        faq.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      // Pokud nebylo otevřeno, otevři tuto
      if (!expanded) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
      // Pokud bylo otevřeno, vše je zavřeno
    });
  });
}

// --- FAQ JSON-LD (SEO) dynamicky pro aktuální jazyk ---
function renderFAQJsonLD() {
  const translations = window.translations || {};
  // Najdi všechny klíče pro otázky (např. faq-q1, faq-q2, ...)
  const faqKeys = Object.keys(translations).filter(k => /^faq-q\d+$/.test(k));
  if (faqKeys.length === 0) return;

  faqKeys.sort((a, b) => {
    const na = parseInt(a.replace('faq-q', ''), 10);
    const nb = parseInt(b.replace('faq-q', ''), 10);
    return na - nb;
  });

  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqKeys.map(qKey => {
      const aKey = qKey.replace('q', 'a');
      return {
        "@type": "Question",
        "name": translations[qKey],
        "acceptedAnswer": {
          "@type": "Answer",
          "text": translations[aKey] || ""
        }
      };
    })
  };

  // Odstraň předchozí JSON-LD blok (pokud existuje)
  document.querySelectorAll('script[data-faq-jsonld]').forEach(el => el.remove());

  // Vlož nový blok
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-faq-jsonld', '1');
  script.textContent = JSON.stringify(faqJson, null, 2);
  document.head.appendChild(script);
}

// --- Aktivace menu odkazu ---
function activateNavLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if ((path === '/' || path.endsWith('index.html')) && (href === '/' || href === '/index.html')) {
      link.classList.add('active');
    } else if (path.endsWith('faq.html') && href.includes('faq')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// --- Aktualizace menu odkazů s lang parametrem ---
function updateMenuLinksWithLang(lang) {
  document.querySelectorAll('.main-nav a').forEach(link => {
    let href = link.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('http')) return;
    href = href.replace(/\?lang=[a-z]{2}/, '').replace(/&lang=[a-z]{2}/, '');
    if (href.includes('?')) {
      href = `${href}&lang=${lang}`;
    } else {
      href = `${href}?lang=${lang}`;
    }
    link.setAttribute('href', href);
  });
}

// --- INIT (DOM Ready) ---
document.addEventListener('DOMContentLoaded', async () => {
  const lang = detectLang();
  updateMenuLinksWithLang(lang);
  await applyTranslations(lang);
  initFaqAccordion();
  activateNavLink();

  // Jazykové přepínače – reload se správným lang parametrem
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const chosenLang = btn.dataset.lang;
      const url = new URL(window.location.href);
      url.searchParams.set('lang', chosenLang);
      window.location.href = url.toString();
    });
  });
});
