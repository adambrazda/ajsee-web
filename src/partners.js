// /src/partners.js
// ---------------------------------------------------------
// AJSEE – partners page: form UX only
// ---------------------------------------------------------
// Důležité:
// - Překlady, jazykové přepínání, URL ?lang a menu linky řeší centrálně /src/main.js
//   + /src/utils/lang-dropdown.js.
// - Tento soubor proto NESMÍ znovu navazovat .lang-btn ani dělat window.location.href.
//   Jinak při přepnutí jazyka dojde k reloadu a stránka skočí nahoru.

function getTranslations() {
  return window.translations || {};
}

function tr(key, fallback = "") {
  const translations = getTranslations();
  const value = translations[key];

  if (typeof value === "string" && value.trim()) return value;

  return fallback;
}

/**
 * Na partners stránce má být aktivní jen "Pro partnery".
 * Neřeší jazyk ani navigaci – pouze vizuální/current stav.
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

function initPartnerForm() {
  const form = document.getElementById("partner-contact-form");
  const success = document.getElementById("partner-contact-success");
  const errorBox = document.getElementById("partner-contact-error");

  if (!form) return;

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
      ? tr("partner-send-loading", "Odesílám…")
      : tr("partner-send", "Chci navázat spolupráci");
  }

  const url = new URL(window.location.href);

  if (url.searchParams.get("success") === "1") {
    form.style.display = "none";

    if (success) {
      success.style.display = "block";
    }

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

    if (errorBox) {
      errorBox.style.display = "none";
    }

    const honey = form.querySelector('input[name="bot-field"]');

    if (honey?.value) return;

    const company = (form.company?.value || "").trim();
    const name = (form.name?.value || "").trim();
    const email = (form.email?.value || "").trim();
    const message = (form.message?.value || "").trim();

    let valid = true;

    if (!company) {
      showError(
        "company",
        tr("partner-error-company", "Vyplňte název firmy nebo instituce.")
      );
      valid = false;
    }

    if (!name) {
      showError(
        "name",
        tr("partner-error-name", "Zadejte své jméno.")
      );
      valid = false;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!email || !emailOk) {
      showError(
        "email",
        tr("partner-error-email", "Zadejte platný e-mail.")
      );
      valid = false;
    }

    if (!message) {
      showError(
        "message",
        tr("partner-error-message", "Napište vzkaz.")
      );
      valid = false;
    }

    if (!valid) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      firstInvalid?.focus?.({ preventScroll: false });
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

      if (!resp.ok) {
        throw new Error("Submit failed");
      }

      form.style.display = "none";

      if (success) {
        success.style.display = "block";
      }

      // Tohle je žádoucí jen po skutečném odeslání formuláře.
      // S přepínáním jazyka už tento soubor nijak nepracuje.
      const section = document.getElementById("partner-contact") || form.closest("section");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      if (errorBox) {
        errorBox.style.display = "block";

        const p = errorBox.querySelector("p");

        if (p) {
          p.textContent = tr(
            "partner-error-msg",
            "Odeslání se nezdařilo. Zkuste to prosím později."
          );
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

document.addEventListener("DOMContentLoaded", () => {
  activateNavLink();
  initPartnerForm();
});
