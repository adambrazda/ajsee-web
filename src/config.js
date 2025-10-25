// src/config.js
// Centralizované konstanty a mapy (bez side-effectů)

export const PAGE_SIZE = 12;
export const HOMEPAGE_LIMIT = 6;

export const SUPPORTED_LANGS = ['cs','en','de','sk','pl','hu'];
export const DEFAULT_LANG = 'cs';

export const LANG_TO_COUNTRY = {
  cs:'CZ', sk:'SK', de:'DE', pl:'PL', hu:'HU', en:'CZ'
};

// Ticketmaster mapping (language & locale param)
export const TM_LANG_MAP = {
  cs:'cs-cz',
  sk:'sk-sk',
  pl:'pl-pl',
  de:'de-de',
  hu:'hu-hu',
  en:'en-gb'
};
