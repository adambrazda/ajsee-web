import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ORIGIN='https://ajsee.cz';
const key=url=>new URL(url,ORIGIN).pathname.replace(/\/index\.html$/,'/').replace(/\.html$/,'').replace(/\/+$/,'')||'/';

export async function auditCrawlDiscovery(directory='dist') {
  const sitemap=new JSDOM(await fs.readFile(path.join(directory,'sitemap.xml'),'utf8'),{contentType:'application/xml'});
  const urls=[...sitemap.window.document.querySelectorAll('loc')].map(node=>node.textContent.trim());
  sitemap.window.close();
  const targets=new Map(urls.map(url=>[key(url),url]));
  const incoming=new Map(urls.map(url=>[url,new Set()])),graph=new Map(),pages=[];
  for(const url of urls) {
    const pathname=new URL(url).pathname;
    const candidates=[path.join(directory,pathname,pathname.endsWith('/')?'index.html':''),path.join(directory,pathname+'.html'),path.join(directory,pathname,'index.html')];
    let file;
    for(const candidate of candidates)if((await fs.stat(candidate).catch(()=>null))?.isFile()){file=candidate;break;}
    if(!file)throw new Error('Missing sitemap page: '+url);
    const dom=new JSDOM(await fs.readFile(file,'utf8'),{url}),doc=dom.window.document;
    const edges=new Set();
    for(const link of doc.querySelectorAll('a[href]')) {
      let target;
      try{target=new URL(link.getAttribute('href'),url);}catch{continue;}
      if(target.origin!==ORIGIN||link.rel.split(/\s+/).includes('nofollow'))continue;
      const destination=targets.get(key(target));
      if(destination&&destination!==url){edges.add(destination);incoming.get(destination).add(url);}
    }
    graph.set(url,edges);
    const languages=[...doc.querySelectorAll('.language-switcher .lang-btn[data-lang]')].map(link=>({
      lang:link.dataset.lang,tag:link.tagName,href:link.getAttribute('href'),
      expected:doc.querySelector(`link[rel="alternate"][hreflang="${link.dataset.lang}"]`)?.getAttribute('href')
    }));
    pages.push({url,file,canonical:doc.querySelector('link[rel="canonical"]')?.href,
      noindex:/\bnoindex\b/i.test(doc.querySelector('meta[name="robots"]')?.content||''),languages});
    dom.window.close();
  }
  const depth=new Map([[ORIGIN+'/',0]]),queue=[ORIGIN+'/'];
  for(let i=0;i<queue.length;i++)for(const url of graph.get(queue[i])||[])if(!depth.has(url)){depth.set(url,depth.get(queue[i])+1);queue.push(url);}
  return {total:urls.length,reachable:depth.size,maxDepth:Math.max(...depth.values()),
    unreachable:urls.filter(url=>!depth.has(url)),orphans:urls.filter(url=>!incoming.get(url).size),
    pages:pages.map(page=>({...page,depth:depth.get(page.url)??null,incoming:[...incoming.get(page.url)]}))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await auditCrawlDiscovery();
  console.log(JSON.stringify(process.argv.includes('--json')?result:{
    total:result.total,reachable:result.reachable,maxDepth:result.maxDepth,
    unreachable:result.unreachable,orphans:result.orphans,
    languageLinks:result.pages.reduce((count,page)=>count+page.languages.filter(link=>link.tag==='A').length,0)
  },null,2));
  if(result.unreachable.length||result.orphans.length)process.exitCode=1;
}
