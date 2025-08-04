import './styles/main.scss';
import { getAllEvents } from './api/eventsApi.js';

let currentFilters = { category: '', sort: 'date-asc' };
let currentLang = 'cs';
let selectedEvent = null;

// === BEGIN: fixNonBreakingShortWords ===
function fixNonBreakingShortWords(text, lang = 'cs') {
  if (!text || typeof text !== 'string') return text;
  switch (lang) {
    case 'cs': return text.replace(/ ([aAiIkoOsSuUvVzZ]) /g, '\u00a0$1\u00a0');
    case 'sk': return text.replace(/ ([aAiIkoOsSuUvVzZ]) /g, '\u00a0$1\u00a0');
    case 'pl': return text.replace(/ ([aAiIoOuUwWzZ]) /g, '\u00a0$1\u00a0');
    case 'hu': return text.replace(/ ([aAiIsS]) /g, '\u00a0$1\u00a0');
    case 'de':
    case 'en': return text.replace(/ ([aI]) /g, '\u00a0$1\u00a0');
    default: return text;
  }
}
// === END: fixNonBreakingShortWords ===

function detectLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(urlLang)) return urlLang;
  const lang = (navigator.language || 'cs').slice(0, 2).toLowerCase();
  return ['cs', 'en', 'de', 'sk', 'pl', 'hu'].includes(lang) ? lang : 'cs';
}

async function loadTranslations(lang) {
  const resp = await fetch(`/locales/${lang}.json`);
  return await resp.json();
}

async function applyTranslations(lang) {
  const translations = await loadTranslations(lang);

  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    let t = translations[key];
    if (t) {
      if (el.tagName.toLowerCase() === 'p') {
        t = fixNonBreakingShortWords(t, lang);
      }
      if (/<[a-z][\s\S]*>/i.test(t)) el.innerHTML = t;
      else el.textContent = t;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) {
      let placeholder = fixNonBreakingShortWords(translations[key], lang);
      el.placeholder = placeholder;
    }
  });
}

function activateNavLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if ((path === '/' || path.endsWith('index.html')) && (href === '/' || href === '/index.html')) {
      link.classList.add('active');
    } else if (path.endsWith('partners.html') && href.includes('partners')) {
      link.classList.add('active');
    } else if (path.endsWith('about.html') && href.includes('about')) {
      link.classList.add('active');
    } else if (path.endsWith('events.html') && href.includes('events')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
function updateMenuLinksWithLang(lang) {
  document.querySelectorAll('.main-nav a').forEach(link => {
    let href = link.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('http')) return;

    if (href.endsWith('#blog')) {
      href = `/index.html?lang=${lang}#blog`;
    } else if (href.endsWith('#contact')) {
      href = `/index.html?lang=${lang}#contact`;
    } else {
      href = href.replace(/\?lang=[a-z]{2}/, '').replace(/&lang=[a-z]{2}/, '');
      if (href.includes('?')) {
        href = `${href}&lang=${lang}`;
      } else {
        href = `${href}?lang=${lang}`;
      }
    }
    link.setAttribute('href', href);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  currentLang = detectLang();
  updateMenuLinksWithLang(currentLang);
  await applyTranslations(currentLang);
  activateNavLink();

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const lang = btn.dataset.lang;
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.location.href = url.toString();
    });
  });

  document.querySelectorAll('a[href="/events.html"], a.btn-secondary[href="/events.html"]').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = `/events.html?lang=${currentLang}`;
    });
  });

  document.querySelectorAll('a[href="/about.html"], a.btn-secondary[href="/about.html"]').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = `/about.html?lang=${currentLang}`;
    });
  });

  const homeLink = document.querySelector('a[data-i18n-key="nav-home"]');
  if (homeLink) {
    homeLink.addEventListener('click', async function (e) {
      e.preventDefault();
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = `/?lang=${currentLang}`;
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await applyTranslations(currentLang);
      renderEvents(currentLang, currentFilters);
    });
  }

  const hamburger = document.querySelector('.hamburger-btn');
  const nav = document.querySelector('.main-nav');
  const overlay = document.querySelector('.menu-overlay-bg');
  const closeBtn = document.querySelector('.menu-close');

  if (hamburger && nav && overlay && closeBtn) {
    const openMenu = () => {
      nav.classList.add('open');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
      nav.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    hamburger.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);

    document.querySelectorAll('.main-nav a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  const eventsList = document.getElementById('eventsList');
  if (eventsList) {
    await renderEvents(currentLang, currentFilters);

    document.getElementById('events-category-filter')?.addEventListener('change', e => {
      currentFilters.category = e.target.value;
      renderEvents(currentLang, currentFilters);
    });

    document.getElementById('events-sort-filter')?.addEventListener('change', e => {
      currentFilters.sort = e.target.value;
      renderEvents(currentLang, currentFilters);
    });
  }
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('contact-success');
  const errorMsg = document.getElementById('contact-error');

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

  if (form) {
    form.addEventListener('submit', function(e) {
      hideAllFieldErrors(form);
      errorMsg.style.display = "none";

      let currentLang = 'cs';
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang && ['cs','en','de','sk','pl','hu'].includes(urlLang)) {
        currentLang = urlLang;
      }

      form.setAttribute('action', `/thank-you.html?lang=${currentLang}`);

      if (form.querySelector('input[name="bot-field"]')?.value) {
        e.preventDefault();
        return;
      }

      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      let valid = true;
      const t = window.translations || {};
      if (!name) {
        showFieldError(form, 'name', t['contact-error-name'] || 'Zadejte své jméno.');
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError(form, 'email', t['contact-error-email'] || 'Zadejte platný e-mail.');
        valid = false;
      }
      if (!message) {
        showFieldError(form, 'message', t['contact-error-message'] || 'Napište zprávu.');
        valid = false;
      }
      if (!valid) {
        e.preventDefault();
        return;
      }
    });
  }

  const pathname = window.location.pathname.split('/').pop();
  if (pathname === 'partners.html') {
    import('./partners.js');
  }

  const closeBtnModal = document.getElementById('modalClose');
  const modalEl = document.getElementById('eventModal');
  if (closeBtnModal) closeBtnModal.addEventListener('click', closeEventModal);
  if (modalEl) {
    window.addEventListener('click', (e) => {
      if (e.target === modalEl) closeEventModal();
    });
  }
});

async function renderEvents(locale = 'cs', filters = currentFilters) {
  const eventsList = document.getElementById('eventsList');
  if (!eventsList) return;

  try {
    const events = await getAllEvents({ locale, filters });
    const translations = await loadTranslations(locale);

    const fallbackImages = {
      concert: [
        '/images/fallbacks/concert0.jpg',
        '/images/fallbacks/concert1.jpg',
        '/images/fallbacks/concert2.jpg'
      ],
      sport: [
        '/images/fallbacks/sport0.jpg',
        '/images/fallbacks/sport1.jpg'
      ],
      festival: [
        '/images/fallbacks/festival0.jpg',
        '/images/fallbacks/festival1.jpg'
      ],
      theatre: [
        '/images/fallbacks/theatre0.jpg',
        '/images/fallbacks/theatre1.jpg'
      ],
      default: '/images/fallbacks/concert0.jpg'
    };

    function getRandomFallback(category) {
      const imgs = fallbackImages[category] || fallbackImages.default;
      return Array.isArray(imgs)
        ? imgs[Math.floor(Math.random() * imgs.length)]
        : imgs;
    }

    let filtered = [...events];

    filtered.forEach((event, index) => {
      if (!event.id) {
        event.id = `event-${index}-${Math.random().toString(36).substring(2, 8)}`;
      }
    });

    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(e => e.category === filters.category);
    }

    if (filters.sort === 'nearest') {
      filtered.sort((a, b) => new Date(a.datetime || a.date) - new Date(b.datetime || b.date));
    } else if (filters.sort === 'latest') {
      filtered.sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    }

    // === OMEZENÍ NA HOMEPAGE ===
    const isHomepage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
    let showAllLink = false;
    if (isHomepage && filtered.length > 6) {
      filtered = filtered.slice(0, 6);
      showAllLink = true;
    }

    eventsList.innerHTML = filtered.map(event => {
      const title = event.title?.[locale] || event.title?.cs || 'Bez názvu';
      const description = fixNonBreakingShortWords(event.description?.[locale] || event.description?.cs || '', locale);

      const dateVal = event.datetime || event.date;
      const date = dateVal
        ? new Date(dateVal).toLocaleDateString(locale, {
            day: 'numeric', month: 'long', year: 'numeric'
          })
        : '';

      const image = event.image || getRandomFallback(event.category);
      const isDemoDetail = !event.url || event.url.includes('example');
      const isDemoTickets = !event.tickets || event.tickets.includes('example');
      const detailLabel = fixNonBreakingShortWords(translations[isDemoDetail ? 'event-details-demo' : 'event-details'] || 'Zjistit více', locale);
      const ticketLabel = fixNonBreakingShortWords(translations[isDemoTickets ? 'event-tickets-demo' : 'event-tickets'] || 'Vstupenky', locale);

      const cardClasses = ['event-card'];
      if (event.promo) cardClasses.push('event-card-promo');

      return `
        <div class="${cardClasses.join(' ')}">
          <img src="${image}" alt="${title}" class="event-img" />
          <div class="event-content">
            <h3 class="event-title">${title}</h3>
            <p class="event-date">${date}</p>
            <p class="event-description">${description}</p>
            <div class="event-buttons-group">
              ${
                event.partner === 'ticketmaster'
                  ? `<a href="${event.url}" class="btn-event detail" target="_blank" rel="noopener">${detailLabel}</a>`
                  : `<button class="btn-event detail" data-event-id="${event.id}">${detailLabel}</button>`
              }
              ${
                isDemoTickets
                  ? `<span class="btn-event ticket demo">${ticketLabel}</span>`
                  : `<a href="${event.tickets}" class="btn-event ticket" target="_blank">${ticketLabel}</a>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Přidat tlačítko "Zobrazit všechny události" na homepage, pokud bylo oříznuto
    if (isHomepage && showAllLink) {
      eventsList.innerHTML += `
        <div class="events-show-all-btn">
          <a href="/events.html?lang=${locale}" class="btn btn-primary show-all-events-btn">
            ${translations['events-show-all'] || 'Zobrazit všechny události'}
          </a>
        </div>
      `;
    }

    document.querySelectorAll('.btn-event.detail').forEach(button => {
      if (button.tagName.toLowerCase() === 'button') {
        button.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-event-id');
          const eventData = events.find(ev => ev.id === id);
          if (eventData) {
            openEventModal(eventData, locale);
          }
        });
      }
    });

  } catch (e) {
    console.error(e);
    eventsList.innerHTML = '<p>Události nelze načíst. Zkuste to později.</p>';
  }
}

async function openEventModal(eventData, locale = 'cs') {
  const modal = document.getElementById('eventModal');
  if (!modal) {
    console.error('Modal #eventModal nenalezen v DOM!');
    return;
  }

  const titleEl = modal.querySelector('#modalTitle');
  const imageEl = modal.querySelector('#modalImage');
  const dateEl = modal.querySelector('#modalDate');
  const locationEl = modal.querySelector('#modalLocation');
  const descEl = modal.querySelector('#modalDescription');
  const categoryEl = modal.querySelector('#modalCategory');

  if (!titleEl || !imageEl || !dateEl || !locationEl || !descEl || !categoryEl) {
    console.error('Chybí prvek v modalu:', {modal, titleEl, imageEl, dateEl, locationEl, descEl, categoryEl});
    return;
  }

  let translations = {};
  try {
    translations = await loadTranslations(locale);
  } catch (err) {
    console.error('Chyba při načítání překladů:', err);
    translations = {};
  }

  const categoryKey = eventData.category || '';
  const categoryTranslated = fixNonBreakingShortWords(translations[`category-${categoryKey}`] || categoryKey, locale);
  const title = eventData.title?.[locale] || eventData.title?.cs || 'Bez názvu';
  const description = fixNonBreakingShortWords(eventData.description?.[locale] || eventData.description?.cs || '', locale);
  const image = eventData.image || '/images/fallbacks/concert0.jpg';
  const dateVal = eventData.datetime || eventData.date;
  const date = dateVal
    ? new Date(dateVal).toLocaleDateString(locale, {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '';
  const location = eventData.location?.city || eventData.location || '';
  titleEl.textContent = title;
  imageEl.src = image;
  imageEl.alt = title;
  dateEl.textContent = date;
  locationEl.textContent = location;
  descEl.textContent = description;
  categoryEl.textContent = categoryTranslated;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}
