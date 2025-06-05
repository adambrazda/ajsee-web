import '../scss/main.scss';

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('nav ul');
  const navLinks = navMenu.querySelectorAll('a');

  hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
    });
  });

  loadEvents();
});

async function loadEvents() {
  const fallbackData = [
    {
      title: "Koncert v Opeře",
      date: "Praha, 25. května 2025",
      linkText: "Více informací",
      linkHref: "#"
    },
    {
      title: "Výstava impresionistů",
      date: "Brno, 2. června 2025",
      linkText: "Zobrazit detail",
      linkHref: "#"
    },
    {
      title: "Letní jazzový festival",
      date: "Ostrava, 10. července 2025",
      linkText: "Zjistit více",
      linkHref: "#"
    }
  ];

  try {
    const response = await fetch('/data/events.json'); // Změň na reálné API
    if (!response.ok) throw new Error('Nedostupné API');

    const events = await response.json();
    renderEvents(events);
  } catch (error) {
    console.warn('Používá se fallback pro události:', error.message);
    renderEvents(fallbackData);
  }
}

function renderEvents(events) {
  const container = document.getElementById('events-container');
  container.innerHTML = '';

  events.forEach(event => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.date}</p>
      <a href="${event.linkHref}">${event.linkText}</a>
    `;
    container.appendChild(card);
  });
}
document.addEventListener('DOMContentLoaded', async () => {
  const response = await fetch('/data/events.json');
  const events = await response.json();
  const container = document.getElementById('events-container');

  events.forEach((event, index) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.date}</p>
      <button class="detail-btn" data-index="${index}">${event.linkText}</button>
    `;
    container.appendChild(card);
  });

  // Modal handling
  const modal = document.getElementById('event-modal');
  const closeBtn = modal.querySelector('.close-button');
  const modalTitle = document.getElementById('modal-title');
  const modalDate = document.getElementById('modal-date');
  const modalLink = document.getElementById('modal-link');

  document.querySelectorAll('.detail-btn').forEach(button => {
    button.addEventListener('click', () => {
      const event = events[button.dataset.index];
      modalTitle.textContent = event.title;
      modalDate.textContent = event.date;
      modalLink.href = event.linkHref;
      modal.classList.remove('hidden');
    });
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach(item => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      item.classList.toggle("active");
    });
  });
});
import './events.js';
