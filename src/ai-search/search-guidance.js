import { normalize } from '../../shared/city/canonical.js';
import { hasActivePriceFilter } from '../event-price.js';

const OPEN_ENDED = {
  cs: /^(?:(?:ja )?nevim(?: co (?:hledam|hledat|chci(?: zazit)?|delat)|kam (?:jit|vyrazit))?|nemam poneti|(?:najdi|ukaz)(?: mi)? (?:neco|(?:nejake )?(?:akce|udalosti))|neco(?: zajimaveho)?|cokoliv|cokoli|(?:vsechny )?(?:akce|udalosti)|co se deje)$/,
  en: /^(?:(?:i )?(?:dont know|do not know|not sure)(?: what (?:i want|to look for|im looking for|to do))?|(?:find|show)(?: me)? (?:something|(?:some )?events)|(?:all )?events|something(?: interesting)?|anything|whats on)$/,
  de: /^(?:ich weiss nicht(?: was ich suche| was ich machen soll)?|keine ahnung|(?:zeig(?:e)? mir )?(?:irgendwas|irgendetwas|etwas interessantes|(?:alle )?(?:events|veranstaltungen))|was ist los)$/,
  sk: /^(?:(?:ja )?neviem(?: co (?:hladam|hladat|chcem(?: zazit)?|robit)|kam (?:ist|vyrazit))?|nemam ponatia|(?:najdi|ukaz)(?: mi)? (?:nieco|(?:nejake )?(?:akcie|podujatia|udalosti))|nieco(?: zaujimave)?|cokolvek|(?:vsetky )?(?:akcie|podujatia|udalosti)|co sa deje)$/,
  pl: /^(?:nie wiem(?: czego szukam| czego szukac| co robic| co wybrac)?|nie mam pojecia|(?:pokaz mi )?(?:cos(?: ciekawego)?|cokolwiek|(?:wszystkie )?wydarzenia)|co sie dzieje)$/,
  hu: /^(?:nem tudom(?: mit keresek| mit keressek| mit csinaljak)?|fogalmam sincs|(?:mutass )?(?:valamit|valami erdekeset|barmit|(?:az osszes )?esemenyt)|esemenyek|mi tortenik)$/
};

export function isOpenEndedSearch(query, locale = 'cs') {
  const text = normalize(query).replace(/['’]/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return !text || OPEN_ENDED[locale]?.test(text) === true;
}

export function needsSearchGuidance(intent, { needsClarification = false, locale = intent?.locale } = {}) {
  if (needsClarification && intent?.clarification?.question?.trim()) return false;
  const { place, date, audience, category, keyword, unsupportedPreferences } = intent || {};
  return !(
    place?.type === 'near_me' ||
    (place?.type === 'city' && place.label) ||
    (place?.type === 'country' && place.countryCode) ||
    (date?.type === 'preset' && date.preset) ||
    (date?.type === 'range' && (date.from || date.to)) ||
    audience === 'family' ||
    (category && category !== 'all') ||
    (keyword && !isOpenEndedSearch(keyword, locale)) ||
    unsupportedPreferences?.some(preference => preference.type === 'max_price' &&
      hasActivePriceFilter({ maxPrice: preference.value, priceCurrency: preference.currency }))
  );
}
