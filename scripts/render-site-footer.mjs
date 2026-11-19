import { readFileSync } from 'node:fs';

export function renderSiteFooter(html) {
  return html.replace('<!-- site-footer -->', () =>
    readFileSync(new URL('../templates/site-footer.html', import.meta.url), 'utf8').trimEnd()
  );
}
