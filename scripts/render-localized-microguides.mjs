import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { MICROGUIDE_LABELS } from '../src/microguide-copy.js';
import { applyStaticSeoToTemplate, buildStaticMain, replaceMain } from './build-mg.mjs';

const LANGS = ['cs', 'en', 'de', 'sk', 'pl', 'hu'];
const ORIGIN = 'https://ajsee.cz';
const escape = value => String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const route = (slug, lang) => (lang === 'cs' ? '' : '/' + lang) + '/microguides/' + (slug ? slug + '/' : '');

export function renderGuideIndex(html, records, lang) {
  const dom = new JSDOM(html), doc = dom.window.document;
  const root = doc.querySelector('[data-mg-root]');
  if (!root) throw new Error('Missing micro-guide root');
  const copy = MICROGUIDE_LABELS[lang], url = ORIGIN + route('',lang);
  root.innerHTML = `<nav class="mg-breadcrumb" aria-label="Breadcrumb"><a href="${lang==='cs'?'/blog':'/'+lang+'/blog/'}">${escape(copy.backToBlog)}</a><span aria-hidden="true">/</span><span>${escape(copy.breadcrumb)}</span></nav>
    <section class="mg-hero mg-hero--index"><div class="mg-hero-text"><p class="mg-kicker">${escape(copy.breadcrumb)}</p><h1 class="mg-title">${escape(copy.indexHeading)}</h1><p class="mg-lead">${escape(copy.indexLead)}</p></div></section>
    <section class="mg-content mg-content--index" aria-labelledby="microguides-list-title"><header class="mg-section"><h2 id="microguides-list-title">${escape(copy.allGuides)}</h2></header>
    <div class="mg-index-grid">${records.map(item=>`<article class="mg-card"><a class="mg-card-link" href="${route(item.slug,lang)}" aria-label="${escape(copy.openGuide+': '+item.title)}">${item.cover?`<figure class="mg-card-media"><img src="${escape(item.cover)}" alt="" loading="lazy" decoding="async"></figure>`:''}<div class="mg-card-body"><p class="mg-kicker">${escape(copy.breadcrumb)}</p><h2>${escape(item.title)}</h2><p>${escape(item.summary)}</p><span class="mg-card-cta">${escape(copy.openGuide)}</span></div></a></article>`).join('')}</div></section>`;
  root.hidden = false;
  doc.title = copy.indexTitle;
  for(const [selector,attribute,value] of [['meta[name="description"]','content',copy.indexDescription],['link[rel="canonical"]','href',url],['meta[property="og:title"]','content',copy.indexTitle],['meta[property="og:description"]','content',copy.indexDescription],['meta[property="og:url"]','content',url],['meta[name="twitter:title"]','content',copy.indexTitle],['meta[name="twitter:description"]','content',copy.indexDescription]]) doc.querySelector(selector)?.setAttribute(attribute,value);
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(node=>node.remove());
  const script=doc.createElement('script');script.type='application/ld+json';script.id='ajsee-microguides-index-jsonld-static';
  script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage','@id':url+'#page',url,name:copy.indexHeading,description:copy.indexDescription,inLanguage:lang,mainEntity:{'@id':url+'#list'}},
    {'@type':'ItemList','@id':url+'#list',itemListElement:records.map((item,index)=>({'@type':'ListItem',position:index+1,url:ORIGIN+route(item.slug,lang),name:item.title}))},
    {'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'AJSEE',item:ORIGIN+(lang==='cs'?'/':'/'+lang+'/')},{'@type':'ListItem',position:2,name:copy.indexHeading,item:url}]}
  ]}).replace(/</g,'\\u003c');doc.head.appendChild(script);
  const output=dom.serialize();dom.window.close();return output;
}

export async function renderLocalizedMicroguides(directory='dist') {
  const source=JSON.parse(await fs.readFile('content/microguides/index.json','utf8'));
  const records=(Array.isArray(source)?source:source.items).filter(item=>item.status==='published').sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  const updates=JSON.parse(await fs.readFile('content/seo-updates.json','utf8'));
  for(const lang of LANGS){
    const localized=[];
    for(const record of records){
      const data=JSON.parse(await fs.readFile(`content/microguides/${record.slug}.${lang}.json`,'utf8'));
      if(data.status!=='published'||!data.title||!data.steps?.length)throw new Error(`Incomplete published guide: ${record.slug}/${lang}`);
      const enriched={...data,publishedAt:data.publishedAt||record.publishedAt,updatedAt:data.updatedAt||updates.templates.microguides};
      const file=path.join(directory,route(record.slug,lang),'index.html');
      const original=await fs.readFile(file,'utf8');
      const html=replaceMain(applyStaticSeoToTemplate(original,enriched,lang,record.slug),buildStaticMain(enriched,lang,record.slug));
      await fs.writeFile(file,html);
      // Runtime uses the exact same translated content and dates as initial HTML.
      await fs.writeFile(path.join(directory,'content/microguides',record.slug+'.'+lang+'.json'),JSON.stringify(enriched,null,2)+'\n');
      localized.push(enriched);
    }
    const index=path.join(directory,route('',lang),'index.html');
    await fs.writeFile(index,renderGuideIndex(await fs.readFile(index,'utf8'),localized,lang));
  }
  console.log(`[microguides] ${(records.length+1)*LANGS.length} localized initial HTML pages rendered`);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await renderLocalizedMicroguides();
