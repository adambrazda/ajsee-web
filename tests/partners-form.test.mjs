import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../partners.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/partners.js', import.meta.url), 'utf8');
const translations = JSON.parse(readFileSync(new URL('../src/locales/partners-cs.json', import.meta.url), 'utf8'));

async function setup(fetchImpl) {
  const dom = new JSDOM(html, { url: 'https://ajsee.cz/partners/', runScripts: 'outside-only' });
  dom.window.translations = translations;
  dom.window.fetch = fetchImpl;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const ready = new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  dom.window.eval(source);
  await ready;
  return dom;
}

function fill(form) {
  for (const [name, value] of Object.entries({ company: 'Test partner', name: 'Test contact', email: 'contact@example.com', message: 'A partnership enquiry.' })) {
    form.elements.namedItem(name).value = value;
  }
}

async function submit(dom) {
  dom.window.document.getElementById('partner-contact-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
}

test('invalid enquiry stays on the page and focuses the first missing field', async () => {
  let requests = 0;
  const dom = await setup(async () => { requests++; return { ok: true }; });
  try {
    await submit(dom);
    assert.equal(requests, 0);
    const company = dom.window.document.getElementById('company');
    assert.equal(company.getAttribute('aria-invalid'), 'true');
    assert.equal(dom.window.document.activeElement, company);
    assert.match(dom.window.document.getElementById('error-company').textContent, /firmy nebo značky/);
  } finally { dom.window.close(); }
});

test('valid enquiry sends the named fields and Netlify form identifier once', async () => {
  const requests = [];
  const dom = await setup(async (url, options) => { requests.push({ url, options }); return { ok: true }; });
  try {
    const form = dom.window.document.getElementById('partner-contact-form');
    fill(form);
    await submit(dom);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/');
    assert.equal(requests[0].options.method, 'POST');
    const body = new URLSearchParams(requests[0].options.body);
    assert.equal(body.get('form-name'), 'partner-contact');
    assert.equal(body.get('name'), 'Test contact');
    assert.equal(body.get('email'), 'contact@example.com');
    assert.equal(form.style.display, 'none');
    assert.equal(dom.window.document.getElementById('partner-contact-success').style.display, 'block');
  } finally { dom.window.close(); }
});

test('failed submission preserves the enquiry and shows the partner email for retry', async () => {
  let requests = 0;
  const dom = await setup(async () => ({ ok: ++requests > 1 }));
  try {
    const form = dom.window.document.getElementById('partner-contact-form');
    fill(form);
    await submit(dom);
    const error = dom.window.document.getElementById('partner-contact-error');
    assert.equal(error.style.display, 'block');
    assert.match(error.textContent, /partners@ajsee\.cz/);
    assert.equal(form.elements.namedItem('message').value, 'A partnership enquiry.');
    assert.equal(form.querySelector('button[type="submit"]').disabled, false);
    await submit(dom);
    assert.equal(requests, 2);
    assert.equal(error.style.display, 'none');
    assert.equal(dom.window.document.getElementById('partner-contact-success').style.display, 'block');
  } finally { dom.window.close(); }
});

test('honeypot does not send an enquiry', async () => {
  let requests = 0;
  const dom = await setup(async () => { requests++; return { ok: true }; });
  try {
    const form = dom.window.document.getElementById('partner-contact-form');
    fill(form);
    form.elements.namedItem('bot-field').value = 'spam';
    await submit(dom);
    assert.equal(requests, 0);
  } finally { dom.window.close(); }
});
