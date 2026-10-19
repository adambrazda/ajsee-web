import { compileAsync } from 'sass-embedded';
import postcss from 'postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Visual review only; never published as part of a normal production build.
if (process.env.CONTEXT !== 'deploy-preview' && process.env.BLOG_PREVIEW !== '1') process.exit(0);
const directory = 'dist/previews/blog';
await mkdir(directory, { recursive: true });
const css = (await compileAsync('src/styles/pages/blog-page.scss', { style: 'compressed' })).css;
const html = await readFile('dist/blog.html', 'utf8');

function forceTheme(css, theme) {
  const root = postcss.parse(css);
  root.walkAtRules('media', (rule) => {
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
  await writeFile(`${directory}/${theme}.css`, forceTheme(css, theme) + '\nbody[data-page="blog"] #cookie-banner{display:none}');
  const dom = new JSDOM(html), doc = dom.window.document;
  const link = doc.createElement('link');
  link.rel = 'stylesheet'; link.href = `/previews/blog/${theme}.css`; doc.head.appendChild(link);
  const robots = doc.querySelector('meta[name="robots"]');
  if (robots) robots.content = 'noindex,nofollow';
  await writeFile(`${directory}/blog-${theme}.html`, dom.serialize());
  dom.window.close();
}
await writeFile(`${directory}/index.html`, `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Blog AJSEE – náhled redesignu</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef3f0;color:#14303e;font:14px/1.5 system-ui,sans-serif}.toolbar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 22px;background:#fafcfb;border-bottom:1px solid #d6e3df}.toolbar strong{margin-right:auto}.group{display:flex;gap:3px;padding:3px;border:1px solid #d6e3df;border-radius:10px;background:#fff}button,.toolbar a{border:0;border-radius:7px;background:transparent;color:#36545d;padding:8px 11px;cursor:pointer;font:inherit;font-size:12px;text-decoration:none}button[aria-pressed=true]{background:#153b47;color:#fff}.toolbar a{color:#087c7b}.hint{margin:14px 20px;text-align:center;color:#546b70;font-size:12px}#stage{position:relative;margin:18px auto 30px;width:calc(100% - 32px);max-width:1520px;overflow:hidden}iframe{display:block;border:0;border-radius:14px;transform-origin:top left;box-shadow:0 16px 45px #153b4714;background:#fff}button:focus-visible,a:focus-visible{outline:3px solid #087c7b;outline-offset:3px}@media(max-width:600px){.toolbar{padding:12px;gap:8px}.toolbar strong{width:100%;margin:0}.hint{text-align:left}}
</style></head><body><nav class="toolbar" aria-label="Ovládání náhledu"><strong>Blog AJSEE · nový návrh</strong><div class="group" role="group" aria-label="Velikost obrazovky"><button data-width="1440">Velký monitor</button><button data-width="1280">Notebook</button><button data-width="390">Mobil</button></div><div class="group" role="group" aria-label="Barevný režim"><button data-theme="light">Light</button><button data-theme="dark">Dark</button></div><a href="/blog/" target="_blank" rel="noopener">Celá stránka ↗</a></nav><p class="hint">Klikací náhled. Přepněte si velikost obrazovky a barevný režim. Ostrý web zůstává beze změny.</p><div id="stage"><iframe id="blog-preview" title="Náhled blogu AJSEE"></iframe></div><script>
const query=new URLSearchParams(location.search);let theme=query.get('theme')==='dark'?'dark':'light',width=[390,1280,1440].includes(Number(query.get('width')))?Number(query.get('width')):matchMedia('(max-width:600px)').matches?390:1280;const stage=document.getElementById('stage'),frame=document.getElementById('blog-preview');
function sync(){for(const name of ['theme','width'])document.querySelectorAll('[data-'+name+']').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[name])===String({theme,width}[name])));history.replaceState(null,'','?'+new URLSearchParams({theme,width}));}
function resize(){const scale=Math.min(1,stage.clientWidth/width),height=width<500?1500:1400;frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform='scale('+scale+')';frame.style.marginLeft=Math.max(0,(stage.clientWidth-width*scale)/2)+'px';stage.style.height=height*scale+'px';}
function load(){frame.src='blog-'+theme+'.html';sync();resize();}
document.querySelectorAll('[data-width]').forEach(button=>button.onclick=()=>{width=Number(button.dataset.width);sync();resize();});document.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{theme=button.dataset.theme;load();});new ResizeObserver(resize).observe(stage);load();
</script></body></html>`);
console.log('[blog] Desktop, notebook, mobile, light and dark review surface generated');
