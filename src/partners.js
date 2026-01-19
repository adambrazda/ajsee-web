// /src/partners.js
// ---------------------------------------------------------
// AJSEE – partners page: i18n, nav links, hero graphic, form UX
// ---------------------------------------------------------

const SUPPORTED_LANGS = ["cs", "en", "de", "sk", "pl", "hu"];
const DEFAULT_LANG = "cs";

function detectLang() {
  const url = new URL(window.location.href);
  const urlLang = url.searchParams.get("lang");
  if (urlLang && SUPPORTED_LANGS.includes(urlLang)) return urlLang;

  const stored = localStorage.getItem("ajsee.lang");
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

  let lang = (navigator.language || DEFAULT_LANG).slice(0, 2).toLowerCase();
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  return lang;
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

async function loadTranslations(lang) {
  let generalTranslations = {};
  try {
    const generalResp = await fetch(`/locales/${lang}.json`, { cache: "no-cache" });
    if (generalResp.ok) generalTranslations = await safeJson(generalResp);
  } catch {}

  let partnerTranslations = {};
  try {
    const resp = await fetch(`/locales/partners-${lang}.json`, { cache: "no-cache" });
    if (resp.ok) partnerTranslations = await safeJson(resp);
  } catch {}

  return { ...generalTranslations, ...partnerTranslations };
}

function setLangUI(lang) {
  document.documentElement.setAttribute("lang", lang);

  document.body.classList.remove(...SUPPORTED_LANGS.map((l) => `lang-${l}`));
  document.body.classList.add(`lang-${lang}`);

  const labelByLang = {
    cs: "Čeština",
    en: "English",
    de: "Deutsch",
    sk: "Slovenčina",
    pl: "Polski",
    hu: "Magyar",
  };

  const flagByLang = {
    cs: "/images/flags/cz.svg",
    en: "/images/flags/gb.svg",
    de: "/images/flags/de.svg",
    sk: "/images/flags/sk.svg",
    pl: "/images/flags/pl.svg",
    hu: "/images/flags/hu.svg",
  };

  document.querySelectorAll(".lang-current-label").forEach((el) => {
    el.textContent = labelByLang[lang] || labelByLang[DEFAULT_LANG];
  });

  document.querySelectorAll(".lang-current-flag").forEach((img) => {
    img.src = flagByLang[lang] || flagByLang[DEFAULT_LANG];
    img.alt = labelByLang[lang] || labelByLang[DEFAULT_LANG];
  });
}

function updateMenuLinksWithLang(lang) {
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const rawHref = link.getAttribute("href");
    if (!rawHref) return;

    if (
      rawHref.startsWith("http") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:")
    ) return;

    let href = rawHref;

    // na partners stránce je správně #partner-contact
    if (href === "#contact" && document.getElementById("partner-contact")) {
      href = "#partner-contact";
    }

    // anchor link (na stejné stránce) → přidáme lang do aktuální URL
    if (href.startsWith("#")) {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      url.hash = href;
      link.setAttribute("href", url.pathname + url.search + url.hash);
      return;
    }

    // normální cesta
    const url = new URL(href, window.location.origin);
    url.searchParams.set("lang", lang);
    link.setAttribute("href", url.pathname + url.search + url.hash);
  });
}

/**
 * Speciální překlad pro headline:
 * - nechceme innerHTML z JSON (bezpečnost)
 * - chceme zachovat <span class="reg">®</span>
 * => přepíšeme jen textový uzel a span necháme
 */
function applyHeadlineTranslation(el, translatedText) {
  if (!el) return;

  // najdi nebo vytvoř ® span
  let reg = el.querySelector(".reg");
  if (!reg) {
    reg = document.createElement("span");
    reg.className = "reg";
    reg.setAttribute("aria-hidden", "true");
    reg.textContent = "®";
  }

  // clear a vlož čistý text + span
  el.textContent = "";
  el.append(document.createTextNode(translatedText));
  el.appendChild(reg);
}

async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  window.translations = translations;

  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key] == null) return;

    // 🔧 SPECIAL CASE: partner-headline
    if (key === "partner-headline") {
      applyHeadlineTranslation(el, translations[key]);
      return;
    }

    el.textContent = translations[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key] != null) el.placeholder = translations[key];
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const key = el.getAttribute("data-i18n-alt");
    if (translations[key] != null) el.setAttribute("alt", translations[key]);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (translations[key] != null) el.setAttribute("aria-label", translations[key]);
  });

  // update <title> (plain text) – přidáme ® natvrdo
  const titleEl = document.querySelector("title[data-i18n-key]");
  if (titleEl) {
    const tKey = titleEl.getAttribute("data-i18n-key");
    if (tKey && translations[tKey] != null) {
      titleEl.textContent = `${translations[tKey]}®`;
    }
  }
}

/**
 * FIX: Na partners.html se dříve aktivoval i "Kontakt", protože po updateMenuLinksWithLang()
 * má href tvar /partners.html?lang=xx#partner-contact a obsahuje "partners".
 * Aktivujeme proto explicitně jen odkaz s data-i18n-key="nav-partners".
 */
function activateNavLink() {
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.classList.remove("active");
    link.removeAttribute("aria-current");
  });

  const partnersLink = document.querySelector('.main-nav a[data-i18n-key="nav-partners"]');
  if (partnersLink) {
    partnersLink.classList.add("active");
    partnersLink.setAttribute("aria-current", "page");
  }
}

function initLanguageButtons() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const chosenLang = btn.dataset.lang;
      if (!SUPPORTED_LANGS.includes(chosenLang)) return;

      localStorage.setItem("ajsee.lang", chosenLang);

      const url = new URL(window.location.href);
      url.searchParams.set("lang", chosenLang);
      window.location.href = url.toString();
    });
  });
}

function initPartnerForm() {
  const form = document.getElementById("partner-contact-form");
  const success = document.getElementById("partner-contact-success");
  const errorBox = document.getElementById("partner-contact-error");
  if (!form) return;

  const t = () => window.translations || {};
  const submitBtn = form.querySelector('button[type="submit"]');
  const fields = ["company", "name", "email", "message"];

  function clearErrors() {
    fields.forEach((name) => {
      const input = form.elements[name];
      const errEl = form.querySelector(`#error-${name}`);
      if (errEl) {
        errEl.textContent = "";
        errEl.classList.remove("active");
      }
      if (input) {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
      }
    });
  }

  function showError(fieldName, msg) {
    const input = form.elements[fieldName];
    const errEl = form.querySelector(`#error-${fieldName}`);
    if (!errEl || !input) return;

    errEl.textContent = msg;
    errEl.classList.add("active");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", errEl.id);
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
    submitBtn.textContent = isLoading
      ? (t()["partner-send-loading"] || "Odesílám…")
      : (t()["partner-send"] || "Odeslat");
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("success") === "1") {
    form.style.display = "none";
    if (success) success.style.display = "block";
    return;
  }

  fields.forEach((name) => {
    const input = form.elements[name];
    if (!input) return;
    input.addEventListener("input", () => {
      const errEl = form.querySelector(`#error-${name}`);
      if (errEl) {
        errEl.textContent = "";
        errEl.classList.remove("active");
      }
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    if (errorBox) errorBox.style.display = "none";

    const honey = form.querySelector('input[name="bot-field"]');
    if (honey?.value) return;

    const company = (form.company?.value || "").trim();
    const name = (form.name?.value || "").trim();
    const email = (form.email?.value || "").trim();
    const message = (form.message?.value || "").trim();

    let valid = true;

    if (!company) {
      showError("company", t()["partner-error-company"] || "Vyplňte název firmy nebo instituce.");
      valid = false;
    }
    if (!name) {
      showError("name", t()["partner-error-name"] || "Zadejte své jméno.");
      valid = false;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email || !emailOk) {
      showError("email", t()["partner-error-email"] || "Zadejte platný e-mail.");
      valid = false;
    }
    if (!message) {
      showError("message", t()["partner-error-message"] || "Napište vzkaz.");
      valid = false;
    }

    if (!valid) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      firstInvalid?.focus?.();
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData(form);
      const body = new URLSearchParams(formData).toString();

      const resp = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html",
        },
        body,
      });

      if (!resp.ok) throw new Error("Submit failed");

      form.style.display = "none";
      if (success) success.style.display = "block";

      const section = document.getElementById("partner-contact") || form.closest("section");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      if (errorBox) {
        errorBox.style.display = "block";
        const p = errorBox.querySelector("p");
        if (p) p.textContent = t()["partner-error-msg"] || "Odeslání se nezdařilo. Zkuste to prosím později.";
        setTimeout(() => (errorBox.style.display = "none"), 4500);
      }
    } finally {
      setLoading(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const lang = detectLang();
  localStorage.setItem("ajsee.lang", lang);

  setLangUI(lang);
  await applyTranslations(lang);

  updateMenuLinksWithLang(lang);
  activateNavLink();
  initLanguageButtons();

  initPartnerForm();
});
