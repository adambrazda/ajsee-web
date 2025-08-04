// netlify/functions/ticketmasterEvents.js

import fetch from 'node-fetch';

export async function handler(event, context) {
  const params = event.queryStringParameters || {};
  const countryCode = params.countryCode || 'CZ';
  const locale = params.locale || 'cs';
  const keyword = params.keyword || '';
  const API_KEY = 'H7xX6YI5hvXf7agA7ACEjg9aT6iAFmwz';
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?countryCode=${countryCode}&locale=${locale}&apikey=${API_KEY}&keyword=${encodeURIComponent(keyword)}`;

  // Debug logy pro Netlify Log
  console.log("[ticketmasterEvents] Calling:", url);

  try {
    const response = await fetch(url);
    const data = await response.text(); // nebo response.json(), viz potřeba
    return {
      statusCode: 200,
      body: data,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (err) {
    console.error("[ticketmasterEvents] Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
}
