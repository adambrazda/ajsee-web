import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { auditCrawlDiscovery } from '../scripts/audit-crawl-discovery.mjs';
import { finalizeSeoHtml } from '../scripts/finalize-seo.mjs';
import { buildLocalizedPath } from '../src/utils/localized-path.js';
import londonRoutes from '../shared/london-musicals-routes.json' with { type: 'json' };

function browserScript(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/^import \{ buildLocalizedPath \} from '[^']+';\r?\n/m, '')
    .replace(/export (?=(?:async )?(?:function|const|let))/g, '')
    .replace(/export \{[^}]+\};/g, '');
}

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

test('navigation initialization preserves mobile language links on FAQ pages',async()=>{
  const languages=['cs','en','de','sk','pl','hu'];
  const source = browserScript('src/nav-core.js');
  for(const lang of languages) {
    const target=l=>l==='cs'?'/faq':'/'+l+'/faq/';
    const markup = fs.readFileSync(lang === 'cs' ? 'dist/faq.html' : `dist/${lang}/faq/index.html`, 'utf8');
    const dom=new JSDOM(markup,{url:'https://ajsee.cz'+target(lang),runScripts:'outside-only',pretendToBeVisual:true});
    const doc=dom.window.document;
    const mobileSwitch = doc.querySelector('.main-nav .mobile-switcher');
    mobileSwitch.querySelector(`.lang-btn[data-lang="${lang}"]`).setAttribute('aria-current', 'true');
    dom.window.buildLocalizedPath = buildLocalizedPath;
    vm.runInContext(source+'\ninitNav({lang:'+JSON.stringify(lang)+'});',dom.getInternalVMContext());
    assert.equal(mobileSwitch.querySelectorAll('.lang-btn').length,6);
    for(const link of mobileSwitch.querySelectorAll('.lang-btn'))assert.equal(link.getAttribute('href'),target(link.dataset.lang));
    assert.equal(mobileSwitch.querySelector('.lang-btn[aria-current="true"]').dataset.lang,lang);
    assert.equal(doc.querySelector('.main-nav [data-i18n-key="nav-london-musicals"]').getAttribute('href'), londonRoutes[lang]);
    assert.equal(doc.querySelector('.footer-navigation [data-i18n-key="nav-contact"]').getAttribute('href'), lang === 'cs' ? '/#contact' : `/${lang}/#contact`);

    const opener = doc.querySelector('.hamburger-btn');
    const closeButton = doc.querySelector('.main-nav .menu-close');
    opener.click();
    assert.equal(opener.getAttribute('aria-expanded'), 'true');
    await new Promise(resolve => dom.window.requestAnimationFrame(resolve));
    assert.equal(doc.activeElement, closeButton);
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(opener.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.activeElement, opener);
    dom.window.close();
  }
});

test('runtime internal link localization preserves explicit language destinations',()=>{
  const dom=new JSDOM('<a class="lang-btn" data-lang="en" href="/en/about/">English</a><a id="regular" href="/blog">Blog</a><a id="london" href="/londynske-muzikaly/">Muzikály v Londýně</a>',{url:'https://ajsee.cz/about',runScripts:'outside-only'});
  const source=browserScript('src/i18n.js').replace(/import\.meta\.glob\([^;]+\)/,'{}');
  dom.window.buildLocalizedPath = buildLocalizedPath;
  vm.runInContext(source+'\npatchInternalLinksWithLang("de");',dom.getInternalVMContext());
  assert.equal(dom.window.document.querySelector('.lang-btn').getAttribute('href'),'/en/about/');
  assert.equal(dom.window.document.getElementById('regular').getAttribute('href'),'/de/blog/');
  assert.equal(dom.window.document.getElementById('london').getAttribute('href'),'/de/london-musicals/');
  dom.window.close();
});
