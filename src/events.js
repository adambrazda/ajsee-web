// /src/events.js

export const events = [
  {
    id: 'event-summer-concert',
    title: {
      cs: 'Letní koncert',
      en: 'Summer Concert',
      sk: 'Letný koncert',
      pl: 'Letni koncert'
    },
    description: {
      cs: 'Hudba pod širým nebem.',
      en: 'Open-air music event.',
      sk: 'Hudba pod holým nebom.',
      pl: 'Muzyka na świeżym powietrzu.'
    },
    date: '2025-08-15',
    url: 'https://example.com/detail-koncert',
    tickets: 'https://example.com/tickets-koncert',
    category: 'concert',
    promo: true
  },
  {
    id: 'event-summer-festival',
    title: {
      cs: 'Letní festival',
      en: 'Summer Festival',
      sk: 'Letný festival',
      pl: 'Letni festiwal'
    },
    description: {
      cs: 'Zábava, jídlo a hudba.',
      en: 'Fun, food and music.',
      sk: 'Zábava, jedlo a hudba.',
      pl: 'Zabawa, jedzenie i muzyka.'
    },
    date: '2025-07-22',
    url: 'https://example.com/festival',
    tickets: '',
    category: 'festival',
    promo: false
  }
];

// Stávající funkce pro demo badge
export function showDemoBadge(isDemo) {
  let badge = document.getElementById('demo-badge');
  if (isDemo) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'demo-badge';
      badge.innerHTML = 'Testovací provoz: <b>Demo akce</b>';
      badge.style = 'position:fixed;bottom:18px;left:18px;z-index:99;background:#ffecc3;color:#333;padding:8px 18px;border-radius:10px;box-shadow:0 2px 8px #0001;font-size:1rem;';
      document.body.appendChild(badge);
    } else {
      badge.style.display = 'block';
    }
  } else if (badge) {
    badge.style.display = 'none';
  }
}
