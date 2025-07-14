const supportedLangs = ["cs", "en", "de", "sk", "pl", "hu"];

// Načte JSON s překlady pro daný jazyk
export async function loadTranslations(lang) {
  if (!supportedLangs.includes(lang)) lang = "cs";
  let resp = await fetch('/locales/' + lang + '.json'); // relativní cesta!
  console.log("Loading translations for lang:", lang, resp);
  if (!resp.ok) {
    // Fallback na češtinu
    resp = await fetch('/locales/cs.json');
  }
  return resp.json();
}

// Aplikuje překlady do stránky
export async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key]) {
      // Pokud je překlad HTML, použij innerHTML. Jinak textContent.
      if (/<[a-z][\s\S]*>/i.test(translations[key])) {
        el.innerHTML = translations[key];
      } else {
        el.textContent = translations[key];
      }
    }
  });
}
export function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && supportedLangs.includes(urlLang)) return urlLang;
  const navLang = (navigator.language || 'cs').slice(0,2).toLowerCase();
  if (supportedLangs.includes(navLang)) return navLang;
  return 'cs';
}
window.applyTranslations = applyTranslations;
window.detectLang = detectLang;
