const fs = require('fs');
const path = require('path');

const root = process.cwd();
const langs = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];

const srcLocales = path.join(root, 'src', 'locales');
const publicLocales = path.join(root, 'public', 'locales');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    else if (item.isFile()) out.push(full);
  }

  return out;
}

function copyJson(source, target, label) {
  if (!fs.existsSync(source)) return { type: 'missing-source', source, target };

  ensureDir(path.dirname(target));

  const existed = fs.existsSync(target);
  const before = existed ? fs.readFileSync(target, 'utf8') : null;
  const next = fs.readFileSync(source, 'utf8');

  if (before === next) {
    return { type: 'same', source, target, label };
  }

  fs.writeFileSync(target, next, 'utf8');

  return {
    type: existed ? 'updated' : 'created',
    source,
    target,
    label
  };
}

const results = [];

for (const lang of langs) {
  const srcBase = path.join(srcLocales, `${lang}.json`);
  const publicBase = path.join(publicLocales, `${lang}.json`);

  results.push(copyJson(srcBase, publicBase, 'base'));

  const srcLangDir = path.join(srcLocales, lang);

  for (const srcPageFile of walk(srcLangDir).filter((file) => file.endsWith('.json'))) {
    const target = path.join(publicLocales, lang, path.basename(srcPageFile));
    results.push(copyJson(srcPageFile, target, 'page'));
  }
}

for (const lang of langs) {
  const legacyPartners = path.join(srcLocales, `partners-${lang}.json`);
  const canonicalPublicPartners = path.join(publicLocales, lang, 'partners.json');

  results.push(copyJson(legacyPartners, canonicalPublicPartners, 'legacy-partners'));
}

const grouped = results.reduce((acc, item) => {
  acc[item.type] = (acc[item.type] || 0) + 1;
  return acc;
}, {});

console.log('\nAJSEE runtime locales synced');
console.log('============================================================');

Object.entries(grouped).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

console.log('\nChanged files:');
results
  .filter((item) => item.type === 'created' || item.type === 'updated')
  .forEach((item) => {
    console.log(`${item.type}: ${rel(item.source)} -> ${rel(item.target)}`);
  });
