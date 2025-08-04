// /src/ticketmaster-test.js

import fetch from 'node-fetch';

const API_KEY = 'H7xX6YI5hvXf7agA7ACEjg9aT6iAFmwz';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

async function loadEvents() {
  const url = `${BASE_URL}?countryCode=CZ&locale=cs&apikey=${API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        'Chyba při načítání dat z Ticketmaster API\nStatus: ' +
          res.status +
          '\n' +
          text
      );
    }
    const data = await res.json();

    // Výpis do konzole
    if (data._embedded && data._embedded.events) {
      data._embedded.events.forEach(event => {
        console.log(event.name); // zde je název akce
      });
    } else {
      console.log('Žádné akce nenalezeny.');
    }
  } catch (e) {
    console.error(e);
  }
}

loadEvents();
