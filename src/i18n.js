const supportedLangs = ["cs", "en", "de", "sk", "pl", "hu"];

// Detekce jazyka z URL nebo prohlížeče
export function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get("lang");
  if (urlLang && supportedLangs.includes(urlLang)) return urlLang;

  const navLang = (navigator.language || "cs").slice(0, 2).toLowerCase();
  if (supportedLangs.includes(navLang)) return navLang;

  return "cs";
}

// Načtení JSON překladů – hybridně: nejprve sekce (např. "about"), fallback do root JSON (např. cs.json)
export async function loadTranslations(lang, section = null) {
  if (!supportedLangs.includes(lang)) lang = "cs";

  let translations = {};
  let sectionLoaded = false;

  if (section) {
    try {
      const sectionResp = await fetch(`/locales/${lang}/${section}.json`);
      if (sectionResp.ok) {
        const sectionData = await sectionResp.json();
        translations = sectionData[lang] || {};
        sectionLoaded = true;
      }
    } catch (e) {
      console.warn(`⚠️ Nepodařilo se načíst sekci: /locales/${lang}/${section}.json`);
    }
  }

  // Fallback do základního JSON jen pokud není sekce, nebo v ní něco chybí
  try {
    const rootResp = await fetch(`/locales/${lang}.json`);
    if (rootResp.ok) {
      const rootData = await rootResp.json();
      translations = {
        ...rootData,
        ...translations // Sekce má přednost
      };
    }
  } catch (e) {
    console.error("❌ Chyba při načítání root překladů:", e);
  }

  return translations;
}

// Získání hodnoty z vnořeného objektu pomocí klíče s tečkami (např. about.story.p1.a)
function getNestedValue(obj, key) {
  return key.split(".").reduce((o, i) => (o ? o[i] : null), obj);
}

// Aplikace překladů do DOM
export async function applyTranslations(lang, section = null) {
  const translations = await loadTranslations(lang, section);

  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    const value = getNestedValue(translations, key);

    if (value !== null && value !== undefined) {
      // Pokud hodnota obsahuje HTML, použij innerHTML
      if (/<[a-z][\s\S]*>/i.test(value)) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }
  });
}

// Volání ručně (např. po změně jazyka)
// const lang = detectLang();
// applyTranslations(lang, "about");
