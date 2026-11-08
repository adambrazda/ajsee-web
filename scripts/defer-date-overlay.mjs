import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Vite compiles the shared SCSS first; defer its real, hashed CSS asset before
// language cloning. Source SCSS must never be published as an unprocessed URL.
for (const file of ['dist/index.html', 'dist/events.html']) {
  const dom = new JSDOM(await fs.readFile(file, 'utf8'));
  const doc = dom.window.document;
  const links = doc.querySelectorAll('link[rel="stylesheet"][href^="/assets/date-overlay-"]');
  if (links.length !== 1) throw new Error(`${file}: expected one compiled date overlay stylesheet`);
  const link = links[0];
  const fallback = doc.createElement('noscript');
  fallback.appendChild(link.cloneNode());
  link.after(fallback);
  link.rel = 'preload';
  link.setAttribute('as', 'style');
  link.setAttribute('onload', "this.onload=null;this.rel='stylesheet'");
  await fs.writeFile(file, dom.serialize());
  dom.window.close();
}
