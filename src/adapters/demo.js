// src/adapters/demo.js
// Dev adaptér pro ukázková data událostí bez dynamických importů (bez Vite warningu).

/**
 * Vrátí pole demo událostí.
 * Preferuje `src/events-demo.json`, fallback na `src/content/events-demo.json`
 * (kvůli zpětné kompatibilitě).
 */
export async function getDemoEvents() {
  // Vite načte matchnuté soubory už při bundlu (eager), vrací rovnou jejich default export.
  const mods = import.meta.glob(
    ['../events-demo.json', '../content/events-demo.json'],
    { eager: true, import: 'default' }
  );

  // Pořadí preference: src/events-demo.json -> src/content/events-demo.json
  const data =
    mods['../events-demo.json'] ??
    mods['../content/events-demo.json'] ??
    [];

  return Array.isArray(data) ? data : [];
}

export default getDemoEvents;
