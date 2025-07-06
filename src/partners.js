// /src/partners.js

async function loadTranslations(lang) {
  const resp = await fetch(`/src/locales/partners-${lang}.json`);
  return await resp.json();
}

async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const key = el.getAttribute("data-i18n-key");
    if (translations[key]) el.textContent = translations[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key]) el.placeholder = translations[key];
  });
}

// --- Zvýraznění aktivní položky v menu ---
function activateNavLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href');
    // Hlavní stránka
    if ((path === '/' || path.endsWith('index.html')) && (href === '/' || href === '/index.html')) {
      link.classList.add('active');
    } 
    // Partnerská stránka
    else if (path.endsWith('partners.html') && href.includes('partners')) {
      link.classList.add('active');
      // Skryj „Pro partnery“ na partnerské stránce:
      // link.style.display = "none";
    } else {
      link.classList.remove('active');
    }
  });
}

function detectLang() {
  let lang = (navigator.language || 'cs').slice(0, 2).toLowerCase();
  if (!["cs", "en", "de", "sk", "pl", "hu"].includes(lang)) lang = "cs";
  return lang;
}

document.addEventListener('DOMContentLoaded', async () => {
  let lang = detectLang();
  await applyTranslations(lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener("click", async () => {
      const chosenLang = btn.dataset.lang;
      await applyTranslations(chosenLang);
    });
  });

  // Potvrzení formuláře
  const contactForm = document.getElementById('partner-contact-form');
  const contactSuccess = document.getElementById('partner-contact-success');
  if (contactForm) {
    contactForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const formData = new FormData(contactForm);
      fetch('/', {
        method: 'POST',
        headers: { 'Accept': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      })
      .then(() => {
        contactForm.style.display = 'none';
        contactSuccess.style.display = 'block';
      })
      .catch(() => {
        alert('Došlo k chybě při odeslání. Zkuste to prosím později.');
      });
    });
  }

  // Aktivace active linku
  activateNavLink();
});

// Hamburger menu
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger-btn');
  const navUl = document.querySelector('.main-nav ul');
  if (hamburger && navUl) {
    hamburger.addEventListener('click', () => {
      navUl.classList.toggle('open');
    });
    // Skryj menu po kliknutí na odkaz (lepší UX)
    navUl.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navUl.classList.remove('open'));
    });
  }
});
