import './identity-init.js';

import { applyTranslations, detectLang } from './i18n.js';
import { initNav } from './nav-core.js';
import { initLangDropdown } from './utils/lang-dropdown.js';

const lang = detectLang();
initNav({ lang });
initLangDropdown();

if (lang !== document.documentElement.lang) {
  void applyTranslations(lang);
}
