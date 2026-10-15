import { compileAsync } from 'sass-embedded';
import postcss from 'postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Review UI is never emitted by the production build.
if (process.env.CONTEXT !== 'deploy-preview' && process.env.AJSEE_AI_BRAND_PREVIEW !== '1') process.exit(0);

const directory = 'dist/previews/ajsee-ai';
await mkdir(directory, { recursive: true });

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

for (const page of ['home', 'events']) {
  const entries = [`src/styles/pages/${page}-page.scss`, 'src/styles/partials/_ai-event-search.scss'];
  if (page === 'home') entries.splice(1, 0, 'src/styles/pages/home-deferred.scss');
  const sheets = await Promise.all(entries.map(async path => (await compileAsync(path, { style: 'compressed' })).css));
  const html = await readFile(page === 'home' ? 'dist/index.html' : 'dist/events.html', 'utf8');

  for (const theme of ['light', 'dark']) {
    await writeFile(`${directory}/${page}-${theme}.css`, forceTheme(sheets.join('\n'), theme) + '\n#cookie-banner{display:none}');
    const dom = new JSDOM(html), doc = dom.window.document;
    doc.documentElement.dataset.theme = theme;
    for (const style of doc.querySelectorAll('style')) style.textContent = forceTheme(style.textContent, theme);
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = `/previews/ajsee-ai/${page}-${theme}.css`; doc.head.appendChild(link);
    const meta = doc.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; doc.head.prepend(meta);
    const observer = doc.createElement('script');
    observer.textContent = `new MutationObserver(records => {for(const record of records){const styles=[...record.addedNodes].filter(node=>node.nodeName==='STYLE');if(record.target.nodeName==='STYLE')styles.push(record.target);for(const style of styles){const current=style.textContent;const updated=current.replace(/@media\\s*\\(prefers-color-scheme:\\s*(dark|light)\\)/g,(_,mode)=>mode===${JSON.stringify(theme)}?'@media (min-width:0px)':'@media not all');if(updated!==current)style.textContent=updated;}}}).observe(document.head,{childList:true,subtree:true,characterData:true});`;
    doc.head.appendChild(observer);
    await writeFile(`${directory}/${page}-${theme}.html`, dom.serialize());
    dom.window.close();
  }
}

await writeFile(`${directory}/index.html`, `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AJSEE AI – náhled značky ve vyhledávání</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef3f0;color:#14303e;font:14px/1.5 system-ui,sans-serif}.review-bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 22px;background:#fafcfb;border-bottom:1px solid #d6e3df}.review-title{margin-right:auto;line-height:1.25}.review-title strong{display:block;font-size:16px}.review-title small{color:#536a71;font-size:11px}.group{display:flex;gap:3px;padding:3px;border:1px solid #d6e3df;border-radius:10px;background:#fff}button,.full-page{border:0;border-radius:7px;background:transparent;color:#36545d;padding:8px 11px;cursor:pointer;font:inherit;font-size:12px;text-decoration:none}button[aria-pressed=true]{background:#153b47;color:#fff}.jump{border:1px solid #b8cec7;background:#fff}.full-page{color:#087c7b}.review-hint{margin:14px 20px;text-align:center;color:#546b70;font-size:12px}#stage{position:relative;margin:18px auto 30px;width:calc(100% - 32px);max-width:1520px;overflow:hidden}iframe{display:block;border:0;border-radius:14px;transform-origin:top left;box-shadow:0 16px 45px #153b4714;background:#fff}button:focus-visible,a:focus-visible{outline:3px solid #087c7b;outline-offset:3px}@media(max-width:600px){.review-bar{padding:12px;gap:8px}.review-title{width:100%;margin:0}.review-hint{text-align:left}}
</style></head><body><nav class="review-bar" aria-label="Ovládání náhledu"><div class="review-title"><strong>AJSEE AI</strong><small>Náhled nové identity vyhledávání</small></div><div class="group" role="group" aria-label="Stránka"><button data-page="home">Homepage</button><button data-page="events">Události</button></div><div class="group" role="group" aria-label="Velikost obrazovky"><button data-width="1440">Velký monitor</button><button data-width="1280">Notebook</button><button data-width="390">Mobil</button></div><div class="group" role="group" aria-label="Barevný režim"><button data-theme="light">Light</button><button data-theme="dark">Dark</button></div><button class="jump" id="show-search">Zobrazit vyhledávání</button><a class="full-page" id="open-page" href="/" target="_blank" rel="noopener">Celá stránka ↗</a></nav><p class="review-hint">Vizuální návrh před schválením. Ostrý web zůstává beze změny.</p><div id="stage"><iframe id="ai-preview" title="AJSEE AI – náhled stránky"></iframe></div><script>
const query=new URLSearchParams(location.search);let page=query.get('page')==='events'?'events':'home',theme=query.get('theme')==='dark'?'dark':'light',width=[390,1280,1440].includes(Number(query.get('width')))?Number(query.get('width')):1280;const stage=document.getElementById('stage'),frame=document.getElementById('ai-preview');
function sync(){for(const name of ['page','theme','width'])document.querySelectorAll('[data-'+name+']').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[name])===String({page,theme,width}[name])));document.getElementById('open-page').href=page==='home'?'/':'/events/';history.replaceState(null,'','?'+new URLSearchParams({page,theme,width}));}
function resize(){const scale=Math.min(1,stage.clientWidth/width);const height=width<500?1300:1250;frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform='scale('+scale+')';frame.style.marginLeft=Math.max(0,(stage.clientWidth-width*scale)/2)+'px';stage.style.height=height*scale+'px';}
function load(){frame.src=page+'-'+theme+'.html';sync();resize();}
for(const name of ['page','theme','width'])document.querySelectorAll('[data-'+name+']').forEach(button=>button.onclick=()=>{if(name==='page')page=button.dataset.page;if(name==='theme')theme=button.dataset.theme;if(name==='width')width=Number(button.dataset.width);load();});
document.getElementById('show-search').onclick=()=>{const root=frame.contentWindow.document.querySelector('.ai-event-search');if(root){root.style.scrollMarginTop='110px';root.scrollIntoView({block:'start'});}};new ResizeObserver(resize).observe(stage);load();
</script></body></html>`);

console.log('[AJSEE AI] Home and Events review UI generated: desktop, mobile, light and dark');
