// scripts/check-locales.js
import { readdir, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';

const LOCALES_PATH = 'src/locales'; // ✅ Opraveno: kontroluj src/, ne public/
const REQUIRED_PAGES = ['about.json']; // Můžeš rozšířit např. o 'events.json', 'faq.json' atd.
const REQUIRED_LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

let hasError = false;

console.log(`\n🔍 Kontrola lokalizačních souborů:`);

for (const lang of REQUIRED_LANGS) {
  for (const page of REQUIRED_PAGES) {
    const filePath = join(LOCALES_PATH, lang, page);
    try {
      await access(filePath, constants.F_OK);
      console.log(`✅ ${lang}/${page}`);
    } catch {
      console.error(`❌ CHYBÍ: ${lang}/${page}`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('\n❗ Některé překladové soubory chybí.');
  process.exit(1);
} else {
  console.log('\n✅ Všechny potřebné soubory jsou přítomny.');
  process.exit(0);
}
