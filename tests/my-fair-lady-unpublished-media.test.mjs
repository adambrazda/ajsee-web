import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const slug='my-fair-lady-70-years-musical-legend';
const base='/uploads/reviews/'+slug+'/';
const sourceBase=path.resolve('assets/editorial',slug);
const languages=['en','cs','sk','de','pl','hu'];
const names=['eliza-ensemble','eliza-solo','eliza-higgins','ensemble'];

test('My Fair Lady staged editorial has the four approved Opera Australia images, but remains unpublished', async () => {
  const data=JSON.parse(await readFile(path.resolve('content/reviews/items',slug+'.json'),'utf8'));
  assert.equal(data.published,false);
  assert.equal(data.featured,false);
  assert.equal(data.publishedAt,'');
  assert.equal(data.cover,base+'my-fair-lady-2026-eliza-ensemble.webp');
  assert.equal(data.coverCredit,'Photo: Jeff Busby / Opera Australia');
  assert.equal(data.gallery.length,3);
  assert.deepEqual(Object.keys(data.translations).sort(),languages.sort());
  const references=[data.cover,...data.gallery.map(x=>x.image)];
  assert.equal(new Set(references).size,4);
  assert.deepEqual(references,names.map(x=>base+'my-fair-lady-2026-'+x+'.webp'));
  assert.ok(data.gallery.every(x=>x.credit==='Photo: Jeff Busby / Opera Australia' && x.alt?.length>25));
  for(const name of names) {
    const jpg=await stat(path.join(sourceBase,name+'-jeff-busby.jpg'));
    assert.ok(jpg.size>20000, 'Missing archival IG JPEG for '+name);
  }
  for(const img of references) {
    const local=path.resolve('public','.'+img);
    const metadata=await sharp(local).metadata();
    assert.equal(metadata.format,'webp');
    assert.ok(metadata.width>=700 && metadata.height>=450,'Photo too small: '+img);
    assert.ok((await stat(local)).size<300*1024,'Photo too heavy: '+img);
  }
  for(const [lang,content] of Object.entries(data.translations)){
    assert.ok(content.coverAlt?.length>30,'Missing cover alt in '+lang);
    assert.equal(content.galleryAlts?.length,3,'Missing gallery alt in '+lang);
    assert.ok(content.galleryAlts.every(x=>x.length>25));
  }
});
