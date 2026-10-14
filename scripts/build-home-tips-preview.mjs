import { compileAsync } from 'sass-embedded';
import postcss from 'postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// A review surface is generated only for private deploy previews, never for main.
if (process.env.CONTEXT !== 'deploy-preview' && process.env.HOME_TIPS_PREVIEW !== '1') process.exit(0);
const directory = 'dist/previews/home-tips';
await mkdir(directory, { recursive: true });
const entries = ['src/styles/pages/home-page.scss', 'src/styles/pages/home-deferred.scss', 'src/styles/partials/_ai-event-search.scss'];
const sheets = await Promise.all(entries.map(async path => (await compileAsync(path, { style: 'compressed' })).css));
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
const homepage = await readFile('dist/index.html', 'utf8');
for (const theme of ['light', 'dark']) {
  await writeFile(`${directory}/${theme}.css`, forceTheme(sheets.join('\n'), theme) + '\n#cookie-banner{display:none}');
  const dom = new JSDOM(homepage), doc = dom.window.document;
  for (const style of doc.querySelectorAll('style')) style.textContent = forceTheme(style.textContent, theme);
  const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = `/previews/home-tips/${theme}.css`; doc.head.appendChild(link);
  const meta = doc.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; doc.head.appendChild(meta);
  const observer = doc.createElement('script');
  observer.textContent = `new MutationObserver(records => { for(const record of records) { const styles=[...record.addedNodes].filter(node=>node.nodeName==='STYLE'); if(record.target.nodeName==='STYLE')styles.push(record.target);for(const style of styles){const current=style.textContent;const updated=current.replace(/@media\\s*\\(prefers-color-scheme:\\s*(dark|light)\\)/g,(_,mode)=>mode===${JSON.stringify(theme)}?'@media (min-width:0px)':'@media not all');if(updated!==current)style.textContent=updated;}}}).observe(document.head,{childList:true,subtree:true,characterData:true});`;
  doc.head.appendChild(observer);
  await writeFile(`${directory}/home-${theme}.html`, dom.serialize()); dom.window.close();
}
await writeFile(`${directory}/index.html`, `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AJSEE – náhled rychlé homepage</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf2f1;color:#153b47;font:14px system-ui,sans-serif}.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 18px;background:#fff;border-bottom:1px solid #d5e2de}.toolbar strong{margin-right:auto}.toolbar button{border:1px solid #c6d9d4;border-radius:8px;background:#fff;color:#153b47;padding:9px 12px;cursor:pointer;font:inherit}.toolbar button[aria-pressed=true]{background:#153b47;color:#fff;border-color:#153b47}.toolbar a{color:#087c7b;text-decoration:none;padding:9px}.hint{text-align:center;margin:14px 18px;color:#526571}#stage{position:relative;margin:18px auto 0;width:calc(100% - 32px);max-width:1600px;overflow:hidden}iframe{display:block;border:0;border-radius:14px;transform-origin:top left;box-shadow:0 16px 40px #153b4720;background:#fff}button:focus-visible,a:focus-visible{outline:3px solid #087c7b;outline-offset:3px}
</style></head><body><nav class="toolbar" aria-label="Náhled"><strong>AJSEE · rychlá homepage</strong><button data-width="1440" aria-pressed="true">Velký monitor</button><button data-width="1280" aria-pressed="false">Notebook</button><button data-width="390" aria-pressed="false">Mobil</button><button data-theme="light" aria-pressed="true">Light</button><button data-theme="dark" aria-pressed="false">Dark</button><button id="show-tips">Zobrazit tipy</button><a href="/" target="_blank" rel="noopener">Otevřít celou stránku ↗</a></nav><p class="hint">Dvě redakční priority a další akce z feedů. Filtry, detaily i odkazy fungují v náhledu.</p><div id="stage"><iframe id="homepage" title="Homepage AJSEE" src="home-light.html"></iframe></div><script>
let width=1440,theme='light';const stage=document.getElementById('stage'),frame=document.getElementById('homepage');function resize(){const scale=Math.min(1,stage.clientWidth/width);frame.style.width=width+'px';frame.style.height=(width<500?1400:1500)+'px';frame.style.transform='scale('+scale+')';frame.style.marginLeft=Math.max(0,(stage.clientWidth-width*scale)/2)+'px';stage.style.height=((width<500?1400:1500)*scale)+'px';}document.querySelectorAll('[data-width]').forEach(button=>button.onclick=()=>{width=Number(button.dataset.width);document.querySelectorAll('[data-width]').forEach(item=>item.setAttribute('aria-pressed',item===button));resize();});document.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{theme=button.dataset.theme;document.querySelectorAll('[data-theme]').forEach(item=>item.setAttribute('aria-pressed',item===button));frame.src='home-'+theme+'.html';});document.getElementById('show-tips').onclick=()=>frame.contentWindow.document.getElementById('events')?.scrollIntoView();new ResizeObserver(resize).observe(stage);resize();
</script></body></html>`);
console.log('[home tips] Review surface generated with mobile, notebook, desktop, light and dark modes');
