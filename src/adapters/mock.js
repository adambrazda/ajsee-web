// src/adapters/mock.js
export async function getMockEvents() {
  const mods = import.meta.glob(
    ['../mockEvents.json', '../content/mockEvents.json'],
    { eager: true, import: 'default' }
  );
  const data =
    mods['../mockEvents.json'] ??
    mods['../content/mockEvents.json'] ??
    [];
  return Array.isArray(data) ? data : [];
}

export default getMockEvents;
