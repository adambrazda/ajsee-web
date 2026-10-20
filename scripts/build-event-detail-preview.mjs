import { compileAsync } from 'sass-embedded';
import postcss from 'postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { PREVIEW_ROOT, validatePilot, renderEventDetail, buildEventSchema } from './event-detail-pilot.mjs';

// Never produce these pages or add routes to the public event listing in a
// normal production build. A review deploy is intentionally noindex.
if (process.env.CONTEXT !== 'deploy-preview' && process.env.EVENT_DETAIL_PREVIEW !== '1') process.exit(0);
const directory = 'dist' + PREVIEW_ROOT;
const pilot = JSON.parse(await readFile('content/event-detail-pilot.json', 'utf8'));
validatePilot(pilot.events);
await mkdir(directory, { recursive: true });
const template = await readFile('dist/templates/event-detail-preview.html', 'utf8');
const shell = new JSDOM(await readFile('dist/about.html', 'utf8'));
const header = shell.window.document.querySelector('.site-header').cloneNode(true);
header.querySelectorAll('.language-switcher').forEach(node => node.remove());
header.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current'));
header.querySelector('.main-nav a[data-i18n-key="nav-events"]').setAttribute('aria-current', 'page');
header.querySelector('.header-inner').insertAdjacentHTML('beforeend', '<span class="detail-language" lang="cs">Čeština</span>');
const footer = shell.window.document.querySelector('.site-footer').outerHTML;
const css = (await compileAsync('src/styles/pages/event-detail-page.scss', { style: 'compressed' })).css;

function forceTheme(css, theme) {
  const root = postcss.parse(css);
  root.walkAtRules('media', rule => {
    const match = rule.params.match(/\(prefers-color-scheme:\s*(dark|light)\)/);
    if (!match) return;
    if (match[1] !== theme) { rule.remove(); return; }
    const remaining = rule.params.replace(match[0], '').replace(/^\s*and\s*|\s*and\s*$/g, '').trim();
    if (remaining) rule.params = remaining;
    else rule.replaceWith(...rule.nodes);
  });
  return root.toString();
}

for (const theme of ['light', 'dark']) {
  await writeFile(`${directory}/${theme}.css`, forceTheme(css, theme));
  for (const event of pilot.events) {
    const dom = new JSDOM(template), doc = dom.window.document;
    doc.querySelectorAll('link[rel="canonical"],link[hreflang]').forEach(node => node.remove());
    doc.title = `${event.title} – ${event.venue.city}, ${event.startDate.slice(0,10)} | AJSEE`;
    const description = doc.createElement('meta');
    description.name = 'description'; description.content = event.introduction; doc.head.appendChild(description);
    const style = doc.createElement('link'); style.rel = 'stylesheet'; style.href = `${PREVIEW_ROOT}/${theme}.css`; doc.head.appendChild(style);
    const schema = doc.createElement('script'); schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify(buildEventSchema(event)).replace(/</g, '\\u003c'); doc.head.appendChild(schema);
    doc.body.innerHTML = header.outerHTML + renderEventDetail(event) + footer;
    await writeFile(`${directory}/${event.slug}-${theme}.html`, dom.serialize());
    dom.window.close();
  }
}
shell.window.close();
// The noindex bundling input is not linked as an event or translated.
const options = pilot.events.map(event => `<option value="${event.slug}">${event.category} · ${event.title}</option>`).join('');
const previewConfig = JSON.stringify({ root: PREVIEW_ROOT, slugs: pilot.events.map(e => e.slug) }).replace(/</g, '\\u003c');
await writeFile(`${directory}/index.html`, `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AJSEE – náhled detailů událostí</title><style>
*{box-sizing:border-box}body{margin:0;background:#e9efed;color:#14303e;font:14px/1.5 system-ui,sans-serif}.toolbar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:13px 22px;background:#fafcfb;border-bottom:1px solid #d6e3df}.toolbar strong{margin-right:auto}.group{display:flex;gap:3px;padding:3px;border:1px solid #d6e3df;border-radius:10px;background:#fff}button,.toolbar a,select{border:0;border-radius:7px;background:transparent;color:#36545d;padding:8px 10px;cursor:pointer;font:inherit;font-size:12px;text-decoration:none}select{max-width:260px;border:1px solid #d6e3df;background:#fff;padding:10px}button[aria-pressed=true]{background:#153b47;color:#fff}.toolbar a{color:#087c7b}.hint{margin:13px 20px;text-align:center;color:#546b70;font-size:12px}#stage{position:relative;margin:18px auto 30px;width:calc(100% - 32px);max-width:1520px;overflow:hidden}iframe{display:block;border:0;border-radius:14px;transform-origin:top left;box-shadow:0 16px 45px #153b4714;background:#fff}button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid #087c7b;outline-offset:3px}@media(max-width:600px){.toolbar{padding:12px;gap:8px}.toolbar strong{width:100%;margin:0}select{max-width:100%;width:100%}.hint{text-align:left}}
</style></head><body><nav class="toolbar" aria-label="Ovládání náhledu"><strong>AJSEE · detail události</strong><select id="event" aria-label="Vybrat akci">${options}</select><div class="group" role="group" aria-label="Velikost obrazovky"><button data-width="1440">Monitor</button><button data-width="1280">Notebook</button><button data-width="390">Mobil</button></div><div class="group" role="group" aria-label="Barevný režim"><button data-theme="light">Light</button><button data-theme="dark">Dark</button></div><a id="full-page" target="_blank" rel="noopener">Celá stránka ↗</a></nav><p class="hint">Čtyři skutečné akce, jeden návrh detailu. Vyzkoušejte mobil i oba barevné režimy. Jde o náhled; ceny a termíny byly ověřeny 20. října 2026.</p><div id="stage"><iframe id="event-preview" title="Náhled detailu události AJSEE"></iframe></div><script>
const config=${previewConfig},query=new URLSearchParams(location.search);let theme=query.get('theme')==='dark'?'dark':'light',width=[390,1280,1440].includes(Number(query.get('width')))?Number(query.get('width')):matchMedia('(max-width:600px)').matches?390:1280,slug=config.slugs.includes(query.get('event'))?query.get('event'):config.slugs[0],height=1600;const stage=document.getElementById('stage'),frame=document.getElementById('event-preview'),select=document.getElementById('event');
function sync(){for(const name of ['theme','width'])document.querySelectorAll('[data-'+name+']').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[name])===String({theme,width}[name])));select.value=slug;history.replaceState(null,'','?'+new URLSearchParams({event:slug,theme,width}));}
function resize(){const scale=Math.min(1,stage.clientWidth/width);frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform='scale('+scale+')';frame.style.marginLeft=Math.max(0,(stage.clientWidth-width*scale)/2)+'px';stage.style.height=height*scale+'px';}
function load(){const url=config.root+'/'+slug+'-'+theme+'.html';frame.src=url;document.getElementById('full-page').href=url;sync();resize();}
document.querySelectorAll('[data-width]').forEach(button=>button.onclick=()=>{width=Number(button.dataset.width);height=1600;frame.style.height='800px';sync();resize();});document.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{theme=button.dataset.theme;load();});select.onchange=()=>{slug=select.value;load();};window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.type!=='ajsee-event-preview-size')return;const next=Number(event.data.height);if(Number.isFinite(next)&&next>300&&next<18000){height=next;resize();}});new ResizeObserver(resize).observe(stage);load();
</script></body></html>`);
console.log('[event-details] Four Czech occurrences, desktop/mobile and light/dark preview only');
