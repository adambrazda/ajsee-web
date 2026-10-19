import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { MICROGUIDE_LABELS } from '../src/microguide-copy.js';
import { finalizeSeoHtml, localizedSeoPath, SOCIALS } from '../scripts/finalize-seo.mjs';
import { buildStaticMain } from '../scripts/build-mg.mjs';
const LANGS=['cs','en','de','sk','pl','hu'],ORIGIN='https://ajsee.cz';
const RETIRED=['koncert-coldplay-praha-2025','praha-shakespeare-divadlo-2025','recenze-budapest-sziget-festival-2025'];
const prefix=lang=>lang==='cs'?'':lang+'/';
const load=file=>new JSDOM(fs.readFileSync(path.join('dist',file),'utf8'));
const clean=text=>String(text).replace(/\s+/g,' ').trim();
const jsons=doc=>[...doc.querySelectorAll('script[type="application/ld+json"]')].map(node=>JSON.parse(node.textContent));
function walk(value,visit){if(!value||typeof value!=='object')return;visit(value);Object.values(value).forEach(item=>walk(item,visit));}
const guides=JSON.parse(fs.readFileSync('content/microguides/index.json','utf8')).items.filter(item=>item.status==='published');
const published=fs.readdirSync('content/reviews/items').filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync('content/reviews/items/'+file,'utf8'))).filter(item=>item.status==='published'&&item.published===true);

test('localized SEO never forks the global Organization identity or partner links',()=>{
  assert.equal(localizedSeoPath(ORIGIN+'/blog/','cs'),ORIGIN+'/blog');
  assert.equal(localizedSeoPath(ORIGIN+'/blog/','en'),ORIGIN+'/en/blog/');
  assert.equal(localizedSeoPath(ORIGIN+'/londynske-muzikaly/','pl'),ORIGIN+'/pl/londynskie-musicale/');
  const html='<html lang="de"><head><title>Titel</title><link rel="canonical" href="https://ajsee.cz/de/about/"><script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'Organization',name:'AJSEE',url:ORIGIN+'/'},{'@type':'AboutPage',url:ORIGIN+'/about',inLanguage:'cs',name:'O nás'}]})+'</script></head><body><main><h1>Über AJSEE</h1><a href="https://tickets.colosseum.eu/test?a_box=example">Partner</a></main></body></html>';
  const dom=new JSDOM(finalizeSeoHtml(html)),doc=dom.window.document,graph=jsons(doc)[0]['@graph'];
  assert.equal(graph[0].url,ORIGIN+'/');assert.equal(graph[0].legalName,'AJSEE LTD');assert.deepEqual(graph[0].sameAs,SOCIALS);
  assert.equal(graph[1].url,ORIGIN+'/de/about/');assert.equal(graph[1].inLanguage,'de');assert.equal(graph[1].name,'Über AJSEE');
  assert.equal(doc.querySelector('a').href,'https://tickets.colosseum.eu/test?a_box=example');dom.window.close();
});

for(const lang of LANGS){
  test(lang+': translated micro-guide content, labels, metadata and dates exist before JS',()=>{
    let dom=load(prefix(lang)+'microguides/index.html'),doc=dom.window.document;
    assert.equal(clean(doc.querySelector('main h1').textContent),MICROGUIDE_LABELS[lang].indexHeading);
    assert.equal(doc.querySelectorAll('.mg-card').length,guides.length);dom.window.close();
    for(const guide of guides){
      const data=JSON.parse(fs.readFileSync('content/microguides/'+guide.slug+'.'+lang+'.json','utf8'));
      dom=load(prefix(lang)+'microguides/'+guide.slug+'/index.html');doc=dom.window.document;
      assert.equal(clean(doc.querySelector('main h1').textContent),clean(data.title));
      const expected = new JSDOM(buildStaticMain(data,lang,guide.slug));
      assert.equal(clean(doc.querySelector('main').textContent),clean(expected.window.document.querySelector('main').textContent),guide.slug);
      expected.window.close();
      const description=doc.querySelector('meta[name="description"]').content;
      assert.ok(description.length>30 && data.summary.startsWith(description.replace(/…$/,'')),guide.slug);
      assert.ok(clean(doc.querySelector('main').textContent).includes(MICROGUIDE_LABELS[lang].backToBlog));
      assert.ok(doc.title.includes(data.title));
      let article;jsons(doc).forEach(value=>walk(value,node=>{if(node['@type']==='Article')article=node;}));
      assert.equal(article.inLanguage,lang);assert.equal(article.datePublished,guide.publishedAt);
      assert.ok(article.mainEntityOfPage['@id'].includes('/microguides/'+guide.slug+'/'));dom.window.close();
    }
  });
  test(lang+': main page metadata, AI explanation, FAQ and contact navigation are consistent',()=>{
    for(const route of ['events','about','blog','faq']){
      const file=lang==='cs'?route+'.html':lang+'/'+route+'/index.html';
      const dom=load(file),doc=dom.window.document,canonical=doc.querySelector('link[rel="canonical"]').href;
      assert.equal(doc.documentElement.lang,lang);
      assert.equal(doc.querySelector('meta[property="og:url"]').content,canonical);
      jsons(doc).forEach(value=>walk(value,node=>{
        if(['AboutPage','Blog','CollectionPage','FAQPage','WebPage','Article','Review'].includes(node['@type']))assert.equal(node.inLanguage,lang,route);
        if(node['@type']==='BreadcrumbList')for(const item of node.itemListElement){
          if(typeof item.item==='string'&&item.item.startsWith(ORIGIN))assert.ok(lang==='cs'||new URL(item.item).pathname.startsWith('/'+lang+'/'),item.item);
        }
      }));
      if(route==='blog')assert.equal(JSON.parse(doc.getElementById('blog-initial-data').textContent).cards.length,published.length+guides.length);
      if(route==='faq')assert.equal(doc.querySelectorAll('[data-faq-item]').length,15);
      if(route==='events'){
        const dictionary=JSON.parse(fs.readFileSync('src/locales/'+lang+'.json','utf8'));
        assert.equal(doc.querySelectorAll('meta[name="description"]').length,1);
        assert.equal(doc.querySelector('meta[name="description"]').content,dictionary['events-page-description']);
        assert.equal(doc.querySelector('meta[property="og:description"]').content,dictionary['events-page-description']);
        assert.ok(doc.querySelector('[data-ai-static-intro]').textContent.includes('AJSEE'));
        assert.equal(clean(doc.querySelector('[data-ai-static-intro] .ai-event-search__helper').textContent),clean(dictionary['ai-search-static-intro']));
        assert.ok(doc.querySelectorAll('[data-events-static] .event-card').length>0);
      }
      dom.window.close();
    }
    const home=load(prefix(lang)+'index.html');assert.ok(home.window.document.querySelector('[data-ai-static-intro]').textContent.includes('AJSEE'));home.window.close();
    const contest=load(prefix(lang)+'souteze/filmovy-orchestr-praha/index.html');assert.equal(contest.window.document.querySelector('[data-i18n-key="nav-contact"]').getAttribute('href'),(lang==='cs'?'/':'/'+lang+'/')+'#contact');contest.window.close();
  });
  test(lang+': author profile lists only published texts and review bylines link to it',()=>{
    const dom=load(prefix(lang)+'authors/oya-canli/index.html'),doc=dom.window.document;
    const texts=published.filter(item=>item.author==='Oya Canli');
    assert.equal(doc.querySelectorAll('.author-article').length,texts.length);
    assert.equal(doc.querySelector('main h1').textContent,'Oya Canli');
    assert.equal(doc.querySelectorAll('link[hreflang]').length,7);
    for(const item of texts){
      assert.ok(doc.querySelector('a[href="'+(lang==='cs'?'':'/'+lang)+'/reviews/'+item.slug+'/"]'));
      const review=load(prefix(lang)+'reviews/'+item.slug+'/index.html');
      assert.equal(review.window.document.querySelector('a[rel="author"]').getAttribute('href'),(lang==='cs'?'':'/'+lang)+'/authors/oya-canli/');
      review.window.close();
    }dom.window.close();
  });
  test(lang+': retired article URLs and hreflang references are absent',()=>{
    for(const slug of RETIRED)assert.ok(!fs.existsSync(path.join('dist',prefix(lang),'blog',slug,'index.html')));
    for(const file of [prefix(lang)+'index.html',lang==='cs'?'blog.html':lang+'/blog/index.html']){
      const html=fs.readFileSync('dist/'+file,'utf8');for(const slug of RETIRED)assert.ok(!html.includes(slug));
    }
  });
}
test('sitemap is stable across unchanged rebuilds and uses explicit meaningful dates',()=>{
  const before=fs.readFileSync('dist/sitemap.xml','utf8');
  execFileSync(process.execPath,['scripts/generate-sitemap.cjs'],{stdio:'pipe'});
  assert.equal(fs.readFileSync('dist/sitemap.xml','utf8'),before);
  for(const slug of RETIRED)assert.ok(!before.includes(slug));
  assert.ok(!before.includes('2026-05-'));
  assert.ok(before.includes('<lastmod>2026-10-19</lastmod>'));
  for(const lang of LANGS)assert.ok(before.includes(ORIGIN+'/'+prefix(lang)+'authors/oya-canli/'));
});
test('responsive portraits reduce bytes and preserve original sources',()=>{
  for(const name of ['adam','jan']){
    const original=fs.statSync('public/images/team/'+name+'.png').size;
    for(const width of [192,384,768])assert.ok(fs.statSync('public/images/team/'+name+'-'+width+'.webp').size<original/5);
  }
});

test('unknown or retired blog slugs cannot fall through to a successful generic detail rewrite',()=>{
  const redirects=fs.readFileSync('public/_redirects','utf8');
  assert.ok(!/^\/blog\/:slug\/?\s+\/blog-detail\s+200\b/m.test(redirects));
});
