import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { AI_SEARCH_COPY } from '../src/ai-search/copy.js';
import sharp from 'sharp';
import { ensureSharedEventFiltersMarkup } from '../src/event-filters.js';
import { MICROGUIDE_LABELS } from '../src/microguide-copy.js';
import { BLOG_UI } from '../src/blog-ui.js';
import { finalizeSeoHtml, localizedSeoPath, SOCIALS } from '../scripts/finalize-seo.mjs';
import { buildStaticMain } from '../scripts/build-mg.mjs';
import { AMAZING_PLACES_BOOKING_URL, AMAZING_PLACES_VOUCHER_URL } from '../shared/amazing-places.js';
import { detailPath } from '../shared/event-details/state.js';
import { cataloguePath, CATALOGUE_FILTERS_HASH, CATALOGUE_RESULTS_HASH } from '../src/catalogue-search.js';
import { buildLocalizedPath } from '../src/utils/localized-path.js';
import londonRoutes from '../shared/london-musicals-routes.json' with { type: 'json' };
const LANGS=['cs','en','de','sk','pl','hu'],ORIGIN='https://ajsee.cz';
const RETIRED=['koncert-coldplay-praha-2025','praha-shakespeare-divadlo-2025','recenze-budapest-sziget-festival-2025'];
const prefix=lang=>lang==='cs'?'':lang+'/';
const load=file=>new JSDOM(fs.readFileSync(path.join('dist',file),'utf8'));
const clean=text=>String(text).replace(/\s+/g,' ').trim();
const jsons=doc=>[...doc.querySelectorAll('script[type="application/ld+json"]')].map(node=>JSON.parse(node.textContent));
function walk(value,visit){if(!value||typeof value!=='object')return;visit(value);Object.values(value).forEach(item=>walk(item,visit));}
const guides=JSON.parse(fs.readFileSync('content/microguides/index.json','utf8')).items.filter(item=>item.status==='published');
const published=fs.readdirSync('content/reviews/items').filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync('content/reviews/items/'+file,'utf8'))).filter(item=>item.status==='published'&&item.published===true);
// Deploy Previews intentionally expose staged reviews in the static blog index.
// Production must never contain these preview-only entries.
const previewMode=process.env.REVIEW_PREVIEW==='1';
const builtReviews=JSON.parse(fs.readFileSync('public/content/reviews/index.json','utf8')).items;
const privateReviews=builtReviews.filter(item=>item.previewOnly===true);
for(const item of builtReviews){
  const isPublished=item.status==='published'&&item.published===true;
  assert.ok(isPublished||(previewMode&&item.previewOnly===true),`Unpublished review leaked into a public build: ${item.slug}`);
}
if(!previewMode)assert.equal(privateReviews.length,0,'Production index contains preview-only reviews');

test('built search shells survive initialization and reserve the interactive controls in every language',()=>{
  for(const lang of LANGS) for(const route of lang==='cs'?['index.html','events.html','events/index.html']:['index.html','events/index.html']) {
    const dom=load(prefix(lang)+route),doc=dom.window.document;
    const form=doc.getElementById('events-filters-form');
    const pending=form.querySelector('[data-ai-static-intro]');
    const query=pending.querySelector('#ai-event-search-query');
    assert.ok(pending.hasAttribute('inert'));
    assert.equal(pending.querySelector('[data-ai-search-label]').textContent,AI_SEARCH_COPY[lang].label);
    assert.equal(query.placeholder,AI_SEARCH_COPY[lang].placeholder);
    assert.equal(pending.querySelector('[data-ai-search-submit]').textContent,AI_SEARCH_COPY[lang].submit);
    const quickChoices = form.querySelector(':scope > .home-quick-filters');
    if (route === 'index.html') {
      const copy = JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8'));
      assert.equal(clean(doc.querySelector('.home-intro').textContent), `${copy['home.hero.lead1']} ${copy['home.hero.lead2']}`);
      assert.equal(quickChoices.getAttribute('aria-label'), copy['home.quickFilters.label']);
      assert.deepEqual(
        [...quickChoices.querySelectorAll('button, a')].map(button => clean(button.textContent)),
        ['filters.weekend', 'category-concert', 'category-theatre', 'category-sport', 'filters.nearMe', 'home.quickFilters.refine'].map(key =>
          copy[key] ?? key.split('.').reduce((value, part) => value?.[part], copy)
        )
      );
      assert.equal(quickChoices.previousElementSibling, pending);
      assert.equal(form.querySelector('#events-filters-details'), null);
      const path = cataloguePath(lang);
      const routes = ['datePreset=weekend', 'segment=concert', 'segment=theatre', 'segment=sport'];
      assert.deepEqual([...quickChoices.querySelectorAll('a')].map(a => a.getAttribute('href')), [
        ...routes.map(query => `${path}?${query}${CATALOGUE_RESULTS_HASH}`),
        path + CATALOGUE_FILTERS_HASH
      ]);
      assert.equal(form.parentElement.querySelector(':scope > .home-hero-all')?.getAttribute('href'), path);
      assert.equal(pending.querySelector('[data-ai-search-helper]').textContent, AI_SEARCH_COPY[lang].homeHelper);
    } else {
      assert.equal(quickChoices, null);
      assert.equal(doc.querySelectorAll('#filter-city').length, 1);
      assert.equal(doc.querySelectorAll('#chipToday').length, 1);
    }
    ensureSharedEventFiltersMarkup(doc);
    assert.equal(form.querySelector('[data-ai-static-intro]'),pending);
    assert.equal(form.querySelector('#ai-event-search-query'),query);
    dom.window.close();
  }
});

test('home tips link to their own pages and the catalogue preserves older public detail links', () => {
  const pilot = JSON.parse(fs.readFileSync('content/event-detail-pilot.json', 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync('public/data/home-featured-events.json', 'utf8'));
  const archived = pilot.events.filter(event => !snapshot.recommendedIds.includes(event.id));
  for (const lang of LANGS) {
    const home = load(prefix(lang) + 'index.html');
    const listing = load(prefix(lang) + 'events/index.html');
    try {
      const links = (dom, selector) =>
        [...dom.window.document.querySelectorAll(selector + ' a')].map(link => link.getAttribute('href'));
      const expected = entries => entries.map(event => detailPath(event.slug, lang));
      assert.equal(home.window.document.querySelector('[data-event-detail-plan]'), null);
      assert.equal(listing.window.document.querySelector('[data-event-detail-plan]'), null);
      const homeLinks = [...home.window.document.querySelectorAll('#eventsList a.event-title-action')]
        .map(link => link.getAttribute('href'));
      assert.deepEqual(homeLinks, snapshot.recommendedIds.map(id => detailPath(snapshot.detailSlugs[id], lang)));
      assert.equal(listing.window.document.querySelector('#eventsList a.event-title-action'), null);
      assert.deepEqual(links(listing, '[data-event-detail-archive]'), expected(archived));
      assert.equal(home.window.document.querySelector('[data-event-detail-archive]'), null);
      const archive = listing.window.document.querySelector('[data-event-detail-archive]');
      assert.equal(archive.open, false);
      assert.equal(archive.hidden, archived.length === 0);
    } finally {
      home.window.close();
      listing.window.close();
    }
  }
});

test('the homepage makes both Amazing Places offers discoverable in all six initial HTML documents', () => {
  for (const lang of LANGS) {
    const home = load(prefix(lang) + 'index.html');
    const stays = load(prefix(lang) + 'accommodation/index.html');
    try {
      const doc = home.window.document;
      const copy = JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8'));
      const banner = doc.querySelector('.home-promo--amazing-places');
      const heading = banner.querySelector('h2');
      const photo = banner.querySelector('img');
      const links = [...banner.querySelectorAll('a[href]')];

      assert.equal(doc.documentElement.lang, lang);
      assert.deepEqual([...doc.querySelectorAll('h1')].map(node => node.id), ['home-title']);
      assert.equal(doc.querySelector('link[rel="canonical"]').href, ORIGIN + '/' + prefix(lang));
      const alternates = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')];
      assert.equal(alternates.length, 7);
      for (const alternate of alternates) {
        const language = alternate.hreflang === 'x-default' ? 'cs' : alternate.hreflang;
        assert.equal(alternate.href, ORIGIN + '/' + prefix(language));
      }
      assert.equal(banner.getAttribute('aria-labelledby'), heading.id);
      assert.equal(heading.textContent, copy['home.amazingPlaces.title']);
      assert.equal(banner.querySelector('p').textContent, copy['home.amazingPlaces.text']);
      assert.equal(photo.alt, copy['home.amazingPlaces.imageAlt']);
      assert.equal(photo.getAttribute('loading'), 'lazy');
      assert.match(photo.getAttribute('srcset'), /320w.+640w/);
      assert.equal(banner.querySelector('.home-promo-image-note').textContent, copy['home.amazingPlaces.imageNote']);

      const route = lang === 'cs' ? '/accommodation' : `/${lang}/accommodation/`;
      const targets = [
        ['amazing-places', copy['home.amazingPlaces.stays'], AMAZING_PLACES_BOOKING_URL],
        ['vouchers', copy['home.amazingPlaces.vouchers'], AMAZING_PLACES_VOUCHER_URL],
      ];
      assert.equal(links.length, targets.length);
      targets.forEach(([id, label, destination], index) => {
        assert.equal(links[index].getAttribute('href'), `${route}#${id}`);
        assert.equal(clean(links[index].textContent), label);
        const target = stays.window.document.getElementById(id);
        assert.ok(target?.querySelector(`a[href="${destination}"]`));
      });
      jsons(doc);
    } finally {
      home.window.close();
      stays.window.close();
    }
  }
});

test('homepage partner groups are ordered and localized in the initial HTML', () => {
  for (const lang of LANGS) {
    const home = load(prefix(lang) + 'index.html');
    try {
      const { document, Node } = home.window;
      const copy = JSON.parse(fs.readFileSync('src/locales/' + lang + '.json', 'utf8'));
      const tickets = document.querySelector('.home-partners--tickets');
      const stays = document.querySelector('.home-explore .home-partners--stays');
      const partner = stays?.querySelector('img[alt="Amazing Places"]');
      const following = Node.DOCUMENT_POSITION_FOLLOWING;

      assert.ok(document.getElementById('hero').compareDocumentPosition(tickets) & following);
      assert.ok(tickets.compareDocumentPosition(document.getElementById('events')) & following);
      assert.equal(tickets.querySelector('h2').textContent, copy['home.partners.label']);
      assert.deepEqual([...tickets.querySelectorAll('img')].map(img => img.alt),
        ['Ticketmaster', 'smsticket', 'TodayTix', 'ColosseumTicket']);
      assert.equal(stays.querySelector('h2').textContent, copy['home.partners.staysLabel']);
      assert.equal(stays.querySelector('.home-partner-badge').textContent, copy['home.partners.new']);
      assert.equal(partner.getAttribute('src'), '/images/partners/amazing-places.svg');
      const route = lang === 'cs' ? '/accommodation' : '/' + lang + '/accommodation/';
      assert.equal(partner.closest('a').getAttribute('href'), route + '#amazing-places');
    } finally {
      home.window.close();
    }
  }
});

test('published review covers reserve their actual image dimensions in all translations',async()=>{
  for(const review of published) {
    if(!review.cover?.startsWith('/'))continue;
    const metadata=await sharp(path.join('public',review.cover)).metadata();
    const dimensions=metadata.autoOrient||metadata;
    for(const lang of LANGS) {
      if(!review.translations?.[lang])continue;
      const dom=load(prefix(lang)+'reviews/'+review.slug+'/index.html');
      const image=dom.window.document.querySelector('.review-cover');
      assert.equal(image.getAttribute('width'),String(dimensions.width),review.slug);
      assert.equal(image.getAttribute('height'),String(dimensions.height),review.slug);
      assert.equal(image.style.getPropertyValue('--review-cover-width'),dimensions.width+'px');
      assert.equal(image.style.getPropertyValue('--review-cover-ratio'),`${dimensions.width} / ${dimensions.height}`);
      dom.window.close();
    }
  }
});

test('editorial features and undated production reviews never invent an Event',()=>{
  for(const slug of ['mamma-mia-from-abba-to-the-west-end','10-west-end-musicals-worth-travelling-to-london-for',
    'why-west-end-changed-how-i-experience-live-theatre','sunset-boulevard-the-hollywood-classic-that-became-a-musical',
    'singin-in-the-rain-from-hollywood-to-the-stage']) {
    assert.equal(published.find(item=>item.slug===slug).contentType,'article',slug);
  }
  for(const item of published) for(const lang of LANGS) {
    const dom=load(prefix(lang)+'reviews/'+item.slug+'/index.html'),doc=dom.window.document;
    const entities=[];
    jsons(doc).forEach(value=>walk(value,node=>{
      if(node['@type']==='Review'||node['@type']==='Article')entities.push(node);
      if(node['@type']==='Event')assert.ok(Number.isFinite(Date.parse(node.startDate)),item.slug+': Event requires a supplied date');
    }));
    assert.equal(entities.length,1,item.slug);
    const entity=entities[0],type=item.contentType||'review';
    assert.equal(doc.querySelector('.review-detail').dataset.reviewContentType,type);
    if(type!=='preview')assert.equal(doc.querySelector('.review-content-type-badge').textContent.trim(),BLOG_UI[lang].badges[type]);
    assert.equal(entity.dateModified,item.updatedAt||item.publishedAt||item.reviewDate);
    const suppliedDate=item.eventDate||item.performanceDate;
    if(type==='article'||(type==='review'&&!suppliedDate)) {
      assert.equal(entity['@type'],'Article');
      assert.equal(entity.about['@type'],'CreativeWork');
      assert.equal(entity.itemReviewed,undefined);
      assert.equal(entity.reviewRating,undefined);
    } else {
      const subject=type==='preview'?entity.about:entity.itemReviewed;
      assert.equal(entity['@type'],type==='preview'?'Article':'Review');
      assert.equal(subject['@type'],suppliedDate?'Event':'CreativeWork');
      assert.equal(subject.name,type==='preview'?item.showTitle||item.productionTitle:item.productionTitle||item.showTitle);
      assert.equal(subject.startDate,suppliedDate||undefined);
    }
    dom.window.close();
  }
});

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
  test(`${lang}: primary navigation and footer use localized, crawlable links`, () => {
    const dictionary = JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8'));
    const keys = ['nav-events', 'nav-london-musicals', 'nav-accommodation', 'nav-reviews', 'nav-about', 'nav-partners'];
    const localized = route => lang === 'cs' ? `/${route}` : `/${lang}/${route}/`;
    const home = lang === 'cs' ? '/' : `/${lang}/`;
    const links = [localized('events'), londonRoutes[lang], localized('accommodation'), localized('blog'), localized('about'), localized('partners')];
    const pages = [
      [prefix(lang) + 'index.html', null],
      [londonRoutes[lang].slice(1) + 'index.html', 'nav-london-musicals'],
      [prefix(lang) + 'blog/index.html', 'nav-reviews'],
      [prefix(lang) + 'partners/index.html', 'nav-partners'],
    ];

    for (const [file, activeKey] of pages) {
      const dom = load(file);
      const doc = dom.window.document;
      const nav = doc.querySelector('#mainNav');
      const menuLinks = [...nav.querySelectorAll(':scope > ul a')];

      assert.equal(nav.getAttribute('aria-label'), dictionary['nav-main-label']);
      assert.deepEqual(menuLinks.map(link => link.dataset.i18nKey), keys);
      assert.deepEqual(menuLinks.map(link => link.getAttribute('href')), links);
      assert.deepEqual(menuLinks.map(link => clean(link.textContent)), keys.map(key => dictionary[key]));
      assert.equal(nav.querySelector('.main-nav-partners a'), menuLinks.at(-1));
      assert.equal(nav.querySelector('[aria-current="page"]')?.dataset.i18nKey ?? null, activeKey);

      const logo = doc.querySelector('.logo-link');
      assert.equal(logo.getAttribute('href'), home);
      assert.equal(logo.getAttribute('aria-label'), dictionary['nav-logo-home']);
      const footer = doc.querySelector('.footer-navigation');
      assert.deepEqual([...footer.querySelectorAll('h2')].map(heading => clean(heading.textContent)), [dictionary['footer-help'], dictionary['footer-cooperation']]);
      assert.deepEqual([...footer.querySelectorAll('a')].map(link => link.getAttribute('href')), [localized('faq'), `${home}#contact`, localized('partners')]);
      assert.equal(clean(footer.querySelector('[data-i18n-key="footer-faq"]').textContent), dictionary['footer-faq']);
      dom.window.close();
    }

    for (const route of Object.values(londonRoutes)) {
      assert.equal(buildLocalizedPath(route, lang), londonRoutes[lang]);
    }
  });
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
      const cta=doc.querySelector('.mg-footer-cta a');
      const londonRoutes={cs:'/londynske-muzikaly/',en:'/en/london-musicals/',de:'/de/london-musicals/',sk:'/sk/londynske-muzikaly/',pl:'/pl/londynskie-musicale/',hu:'/hu/londoni-musicalek/'};
      const expectedCta=guide.slug==='theatre-last-minute'?londonRoutes[lang]:(lang==='cs'?'/events':'/'+lang+'/events/');
      assert.equal(cta.getAttribute('href'),expectedCta,guide.slug+': the next step must open the relevant live offer');
      assert.ok(clean(cta.textContent).length>0);
      assert.equal(doc.querySelectorAll('main a[href*="coming-soon"]').length,0,guide.slug);
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
      if(route==='blog'){
        const cards=JSON.parse(doc.getElementById('blog-initial-data').textContent).cards;
        assert.equal(cards.length,published.length+guides.length+privateReviews.length);
        for(const review of privateReviews)assert.ok(cards.some(card=>card.slug===review.slug),`Missing preview card: ${review.slug}`);
      }
      if(route==='faq')assert.equal(doc.querySelectorAll('[data-faq-item]').length,15);
      if(route==='events'){
        const dictionary=JSON.parse(fs.readFileSync('src/locales/'+lang+'.json','utf8'));
        assert.equal(doc.querySelector('#demoBadgeCta').getAttribute('href'),lang==='cs'?'/accommodation':'/'+lang+'/accommodation/');
        assert.equal(clean(doc.querySelector('#demoBadge .ib-text span').textContent),dictionary['event-demo'].body);
        assert.equal(clean(doc.querySelector('.events-benefits h2').textContent),dictionary['events-buying'].title);
        assert.equal(clean(doc.querySelector('.events-buying-copy').textContent),dictionary['events-buying'].body);
        const buyingLinks=[...doc.querySelectorAll('.events-buying-links a')].map(a=>a.getAttribute('href'));
        assert.deepEqual(buyingLinks,lang==='cs'?['/partners','/faq','/microguides/fees-refund/']:['/'+lang+'/partners/','/'+lang+'/faq/','/'+lang+'/microguides/fees-refund/']);
        assert.equal(doc.querySelectorAll('meta[name="description"]').length,1);
        assert.equal(doc.querySelector('meta[name="description"]').content,dictionary['events-page-description']);
        assert.equal(doc.querySelector('meta[property="og:description"]').content,dictionary['events-page-description']);
        assert.ok(doc.querySelector('[data-ai-static-intro]').textContent.includes('AJSEE'));
        assert.equal(clean(doc.querySelector('[data-ai-static-intro] .ai-event-search__helper').textContent),clean(AI_SEARCH_COPY[lang].helper));
        assert.ok(doc.querySelectorAll('[data-events-static] .event-card').length>0);
      }
      dom.window.close();
    }
    const home=load(prefix(lang)+'index.html');assert.ok(home.window.document.querySelector('[data-ai-static-intro]').textContent.includes('AJSEE'));home.window.close();
    const contest=load(prefix(lang)+'souteze/filmovy-orchestr-praha/index.html');assert.equal(contest.window.document.querySelector('[data-i18n-key="nav-contact"]').getAttribute('href'),(lang==='cs'?'/':'/'+lang+'/')+'#contact');contest.window.close();
  });
  test(lang + ': the built accommodation page preserves campaign URLs and metadata', t => {
    const page = load(prefix(lang) + 'accommodation/index.html');
    t.after(() => page.window.close());
    const doc = page.window.document;
    const copy = JSON.parse(fs.readFileSync(`src/locales/${lang}/accommodation.json`, 'utf8'));
    assert.equal(doc.documentElement.lang, lang);
    assert.equal(doc.title, copy.seo.accommodation.title);
    assert.equal(doc.querySelector('meta[name="description"]').content, copy.seo.accommodation.description);
    assert.equal(doc.querySelector('link[rel="canonical"]').href, ORIGIN + (lang === 'cs' ? '/accommodation' : `/${lang}/accommodation/`));
    assert.equal(doc.querySelectorAll('head link[rel="alternate"][hreflang]').length, 7);

    assert.equal(doc.querySelector('a[data-placement="accommodation_booking"]').href, AMAZING_PLACES_BOOKING_URL);
    assert.equal(doc.querySelector('a[data-placement="accommodation_voucher"]').href, AMAZING_PLACES_VOUCHER_URL);
    assert.equal(doc.querySelector('.stay-country--amazing-places .stay-country-location').textContent, copy.accommodation.amazingPlaces.destinations);
    assert.equal(doc.querySelector('#vouchers h2').textContent, copy.accommodation.vouchers.title);

    const trustedstaysLinks = [...doc.querySelectorAll('.stay-country a[data-trustedstays-outbound]')];
    assert.equal(trustedstaysLinks.length, 2);
    for (const link of trustedstaysLinks) {
      assert.equal(new URL(link.href).searchParams.get('utm_campaign'), 'ajsee_accommodation_launch');
    }
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
