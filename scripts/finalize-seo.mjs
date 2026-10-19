import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://ajsee.cz';
const LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const LOCALES = {cs:'cs_CZ',en:'en_GB',de:'de_DE',sk:'sk_SK',pl:'pl_PL',hu:'hu_HU'};
const MAIN = new Set(['events','accommodation','partners','about','blog','faq','privacy-policy','cookies-policy']);
const LONDON = {cs:'/londynske-muzikaly/',en:'/en/london-musicals/',de:'/de/london-musicals/',sk:'/sk/londynske-muzikaly/',pl:'/pl/londynskie-musicale/',hu:'/hu/londoni-musicalek/'};
export const SOCIALS = ['https://www.instagram.com/ajseeofficial/','https://www.facebook.com/profile.php?id=61565404319940','https://x.com/ajseeofficial','https://www.linkedin.com/company/ajsee'];

export function localizedSeoPath(raw, lang) {
  const url = new URL(raw, ORIGIN);
  if (url.origin !== ORIGIN) return raw;
  const clean = url.pathname.replace(/^\/(?:cs|en|de|sk|pl|hu)(?=\/|$)/,'').replace(/\/index\.html$/,'/').replace(/\.html$/,'');
  if (Object.values(LONDON).some(value=>value.replace(/^\/(?:en|de|sk|pl|hu)(?=\/|$)/,'')===clean)) url.pathname=LONDON[lang];
  else {
    const base=clean.replace(/\/+$/,'') || '/';
    url.pathname=(lang==='cs'?'':'/'+lang)+(base==='/'?'/':base+(MAIN.has(base.slice(1))&&lang==='cs'?'':'/'));
  }
  return url.href;
}
function meta(doc,selector,value) { doc.querySelector(selector)?.setAttribute('content',value); }

export function finalizeSeoHtml(html) {
  const dom=new JSDOM(html),doc=dom.window.document;
  const lang=LANGS.includes(doc.documentElement.lang)?doc.documentElement.lang:'cs';
  const canonical=doc.querySelector('link[rel="canonical"]')?.href;
  if(!canonical||!canonical.startsWith(ORIGIN)||doc.querySelector('meta[name="robots"]')?.content.includes('noindex')) { dom.window.close();return html; }
  const h1=doc.querySelector('main h1,h1')?.textContent.trim()||doc.title;
  const description=doc.querySelector('meta[name="description"]')?.content||'';
  meta(doc,'meta[property="og:locale"]',LOCALES[lang]);
  meta(doc,'meta[property="og:url"]',canonical);
  // Keep intentionally shorter social titles, but never the Czech Events fallback.
  if(new URL(canonical).pathname.match(/\/(?:events)\/?$/)) {
    meta(doc,'meta[property="og:title"]',doc.title);
    meta(doc,'meta[name="twitter:title"]',doc.title);
    meta(doc,'meta[property="og:description"]',description);
    meta(doc,'meta[name="twitter:description"]',description);
  }
  const navNames=new Map([...doc.querySelectorAll('nav a[href]')].map(a=>[new URL(a.getAttribute('href'),ORIGIN).pathname.replace(/\/+$/,'')||'/',a.textContent.trim()]));
  function normalize(node) {
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.forEach(normalize);return;}
    const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
    if(types.includes('Organization')) {
      if(node.name==='AJSEE'||node['@id']===ORIGIN+'/#organization')Object.assign(node,{'@id':ORIGIN+'/#organization',name:'AJSEE',legalName:'AJSEE LTD',url:ORIGIN+'/',sameAs:SOCIALS});
      return;
    }
    if(types.includes('WebSite')) {
      node['@id']=ORIGIN+'/#website';node.url=ORIGIN+'/';node.inLanguage=LANGS;return;
    }
    if(types.some(type=>['AboutPage','Blog','CollectionPage','FAQPage','WebPage','ProfilePage','Article','Review','BlogPosting'].includes(type))) {
      const suffix=typeof node['@id']==='string'&&node['@id'].includes('#')?'#'+node['@id'].split('#')[1]:'';
      if(node['@id'])node['@id']=canonical+suffix;
      if(node.url||types.some(type=>['AboutPage','Blog','CollectionPage','FAQPage','ProfilePage'].includes(type)))node.url=canonical;
      node.inLanguage=lang;
      if(types.some(type=>['AboutPage','Blog','CollectionPage','FAQPage','ProfilePage'].includes(type))){
        if(node.name)node.name=h1;if(node.headline)node.headline=h1;if(node.description)node.description=description;
      }
    }
    if(types.includes('BreadcrumbList')){
      node['@id']=canonical+'#breadcrumb';
      const items=node.itemListElement||[];
      items.forEach((item,index)=>{
        if(typeof item.item==='string'&&item.item.startsWith(ORIGIN)){
          item.item=localizedSeoPath(item.item,lang);
          const key=new URL(item.item).pathname.replace(/\/+$/,'')||'/';
          if(index===items.length-1){item.item=canonical;item.name=h1;}
          else if(index===0)item.name='AJSEE';
          else if(navNames.has(key))item.name=navNames.get(key);
        }
      });
    }
    Object.values(node).forEach(normalize);
  }
  let pageSchema=false;
  for(const script of doc.querySelectorAll('script[type="application/ld+json"]')){
    const data=JSON.parse(script.textContent);
    normalize(data);
    const all=JSON.stringify(data);
    if(/"@type":"(?:WebPage|CollectionPage|AboutPage|Blog|ProfilePage|FAQPage|Article|Review)"/.test(all))pageSchema=true;
    script.textContent=all.replace(/</g,'\\u003c');
  }
  if(!pageSchema){
    const script=doc.createElement('script');script.type='application/ld+json';script.id='ajsee-page-jsonld';
    script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':[
      {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:h1,description,inLanguage:lang,isPartOf:{'@id':ORIGIN+'/#website'},publisher:{'@id':ORIGIN+'/#organization'}},
      {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'AJSEE',item:ORIGIN+(lang==='cs'?'/':'/'+lang+'/')},{'@type':'ListItem',position:2,name:h1,item:canonical}]}
    ]}).replace(/</g,'\\u003c');
    doc.head.appendChild(script);
  }
  // Only normalize the known Czech main routes; never alter partner destinations.
  if(lang==='cs')for(const a of doc.querySelectorAll('a[href]')){
    const href=a.getAttribute('href');
    if(/^\/(?:events|accommodation|partners|about|blog|faq|privacy-policy|cookies-policy)\/(?:[?#].*)?$/.test(href))a.setAttribute('href',href.replace(/\/(?=[?#]|$)/,''));
  }
  const output=dom.serialize();dom.window.close();return output;
}
async function walk(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()){if(!['assets','admin','previews'].includes(entry.name))await walk(file);}
    else if(entry.name.endsWith('.html'))await fs.writeFile(file,finalizeSeoHtml(await fs.readFile(file,'utf8')));
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await walk('dist');console.log('[seo] Page identity, localized breadcrumbs and organization normalized');}
