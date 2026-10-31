import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { auditCrawlDiscovery } from '../scripts/audit-crawl-discovery.mjs';
import { finalizeSeoHtml } from '../scripts/finalize-seo.mjs';

test('all sitemap pages are reachable from the homepage through initial HTML links',async()=>{
  const audit=await auditCrawlDiscovery();
  assert.ok(audit.total>=222);
  assert.deepEqual(audit.unreachable,[]);
  assert.deepEqual(audit.orphans,[]);
  for(const page of audit.pages) {
    assert.equal(page.canonical,page.url);
    assert.equal(page.noindex,false,page.url);
    for(const option of page.languages) {
      assert.equal(option.tag,'A',page.url);
      assert.equal(new URL(option.href,page.url).href,option.expected,page.url+' '+option.lang);
    }
  }
  for(const lang of ['cs','en','de','sk','pl','hu']) {
    const prefix=lang==='cs'?'':'/'+lang;
    const hub=audit.pages.find(page=>page.url==='https://ajsee.cz'+prefix+'/microguides/');
    assert.ok(hub.incoming.filter(url=>url.startsWith('https://ajsee.cz'+prefix+'/microguides/')).length>=6);
  }
});

test('language anchors use translated hreflang routes and are idempotent',()=>{
  const source='<html lang="cs"><head><link rel="canonical" href="https://ajsee.cz/londynske-muzikaly/"><link rel="alternate" hreflang="en" href="https://ajsee.cz/en/london-musicals/"></head><body><main><h1>Londýn</h1></main><div class="language-switcher"><button class="lang-btn" type="button" data-lang="en"><img src="/en.svg">English</button></div></body></html>';
  const once=finalizeSeoHtml(source),twice=finalizeSeoHtml(once);
  const dom=new JSDOM(twice),link=dom.window.document.querySelector('.lang-btn');
  assert.equal(link.tagName,'A');
  assert.equal(link.getAttribute('href'),'/en/london-musicals/');
  assert.equal(link.getAttribute('hreflang'),'en');
  assert.equal(link.hasAttribute('type'),false);
  assert.equal(dom.window.document.querySelectorAll('.lang-btn').length,1);
  dom.window.close();
});

test('navigation initialization preserves mobile language links on FAQ pages',()=>{
  const languages=['cs','en','de','sk','pl','hu'];
  for(const lang of languages) {
    const target=l=>l==='cs'?'/faq':'/'+l+'/faq/';
    const markup='<header class="site-header"><nav class="main-nav"><ul><li><a href="/faq">FAQ</a></li></ul><div class="language-switcher"><details class="lang-dropdown"><summary>Language</summary><div class="lang-menu">'+languages.map(l=>`<a class="lang-btn" data-lang="${l}" href="${target(l)}"${l===lang?' aria-current="true"':''}>${l}</a>`).join('')+'</div></details></div></nav></header>';
    const dom=new JSDOM(markup,{url:'https://ajsee.cz'+target(lang),runScripts:'outside-only'});
    const source=fs.readFileSync('src/nav-core.js','utf8').replace(/export function /g,'function ').replace(/export \{[^}]+\};/g,'');
    vm.runInContext(source+'\ninitNav({lang:'+JSON.stringify(lang)+'});',dom.getInternalVMContext());
    const doc=dom.window.document;
    assert.equal(doc.querySelectorAll('.lang-btn').length,6,lang+': FAQ deduplication removed language choices');
    for(const link of doc.querySelectorAll('.lang-btn'))assert.equal(link.getAttribute('href'),target(link.dataset.lang));
    assert.equal(doc.querySelector('.lang-btn[aria-current="true"]').dataset.lang,lang);
    dom.window.close();
  }
});

test('runtime internal link localization preserves explicit language destinations',()=>{
  const dom=new JSDOM('<a class="lang-btn" data-lang="en" href="/en/about/">English</a><a id="regular" href="/blog">Blog</a>',{url:'https://ajsee.cz/about',runScripts:'outside-only'});
  const source=fs.readFileSync('src/i18n.js','utf8').replace(/import\.meta\.glob\([^;]+\)/,'{}').replace(/export (?=(?:async )?(?:function|const|let))/g,'');
  vm.runInContext(source+'\npatchInternalLinksWithLang("de");',dom.getInternalVMContext());
  assert.equal(dom.window.document.querySelector('.lang-btn').getAttribute('href'),'/en/about/');
  assert.equal(dom.window.document.getElementById('regular').getAttribute('href'),'/de/blog/');
  dom.window.close();
});
