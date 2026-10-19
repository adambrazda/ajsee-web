import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { reviewCards } from '../src/blog-content.js';
import { blogTypography } from '../src/blog-view.js';
const LANGS=['cs','en','de','sk','pl','hu'];
const ORIGIN='https://ajsee.cz';
const COPY={
cs:{role:'Autorka AJSEE',bio:'Oya Canli píše pro AJSEE o muzikálech a divadle. V jejích textech najdete osobní dojmy z představení i pohled na příběhy, hudbu a tvůrce jednotlivých inscenací.',articles:'Publikované texty',london:'West End očima AJSEE',lead:'Osobní zkušenosti, příběhy inscenací a tipy, které vám pomohou s výběrem.',read:'Přečíst článek',guide:'Průvodce: divadlo na poslední chvíli',blog:'Všechny články',review:'Článek',preview:'Preview'},
en:{role:'AJSEE writer',bio:'Oya Canli writes about musicals and theatre for AJSEE. Her articles combine personal impressions of performances with a look at the stories, music and people behind the productions.',articles:'Published articles',london:'West End through AJSEE’s eyes',lead:'Personal experiences, stories behind the shows and ideas to help you choose.',read:'Read article',guide:'Guide: last-minute theatre tickets',blog:'All articles',review:'Article',preview:'Preview'},
de:{role:'Autorin bei AJSEE',bio:'Oya Canli schreibt für AJSEE über Musicals und Theater. Ihre Texte verbinden persönliche Eindrücke von Aufführungen mit einem Blick auf die Geschichten, die Musik und die Menschen hinter den Inszenierungen.',articles:'Veröffentlichte Beiträge',london:'Das West End aus AJSEE-Sicht',lead:'Persönliche Erfahrungen, Geschichten hinter den Shows und Anregungen für Ihre Auswahl.',read:'Artikel lesen',guide:'Ratgeber: kurzfristig ins Theater',blog:'Alle Artikel',review:'Artikel',preview:'Vorschau'},
sk:{role:'Autorka AJSEE',bio:'Oya Canli píše pre AJSEE o muzikáloch a divadle. V jej textoch nájdete osobné dojmy z predstavení aj pohľad na príbehy, hudbu a tvorcov jednotlivých inscenácií.',articles:'Publikované texty',london:'West End očami AJSEE',lead:'Osobné skúsenosti, príbehy inscenácií a tipy, ktoré vám pomôžu s výberom.',read:'Prečítať článok',guide:'Sprievodca: divadlo na poslednú chvíľu',blog:'Všetky články',review:'Článok',preview:'Preview'},
pl:{role:'Autorka AJSEE',bio:'Oya Canli pisze dla AJSEE o musicalach i teatrze. W swoich tekstach łączy osobiste wrażenia ze spektakli z opowieściami o ich historii, muzyce i twórcach.',articles:'Opublikowane teksty',london:'West End oczami AJSEE',lead:'Osobiste doświadczenia, historie spektakli i inspiracje, które pomogą Ci wybrać.',read:'Przeczytaj artykuł',guide:'Poradnik: teatr na ostatnią chwilę',blog:'Wszystkie artykuły',review:'Artykuł',preview:'Zapowiedź'},
hu:{role:'Az AJSEE szerzője',bio:'Oya Canli musicalekről és színházról ír az AJSEE számára. Cikkeiben személyes színházi élményeit az előadások történetével, zenéjével és alkotóival kapcsolja össze.',articles:'Megjelent írások',london:'A West End az AJSEE szemével',lead:'Személyes élmények, előadások történetei és ötletek a választáshoz.',read:'Cikk elolvasása',guide:'Útmutató: színház az utolsó pillanatban',blog:'Összes cikk',review:'Cikk',preview:'Előzetes'}
};
const escapeHtml=value=>String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const prefix=lang=>lang==='cs'?'':'/'+lang;
const authorPath=lang=>prefix(lang)+'/authors/oya-canli/';
const londonPaths={cs:'londynske-muzikaly/index.html',en:'en/london-musicals/index.html',de:'de/london-musicals/index.html',sk:'sk/londynske-muzikaly/index.html',pl:'pl/londynskie-musicale/index.html',hu:'hu/londoni-musicalek/index.html'};
const source=JSON.parse(await fs.readFile('public/content/reviews/index.json','utf8'));
const published=(Array.isArray(source)?source:source.items).filter(item=>item.status==='published'&&item.published===true&&!item.previewOnly);
const selected=['10-west-end-musicals-worth-travelling-to-london-for','why-west-end-changed-how-i-experience-live-theatre','phantom-of-the-opera-2026'];
for(const lang of LANGS){
  const escape=value=>escapeHtml(blogTypography(value,lang));
  const copy=COPY[lang],cards=reviewCards(published,lang).sort((a,b)=>b.ts-a.ts);
  const authorCards=cards.filter(item=>item.author==='Oya Canli');
  if(!authorCards.length)throw Error('No published author articles');
  const template=lang==='cs'?'dist/about.html':'dist/'+lang+'/about/index.html';
  const dom=new JSDOM(await fs.readFile(template,'utf8')),doc=dom.window.document;
  const url=ORIGIN+authorPath(lang),title='Oya Canli | '+copy.role;
  doc.body.dataset.page='author';
  doc.querySelector('main').innerHTML=`<section class="about-hero"><div class="about-container"><div class="about-hero-copy"><p class="about-founder-role">${escape(copy.role)}</p><h1 class="about-title">Oya Canli</h1><p class="about-lead">${escape(copy.bio)}</p><a class="about-partner-link" href="${lang==='cs'?'/blog':prefix(lang)+'/blog/'}">${escape(copy.blog)} →</a></div></div></section><section class="about-story"><div class="about-container"><h2>${escape(copy.articles)}</h2><div class="author-article-grid">${authorCards.map(card=>`<article class="author-article"><p>${escape(card.type==='preview'?copy.preview:copy.review)} · <time datetime="${escape(card.date)}">${escape(new Intl.DateTimeFormat(lang,{dateStyle:'medium'}).format(new Date(card.date)))}</time></p><h3><a href="${card.href}">${escape(card.title)}</a></h3><p>${escape(card.lead)}</p></article>`).join('')}</div></div></section>`;
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(node=>node.remove());
  doc.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node=>{node.href=ORIGIN+authorPath(node.hreflang==='x-default'?'cs':node.hreflang);});
  doc.querySelector('nav a[aria-current="page"]')?.removeAttribute('aria-current');
  doc.title=title;doc.querySelector('title').removeAttribute('data-i18n-key');
  for(const [selector,attr,value]of [['meta[name="description"]','content',copy.bio],['link[rel="canonical"]','href',url],['meta[property="og:title"]','content',title],['meta[property="og:description"]','content',copy.bio],['meta[property="og:url"]','content',url],['meta[name="twitter:title"]','content',title],['meta[name="twitter:description"]','content',copy.bio]]){
    const node=doc.querySelector(selector);if(node){node.setAttribute(attr,value);for(const name of [...node.getAttributeNames()])if(name.startsWith('data-i18n'))node.removeAttribute(name);}
  }
  const script=doc.createElement('script');script.type='application/ld+json';
  script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':[
    {'@type':'ProfilePage','@id':url+'#page',url,name:title,description:copy.bio,inLanguage:lang,mainEntity:{'@id':ORIGIN+'/authors/oya-canli/#person'}},
    {'@type':'Person','@id':ORIGIN+'/authors/oya-canli/#person',name:'Oya Canli',url:ORIGIN+'/authors/oya-canli/',description:copy.bio},
    {'@type':'ItemList',itemListElement:authorCards.map((card,index)=>({'@type':'ListItem',position:index+1,name:card.title,url:ORIGIN+card.href}))}
  ]}).replace(/</g,'\\u003c');doc.head.appendChild(script);
  const file=path.join('dist',authorPath(lang),'index.html');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,dom.serialize());dom.window.close();

  const londonFile=path.join('dist',londonPaths[lang]),london=new JSDOM(await fs.readFile(londonFile,'utf8')),ldoc=london.window.document;
  ldoc.querySelector('[data-london-editorial]')?.remove();
  const section=ldoc.createElement('section');section.className='tt-section tt-editorial';section.setAttribute('data-london-editorial','');section.setAttribute('aria-labelledby','tt-editorial-title');
  section.innerHTML=`<div class="tt-section-head"><h2 id="tt-editorial-title">${escape(copy.london)}</h2><p>${escape(copy.lead)}</p></div><div class="tt-editorial-grid">${selected.map(slug=>{const card=cards.find(item=>item.slug===slug);if(!card)throw Error('Missing published editorial '+slug);return `<article class="tt-editorial-card"><h3><a href="${card.href}">${escape(card.title)}</a></h3><p>${escape(card.lead)}</p><a class="tt-editorial-link" href="${card.href}">${escape(copy.read)} →</a></article>`;}).join('')}</div><p class="tt-editorial-guides"><a href="${prefix(lang)}/microguides/theatre-last-minute/">${escape(copy.guide)} →</a></p>`;
  ldoc.querySelector('main').appendChild(section);await fs.writeFile(londonFile,london.serialize());london.window.close();
}
console.log('[editorial] Six author profiles and localized London reading selections built');
