// /src/partners.js

// 1. Detekce jazyka z URL, fallback na browser, pak CS
function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(urlLang)) return urlLang;
  let lang = (navigator.language || 'cs').slice(0, 2).toLowerCase();
  if (!["cs", "en", "de", "sk", "pl", "hu"].includes(lang)) lang = "cs";
  return lang;
}

// 2. Načti obecné i partnerské překlady, partnerské přepisují obecné
async function loadTranslations(lang) {
  // Obecné překlady (hlavní web)
  const generalResp = await fetch(`/locales/${lang}.json`);
  const generalTranslations = await generalResp.json();

  // Partnerské překlady (jen pro tuto stránku, mohou být prázdné)
  let partnerTranslations = {};
  try {
    const resp = await fetch(`/locales/partners-${lang}.json`);
    if (resp.ok) partnerTranslations = await resp.json();
  } catch (e) {
    // Pokud partnerský překlad neexistuje, ignoruj chybu
  }
  // Partner klíče přepisují obecné
  return { ...generalTranslations, ...partnerTranslations };
}

// 3. Aktualizace menu odkazů s jazykem
function updateMenuLinksWithLang(lang) {
  document.querySelectorAll('.main-nav a').forEach(link => {
    let href = link.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('http')) return;
    // Odeber starý lang param
    href = href.replace(/\?lang=[a-z]{2}/, '').replace(/&lang=[a-z]{2}/, '');
    // Přidej nový lang param
    if (href.includes('?')) {
      href = `${href}&lang=${lang}`;
    } else {
      href = `${href}?lang=${lang}`;
    }
    link.setAttribute('href', href);
  });
}

// 4. Překlady pro textContent a placeholdery
async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  window.translations = translations;

  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key]) el.textContent = translations[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key]) el.placeholder = translations[key];
  });
}

// 5. Zvýraznění aktivního odkazu v menu
function activateNavLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if ((path === '/' || path.endsWith('index.html')) && (href === '/' || href === '/index.html')) {
      link.classList.add('active');
    } else if (path.endsWith('partners.html') && href.includes('partners')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// 6. Po načtení DOM
document.addEventListener('DOMContentLoaded', async () => {
  let lang = detectLang();
  await applyTranslations(lang);
  updateMenuLinksWithLang(lang);
  activateNavLink();

  // Klik na jazykový přepínač = reload se správným parametrem
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const chosenLang = btn.dataset.lang;
      const url = new URL(window.location.href);
      url.searchParams.set('lang', chosenLang);
      window.location.href = url.toString();
    });
  });

  // PARTNER FORM LOGIKA (převzato, mírně refaktorováno)
  const contactForm = document.getElementById('partner-contact-form');
  const contactSuccess = document.getElementById('partner-contact-success');
  const contactError = document.getElementById('partner-contact-error');

  function hideAllFieldErrors(form) {
    form.querySelectorAll('.form-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('active');
    });
  }
  function showFieldError(form, fieldName, msg) {
    const errEl = form.querySelector(`#error-${fieldName}`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('active');
    }
  }

  if (contactForm) {
    contactForm.addEventListener('submit', function(event) {
      event.preventDefault();
      hideAllFieldErrors(contactForm);
      contactError.style.display = "none";

      // Antispam honeypot
      if (contactForm.querySelector('input[name="bot-field"]')?.value) return;

      // Hodnoty
      const company = contactForm.company.value.trim();
      const name = contactForm.name.value.trim();
      const email = contactForm.email.value.trim();
      const message = contactForm.message.value.trim();

      let valid = true;
      const t = window.translations || {};

      if (!company) {
        showFieldError(contactForm, 'company', t['partner-error-company'] || 'Vyplňte název firmy nebo instituce.');
        valid = false;
      }
      if (!name) {
        showFieldError(contactForm, 'name', t['partner-error-name'] || 'Zadejte své jméno.');
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError(contactForm, 'email', t['partner-error-email'] || 'Zadejte platný e-mail.');
        valid = false;
      }
      if (!message) {
        showFieldError(contactForm, 'message', t['partner-error-message'] || 'Napište vzkaz.');
        valid = false;
      }
      if (!valid) return;

      // Odeslání na Netlify (AJAX)
      const formData = new FormData(contactForm);
      fetch('/', {
        method: 'POST',
        headers: { 'Accept': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      })
        .then(() => {
          contactForm.style.display = 'none';
          contactSuccess.style.display = 'block';
          // Posuň stránku na sekci #partner-contact, pokud existuje
          const section = document.getElementById('partner-contact') || contactForm.closest('section');
          if (section) section.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(() => {
          contactError.style.display = "block";
          contactError.querySelector("p").textContent =
            t["partner-error-msg"] || "Odeslání se nezdařilo. Zkuste to prosím později.";
          setTimeout(() => (contactError.style.display = "none"), 4000);
        });
    });
  }
});
