const supportedLangs = ["cs", "en", "de", "sk", "pl", "hu"];

// Načte JSON s překlady pro daný jazyk
export async function loadTranslations(lang) {
  if (!supportedLangs.includes(lang)) lang = "cs";
  const resp = await fetch(`/src/locales/${lang}.json`);
  return resp.json();
}

// Aplikuje překlady do stránky
export async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key]) el.textContent = translations[key];
  });
}
