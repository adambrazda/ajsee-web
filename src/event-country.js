import { SUPPORTED_COUNTRY_CODES } from './city/canonical.js';

// Shared country labels and aliases preserve the Events page contract.
function foldPlaceText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COUNTRY_LABELS = {
  CZ: { cs: 'Česko', en: 'Czechia', de: 'Tschechien', sk: 'Česko', pl: 'Czechy', hu: 'Csehország' },
  SK: { cs: 'Slovensko', en: 'Slovakia', de: 'Slowakei', sk: 'Slovensko', pl: 'Słowacja', hu: 'Szlovákia' },
  PL: { cs: 'Polsko', en: 'Poland', de: 'Polen', sk: 'Poľsko', pl: 'Polska', hu: 'Lengyelország' },
  HU: { cs: 'Maďarsko', en: 'Hungary', de: 'Ungarn', sk: 'Maďarsko', pl: 'Węgry', hu: 'Magyarország' },
  DE: { cs: 'Německo', en: 'Germany', de: 'Deutschland', sk: 'Nemecko', pl: 'Niemcy', hu: 'Németország' },
  AT: { cs: 'Rakousko', en: 'Austria', de: 'Österreich', sk: 'Rakúsko', pl: 'Austria', hu: 'Ausztria' },
  CH: { cs: 'Švýcarsko', en: 'Switzerland', de: 'Schweiz', sk: 'Švajčiarsko', pl: 'Szwajcaria', hu: 'Svájc' },
  GB: { cs: 'Velká Británie', en: 'United Kingdom', de: 'Vereinigtes Königreich', sk: 'Veľká Británia', pl: 'Wielka Brytania', hu: 'Egyesült Királyság' },
  IE: { cs: 'Irsko', en: 'Ireland', de: 'Irland', sk: 'Írsko', pl: 'Irlandia', hu: 'Írország' },
  FR: { cs: 'Francie', en: 'France', de: 'Frankreich', sk: 'Francúzsko', pl: 'Francja', hu: 'Franciaország' },
  NL: { cs: 'Nizozemsko', en: 'Netherlands', de: 'Niederlande', sk: 'Holandsko', pl: 'Holandia', hu: 'Hollandia' },
  BE: { cs: 'Belgie', en: 'Belgium', de: 'Belgien', sk: 'Belgicko', pl: 'Belgia', hu: 'Belgium' },
  IT: { cs: 'Itálie', en: 'Italy', de: 'Italien', sk: 'Taliansko', pl: 'Włochy', hu: 'Olaszország' },
  ES: { cs: 'Španělsko', en: 'Spain', de: 'Spanien', sk: 'Španielsko', pl: 'Hiszpania', hu: 'Spanyolország' },
  DK: { cs: 'Dánsko', en: 'Denmark', de: 'Dänemark', sk: 'Dánsko', pl: 'Dania', hu: 'Dánia' },
  SE: { cs: 'Švédsko', en: 'Sweden', de: 'Schweden', sk: 'Švédsko', pl: 'Szwecja', hu: 'Svédország' },
  FI: { cs: 'Finsko', en: 'Finland', de: 'Finnland', sk: 'Fínsko', pl: 'Finlandia', hu: 'Finnország' },
  NO: { cs: 'Norsko', en: 'Norway', de: 'Norwegen', sk: 'Nórsko', pl: 'Norwegia', hu: 'Norvégia' }
};

const COUNTRY_ALIASES = Object.create(null);

function addCountryAliases(code, aliases) {
  const cc = String(code || '').trim().toUpperCase();
  if (!SUPPORTED_COUNTRY_CODES.has(cc)) return;

  for (const alias of aliases) {
    const key = foldPlaceText(alias);
    if (key) COUNTRY_ALIASES[key] = cc;
  }
}

addCountryAliases('CZ', ['CZ', 'Czechia', 'Czech Republic', 'Česko', 'Cesko', 'Česká republika', 'Ceska republika', 'Czechy', 'Tschechien']);

addCountryAliases('SK', ['SK', 'Slovakia', 'Slovensko', 'Slovenská republika', 'Slovenska republika']);

addCountryAliases('PL', ['PL', 'Poland', 'Polsko', 'Polska']);

addCountryAliases('HU', ['HU', 'Hungary', 'Maďarsko', 'Madarsko', 'Magyarország', 'Magyarorszag', 'Węgry', 'Wegry', 'Ungarn']);

addCountryAliases('DE', ['DE', 'Germany', 'Německo', 'Nemecko', 'Deutschland', 'Niemcy', 'Germania']);

addCountryAliases('AT', ['AT', 'Austria', 'Rakousko', 'Rakúsko', 'Rakouska', 'Österreich', 'Osterreich']);

addCountryAliases('CH', ['CH', 'Switzerland', 'Švýcarsko', 'Svycarsko', 'Švajčiarsko', 'Szwajcaria', 'Schweiz', 'Suisse', 'Svizzera']);

addCountryAliases('GB', ['GB', 'UK', 'United Kingdom', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Velká Británie', 'Velka Britanie', 'Spojené království', 'Spojene kralovstvi', 'Anglie', 'Wielka Brytania', 'Egyesült Királyság']);

addCountryAliases('IE', ['IE', 'Ireland', 'Irsko', 'Írsko', 'Irlandia', 'Éire', 'Eire']);

addCountryAliases('FR', ['FR', 'France', 'Francie', 'Francúzsko', 'Francuzsko', 'Francja', 'Franciaország', 'Franciaorszag', 'Francia', 'Frankreich']);

addCountryAliases('NL', ['NL', 'Netherlands', 'The Netherlands', 'Nizozemsko', 'Holandsko', 'Holandia', 'Nederland', 'Holland', 'Niederlande']);

addCountryAliases('BE', ['BE', 'Belgium', 'Belgie', 'Belgicko', 'Belgia', 'Belgique', 'België', 'Belgien']);

addCountryAliases('IT', ['IT', 'Italy', 'Itálie', 'Italie', 'Taliansko', 'Włochy', 'Wlochy', 'Italia', 'Italien']);

addCountryAliases('ES', ['ES', 'Spain', 'Španělsko', 'Spanelsko', 'Španielsko', 'Spanielsko', 'Hiszpania', 'España', 'Espana', 'Spanien']);

addCountryAliases('DK', ['DK', 'Denmark', 'Dánsko', 'Dansko', 'Dania', 'Danmark', 'Dänemark']);

addCountryAliases('SE', ['SE', 'Sweden', 'Švédsko', 'Svedsko', 'Szwecja', 'Sverige', 'Schweden']);

addCountryAliases('FI', ['FI', 'Finland', 'Finsko', 'Fínsko', 'Finlandia', 'Suomi', 'Finnland']);

addCountryAliases('NO', ['NO', 'Norway', 'Norsko', 'Nórsko', 'Norwegia', 'Norge', 'Norwegen']);

export function countryCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const normalizedCode = upper === 'UK' ? 'GB' : upper;

  if (/^[A-Z]{2}$/.test(normalizedCode) && SUPPORTED_COUNTRY_CODES.has(normalizedCode)) return normalizedCode;
  return COUNTRY_ALIASES[foldPlaceText(raw)] || '';
}

export function firstCountryCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const parts = raw.split(',').map(part => part.trim()).filter(Boolean);
  for (const part of parts) {
    const cc = countryCodeFromInput(part);
    if (cc) return cc;
  }
  return '';
}

export function countryLabelForCode(code, lang = 'cs') {
  const cc = String(code || '').trim().toUpperCase();
  if (!cc) return '';

  const labels = COUNTRY_LABELS[cc];
  return labels?.[lang] || labels?.cs || labels?.en || cc;
}
