import { translations } from './translations.js';

function changeLang(lang) {
  const t = translations[lang] || translations['cs'];

  // Hlavní obsah
  document.getElementById('headline').textContent = t.headline;
  document.getElementById('intro-text').textContent = t.introText;
  document.getElementById('cta-collab').textContent = t.ctaCollab;
  document.getElementById('cta-info').textContent = t.ctaInfo;
  document.getElementById('about-heading').textContent = t.aboutHeading;
  document.getElementById('about-text').textContent = t.aboutText;
  document.getElementById('events-heading').textContent = t.eventsHeading;
  document.getElementById('view-all-events').textContent = t.viewAllEvents;
  document.getElementById('contact-heading').textContent = t.contactHeading;
  document.getElementById('label-name').textContent = t.labelName;
  document.getElementById('label-email').textContent = t.labelEmail;
  document.getElementById('label-message').textContent = t.labelMessage;
  document.getElementById('send-button').textContent = t.sendButton;
  document.getElementById('partners-heading').textContent = t.partnersHeading;
  document.getElementById('faq-heading').textContent = t.faqHeading;

  // FAQ
  const faqQuestions = document.querySelectorAll('.faq-question');
  const faqAnswers = document.querySelectorAll('.faq-answer p');
  if (faqQuestions.length >= 2 && faqAnswers.length >= 2) {
    faqQuestions[0].textContent = t.faqQ1;
    faqAnswers[0].textContent = t.faqA1;
    faqQuestions[1].textContent = t.faqQ2;
    faqAnswers[1].textContent = t.faqA2;
  }

  // Navigace
  const navItems = document.querySelectorAll('.main-nav a');
  if (navItems.length >= 5) {
    navItems[0].textContent = t.navHome;
    navItems[1].textContent = t.navAbout;
    navItems[2].textContent = t.navEvents;
    navItems[3].textContent = t.navContact;
    navItems[4].textContent = t.navPartners;
  }

  // Footer
  const footer = document.querySelector('footer p');
  if (footer) {
    footer.textContent = t.footerText;
  }

  // Nastavit výběr selectu
  const switcher = document.getElementById('lang-switcher');
  if (switcher) switcher.value = lang;
}

// Detekce jazyka uživatele
function detectBrowserLang() {
  const lang = navigator.language || navigator.userLanguage;
  return lang.startsWith('en') ? 'en' : 'cs';
}

document.getElementById('lang-switcher')?.addEventListener('change', e => {
  changeLang(e.target.value);
});

window.addEventListener('DOMContentLoaded', () => {
  const userLang = detectBrowserLang();
  changeLang(userLang);
});
