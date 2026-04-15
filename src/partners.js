// /src/partners.js
// ---------------------------------------------------------
// AJSEE – partners page: i18n, nav links, hero graphic, form UX
// ---------------------------------------------------------

const SUPPORTED_LANGS = ["cs", "en", "de", "sk", "pl", "hu"];
const DEFAULT_LANG = "cs";

function detectLang() {
  try {
    const url = new URL(window.location.href);
    const urlLang = url.searchParams.get("lang");
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) return urlLang;
  } catch {}

  try {
    const stored = localStorage.getItem("ajsee.lang");
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  } catch {}

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

    if (href === "#contact" && document.getElementById("partner-contact")) {
      href = "#partner-contact";
    }

    if (href.startsWith("#")) {
      const url = new URL(window.location.href);

      if (lang === DEFAULT_LANG) {
        url.searchParams.delete("lang");
      } else {
        url.searchParams.set("lang", lang);
      }

      url.hash = href;
      link.setAttribute("href", url.pathname + url.search + url.hash);
      return;
    }

    const url = new URL(href, window.location.origin);

    if (lang === DEFAULT_LANG) {
      url.searchParams.delete("lang");
    } else {
      url.searchParams.set("lang", lang);
    }

    link.setAttribute("href", url.pathname + url.search + url.hash);
  });
}

async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  window.translations = translations;

  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key] == null) return;
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

  document.querySelectorAll("[data-i18n-aria], [data-i18n-aria-label]").forEach((el) => {
    const key =
      el.getAttribute("data-i18n-aria") ||
      el.getAttribute("data-i18n-aria-label");

    if (key && translations[key] != null) {
      el.setAttribute("aria-label", translations[key]);
      el.setAttribute("title", translations[key]);
    }
  });

  const titleEl = document.querySelector("title[data-i18n-key]");
  if (titleEl) {
    const tKey = titleEl.getAttribute("data-i18n-key");
    if (tKey && translations[tKey] != null) {
      titleEl.textContent = translations[tKey];
    }
  }
}

/**
 * Na partners stránce má být aktivní jen "Pro partnery".
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

      try {
        localStorage.setItem("ajsee.lang", chosenLang);
      } catch {}

      const url = new URL(window.location.href);

      if (chosenLang === DEFAULT_LANG) {
        url.searchParams.delete("lang");
      } else {
        url.searchParams.set("lang", chosenLang);
      }

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
        if (p) {
          p.textContent = t()["partner-error-msg"] || "Odeslání se nezdařilo. Zkuste to prosím později.";
        }
        setTimeout(() => {
          errorBox.style.display = "none";
        }, 4500);
      }
    } finally {
      setLoading(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const lang = detectLang();

  try {
    localStorage.setItem("ajsee.lang", lang);
  } catch {}

  setLangUI(lang);
  await applyTranslations(lang);

  updateMenuLinksWithLang(lang);
  activateNavLink();
  initLanguageButtons();
  initPartnerForm();
});