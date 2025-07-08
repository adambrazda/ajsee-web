import './styles/main.scss';
import { events, showDemoBadge } from './events.js';
import { getAllEvents } from './api/eventsApi.js';

let currentFilters = { category: '', sort: 'date-asc' };
let currentLang = 'cs';
let selectedEvent = null;

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
    const t = translations[key];
    if (t) {
      if (/<[a-z][\s\S]*>/i.test(t)) el.innerHTML = t;
      else el.textContent = t;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) el.placeholder = translations[key];
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

document.addEventListener('DOMContentLoaded', async () => {
  currentLang = detectLang();
  await applyTranslations(currentLang);
  activateNavLink();

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentLang = btn.dataset.lang;
      const url = new URL(window.location);
      url.searchParams.set('lang', currentLang);
      history.replaceState({}, '', url);
      await applyTranslations(currentLang);
      renderEvents(currentLang, currentFilters);
    });
  });

  // Přidáno - ODKAZY NA EVENTS
  document.querySelectorAll('a[href="/events.html"], a.btn-secondary[href="/events.html"]').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = `/events.html?lang=${currentLang}`;
    });
  });

  // Již existující přesměrování o nás (ponechávám):
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
  form.addEventListener('submit', e => {
    e.preventDefault();
    hideAllFieldErrors(form);
    errorMsg.style.display = "none";

    // Honeypot antispam
    if (form.querySelector('input[name="bot-field"]')?.value) return;

    // Pole
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
    if (!valid) return;

    // Odeslání přes Netlify AJAX
    const formData = new FormData(form);
    fetch('/', {
      method: 'POST',
      headers: { 'Accept': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    })
      .then(() => {
        form.style.display = 'none';
        successMsg.style.display = 'block';
        // Posuň na kontakt
        const contactSection = document.getElementById('contact');
        if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth' });
      })
      .catch(() => {
        errorMsg.style.display = 'block';
        errorMsg.querySelector("p").textContent =
          t["contact-error-msg"] || "Odeslání se nezdařilo. Zkuste to prosím později.";
        setTimeout(() => (errorMsg.style.display = "none"), 4000);
      });
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

// ... (dál už žádné změny nejsou potřeba, zbytek kódu ponech, vše ostatní je správně)
// Načti a zobraz události
async function renderEvents(locale = 'cs', filters = currentFilters) {
  const eventsList = document.getElementById('eventsList');
  if (!eventsList) return;
  if (!Array.isArray(events)) return;

  try {
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
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (filters.sort === 'latest') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    eventsList.innerHTML = filtered.map(event => {
      const title = event.title?.[locale] || event.title?.cs || 'Bez názvu';
      const description = event.description?.[locale] || event.description?.cs || '';
      const date = new Date(event.date).toLocaleDateString(locale, {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const image = event.image || getRandomFallback(event.category);
      const isDemoDetail = !event.url || event.url.includes('example');
      const isDemoTickets = !event.tickets || event.tickets.includes('example');
      const detailLabel = translations[isDemoDetail ? 'event-details-demo' : 'event-details'] || 'Zjistit více';
      const ticketLabel = translations[isDemoTickets ? 'event-tickets-demo' : 'event-tickets'] || 'Vstupenky';

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
              <button class="btn-event detail" data-event-id="${event.id}">${detailLabel}</button>
              ${isDemoTickets
                ? `<span class="btn-event ticket demo">${ticketLabel}</span>`
                : `<a href="${event.tickets}" class="btn-event ticket" target="_blank">${ticketLabel}</a>`}
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-event.detail').forEach(button => {
      button.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-event-id');
        const eventData = events.find(ev => ev.id === id);
        if (eventData) {
          openEventModal(eventData, locale);
        }
      });
    });

  } catch (e) {
    console.error(e);
    eventsList.innerHTML = '<p>Události nelze načíst. Zkuste to později.</p>';
  }
}

  console.log('Přidána tlačítka .btn-event.detail:', document.querySelectorAll('.btn-event.detail'));
async function openEventModal(eventData, locale = 'cs') {
  const modal = document.getElementById('eventModal');
  if (!modal) {
    console.error('Modal #eventModal nenalezen v DOM!');
    return;
  }

  // Najdi prvky relativně k modalu
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
  const categoryTranslated = translations[`category-${categoryKey}`] || categoryKey; // <-- AŽ TADY!

  const title = eventData.title?.[locale] || eventData.title?.cs || 'Bez názvu';
  const description = eventData.description?.[locale] || '';
  const location = eventData.location?.[locale] || translations['unknown-location'] || 'Neznámé místo';
  const dateObj = new Date(eventData.date);
  const dateFormatted = dateObj.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  titleEl.textContent = title;
  imageEl.src = eventData.image || '/images/fallbacks/concert0.jpg';
  imageEl.alt = title;
  dateEl.textContent = dateFormatted;
  locationEl.textContent = location;
  descEl.textContent = description;
  categoryEl.textContent = categoryTranslated;

  // Kalendářové odkazy
  const googleLink = modal.querySelector('#googleCalendarLink');
  const outlookLink = modal.querySelector('#outlookCalendarLink');
  const appleLink = modal.querySelector('#appleCalendarLink');

  const startISO = dateObj.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const endDate = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000);
  const endISO = endDate.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const dates = `${startISO}/${endISO}`;
  const encTitle = encodeURIComponent(title);
  const encDesc = encodeURIComponent(description);
  const encLoc = encodeURIComponent(location);

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encTitle}&dates=${dates}&details=${encDesc}&location=${encLoc}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encTitle}&startdt=${dateObj.toISOString()}&enddt=${endDate.toISOString()}&body=${encDesc}&location=${encLoc}`;
  const appleUrl = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${title}\nDESCRIPTION:${description}\nLOCATION:${location}\nDTSTART:${startISO}\nDTEND:${endISO}\nEND:VEVENT\nEND:VCALENDAR`;
  const appleBlob = new Blob([appleUrl], { type: 'text/calendar' });
  const appleICSUrl = URL.createObjectURL(appleBlob);

  if (googleLink) googleLink.href = googleUrl;
  if (outlookLink) outlookLink.href = outlookUrl;
  if (appleLink) {
    appleLink.href = appleICSUrl;
    appleLink.download = 'event.ics';
  }

  // Otevři modal
  modal.classList.remove('hidden');
  modal.classList.add('visible');
}
// Funkce pro zavření modálního okna
function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.classList.remove('visible');
    modal.classList.add('hidden');
  }
}

// Zavírání modalu klávesou ESC
function handleModalEsc(e) {
  const modal = document.getElementById('eventModal');
  if (e.key === 'Escape' && modal && modal.classList.contains('visible')) {
    closeEventModal();
  }
}
document.addEventListener('keydown', handleModalEsc);
