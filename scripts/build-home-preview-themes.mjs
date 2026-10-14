import { compileAsync } from 'sass-embedded';
import postcss from 'postcss';
import { writeFile } from 'node:fs/promises';

// Review-only sheets; the actual homepage follows the visitor's system theme.
const entries = ['src/styles/pages/home-page.scss', 'src/styles/pages/home-deferred.scss', 'src/styles/partials/_ai-event-search.scss'];
const sheets = await Promise.all(entries.map(async path => (await compileAsync(path, { style: 'compressed' })).css));
for (const theme of ['light', 'dark']) {
  const root = postcss.parse(sheets.join('\n'));
  root.walkAtRules('media', rule => {
    const match = rule.params.match(/\(prefers-color-scheme:\s*(dark|light)\)/);
    if (!match) return;
    if (match[1] !== theme) { rule.remove(); return; }
    const remaining = rule.params.replace(match[0], '').replace(/^\s*and\s*|\s*and\s*$/g, '').trim();
    if (remaining) rule.params = remaining;
    else rule.replaceWith(...rule.nodes);
  });
  root.append(postcss.parse('#cookie-banner{display:none}'));
  await writeFile('public/previews/home/forced-' + theme + '.css', root.toString());
}
console.log('Homepage review themes generated.');
