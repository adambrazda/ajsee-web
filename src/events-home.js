// /src/events-home.js
// ---------------------------------------------
// DEPRECATED: sjednoceno v /src/main.js
// Tento soubor je jen shim pro zpětnou kompatibilitu.
// ---------------------------------------------
import './main.js';

if (typeof window !== 'undefined') {
  const G = (window.__ajsee = window.__ajsee || {});
  G.flags = G.flags || {};
  if (!G.flags.eventsHomeShimLogged) {
    G.flags.eventsHomeShimLogged = true;
    try { console.info('[events-home] Using unified entrypoint: /src/main.js'); } catch {}
  }
}
