// netlify/functions/ticketmasterEvents.js

const fetch = require('node-fetch'); // CommonJS zápis, funguje v Netlify Functions

exports.handler = async function(event, context) {
  const params = event.queryStringParameters || {};
  const countryCode = params.countryCode || 'CZ';
  const locale = params.locale || 'cs';
  const keyword = params.keyword || '';
  const API_KEY = 'H7xX6YI5hvXf7agA7ACEjg9aT6iAFmwz';
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?countryCode=${countryCode}&locale=${locale}&apikey=${API_KEY}&keyword=${encodeURIComponent(keyword)}`;

  console.log("[ticketmasterEvents] Calling:", url);

  try {
    const response = await fetch(url);
    const data = await response.text();
    return {
      statusCode: 200,
      body: data,
    };
  } catch (err) {
    console.error("[ticketmasterEvents] Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() }),
    };
  }
};
