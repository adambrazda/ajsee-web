// /src/partners.js

// 1. Překlady
async function loadTranslations(lang) {
  const resp = await fetch(`/src/locales/partners-${lang}.json`);
  return await resp.json();
}

async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  window.translations = translations; // Pro error hlášky v JS
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key]) el.textContent = translations[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key]) el.placeholder = translations[key];
  });
}

// 2. Aktivní navigace
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

// 3. Detekce jazyka
function detectLang() {
  let lang = (navigator.language || 'cs').slice(0, 2).toLowerCase();
  if (!["cs", "en", "de", "sk", "pl", "hu"].includes(lang)) lang = "cs";
  return lang;
}

// 4. Error helpery (jen jednou!)
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

// 5. Hlavní DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  // Překlady a jazyk
  let lang = detectLang();
  await applyTranslations(lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener("click", async () => {
      const chosenLang = btn.dataset.lang;
      await applyTranslations(chosenLang);
    });
  });
// PARTNER FORM LOGIKA
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

    // Získání hodnot
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

    // Odeslat do Netlify AJAX
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
  // Aktivní link
  activateNavLink();
});

// 6. Hamburger menu (jen jednou!)
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger-btn');
  const navUl = document.querySelector('.main-nav ul');
  if (hamburger && navUl) {
    hamburger.addEventListener('click', () => {
      navUl.classList.toggle('open');
    });
    navUl.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navUl.classList.remove('open'));
    });
  }
});
