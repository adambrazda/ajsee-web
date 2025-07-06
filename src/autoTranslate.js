// /src/autoTranslate.js

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Překlad přes OpenAI (ochrana proti prázdnému textu i krátkým textům)
async function translateWithOpenAI(text, targetLang = "en") {
  if (!text?.trim() || targetLang === "cs") return text;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Jsi profesionální překladatel webových stránek. Překládej stručně, nikdy nevysvětluj, pouze vrať překlad bez vysvětlivek a udržuj formátování. Nikdy nepiš žádné úvodní věty, pouze překlad!"
          },
          {
            role: "user",
            content: `Přelož do jazyka ${targetLang}: ${text}`
          }
        ]
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.warn("Překlad selhal:", err);
    return text;
  }
}

// Přelož vše, co má atribut data-i18n-key
export async function translatePage(targetLang = "en") {
  const elements = document.querySelectorAll("[data-i18n-key]");
  for (const el of elements) {
    // Pro každý element ulož původní text pro možnost návratu k češtině
    const original = el.dataset.i18nOriginal || el.textContent;
    if (!el.dataset.i18nOriginal) el.dataset.i18nOriginal = original;

    // Pokud je zvolen čeština, vrať původní text
    if (targetLang === "cs") {
      el.textContent = el.dataset.i18nOriginal;
      continue;
    }

    // Zobraz loading placeholder během překladu
    el.textContent = "...";
    const translated = await translateWithOpenAI(original, targetLang);
    el.textContent = translated;
  }
}
