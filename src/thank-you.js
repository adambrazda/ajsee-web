import { applyTranslations, detectLang } from './i18n.js';

window.addEventListener('DOMContentLoaded', () => {
  const lang = detectLang();
  applyTranslations(lang);
});
