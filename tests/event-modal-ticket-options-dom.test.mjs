import test, {
  after,
  afterEach,
  beforeEach,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  JSDOM,
} from 'jsdom';

const dom = new JSDOM(
  `<!doctype html>
  <html lang="cs">
    <head>
      <title>AJSEE modal test</title>
    </head>
    <body data-page="events">
      <button id="previous-focus" type="button">
        Previous focus
      </button>
    </body>
  </html>`,
  {
    url:
      'https://ajsee.cz/events?city=Loket&cityCc=CZ',
    pretendToBeVisual: true,
  }
);

const commerceMediaListeners = new Set();
const commerceMedia = {
  matches: false,
  addEventListener(type, listener) {
    if (type === 'change') commerceMediaListeners.add(listener);
  },
};
const tabletMediaListeners = new Set();
const tabletMedia = { matches:false, addEventListener(type, listener) { if(type==='change') tabletMediaListeners.add(listener); } };
dom.window.matchMedia = query => query.includes('min-width: 600px') ? tabletMedia : commerceMedia;

const globalValues = {
  window:
    dom.window,

  document:
    dom.window.document,

  MutationObserver:
    dom.window.MutationObserver,

  HTMLElement:
    dom.window.HTMLElement,

  Element:
    dom.window.Element,

  Node:
    dom.window.Node,

  Event:
    dom.window.Event,

  MouseEvent:
    dom.window.MouseEvent,

  KeyboardEvent:
    dom.window.KeyboardEvent,

  CustomEvent:
    dom.window.CustomEvent,

  sessionStorage:
    dom.window.sessionStorage,

  getComputedStyle:
    dom.window.getComputedStyle.bind(
      dom.window
    ),
};

const previousGlobalDescriptors =
  new Map();

for (
  const [
    name,
    value,
  ] of Object.entries(globalValues)
) {
  previousGlobalDescriptors.set(
    name,
    Object.getOwnPropertyDescriptor(
      globalThis,
      name
    )
  );

  Object.defineProperty(
    globalThis,
    name,
    {
      configurable: true,
      writable: true,
      value,
    }
  );
}

const moduleUrl =
  new URL(
    '../src/event-modal.js',
    import.meta.url
  );

moduleUrl.searchParams.set(
  'dom-test',
  String(Date.now())
);

const {
  openEventModal,
} =
  await import(moduleUrl.href);

function createEvent(
  overrides = {}
) {
  return {
    id:
      'smsticket-1',

    partner:
      'smsticket',

    source:
      'smsticket',

    title: {
      cs:
        'Testovací akce',

      en:
        'Test event',
    },

    description: {
      cs:
        'Testovací popis události.',

      en:
        'Test event description.',
    },

    category:
      'concert',

    priceFrom:
      '390 CZK',

    tickets:
      'https://www.smsticket.cz/vstupenky/1-test',

    url:
      'https://www.smsticket.cz/vstupenky/1-test',

    location: {
      city:
        'Loket',

      country:
        'CZ',
    },

    venue: {
      name:
        'Kulturní dům Dvorana',

      city:
        'Loket',
    },

    ...overrides,
  };
}

function getModal() {
  const modal =
    document.getElementById(
      'eventModal'
    );

  assert.ok(
    modal,
    'Event modal must exist.'
  );

  return modal;
}

function getTicketOptions(
  modal = getModal()
) {
  const container =
    modal.querySelector(
      '#modalTicketOptions'
    );

  assert.ok(
    container,
    'Ticket options container must exist.'
  );

  return container;
}

function getPrimaryTicketLink(
  modal = getModal()
) {
  const link =
    modal.querySelector(
      '#modalTicketsLink'
    );

  assert.ok(
    link,
    'Primary ticket link must exist.'
  );

  return link;
}

function getRenderedOptionLinks(
  modal = getModal()
) {
  return [
    ...modal.querySelectorAll(
      '#modalTicketOptions ' +
      'a.modal-ticket-option'
    ),
  ];
}

function clickWithoutNavigation(
  link
) {
  const preventNavigation =
    (event) => {
      if (
        event.target
          ?.closest?.('a') === link
      ) {
        event.preventDefault();
      }
    };

  document.addEventListener(
    'click',
    preventNavigation,
    true
  );

  try {
    link.dispatchEvent(
      new dom.window.MouseEvent(
        'click',
        {
          bubbles: true,
          cancelable: true,
          view: dom.window,
        }
      )
    );
  } finally {
    document.removeEventListener(
      'click',
      preventNavigation,
      true
    );
  }
}

function resetRuntimeState() {
  window.__ajseeCloseEventModal?.();

  window.dataLayer = [];
  window.__ajsee = {};

  sessionStorage.clear();

  document.body.style.overflow = '';

  const previousFocus =
    document.getElementById(
      'previous-focus'
    );

  previousFocus?.focus();
}

beforeEach(() => {
  resetRuntimeState();
});

afterEach(() => {
  window.__ajseeCloseEventModal?.();
});

after(() => {
  dom.window.close();

  for (
    const [
      name,
      descriptor,
    ] of previousGlobalDescriptors
  ) {
    if (descriptor) {
      Object.defineProperty(
        globalThis,
        name,
        descriptor
      );
    } else {
      delete globalThis[name];
    }
  }
});

test(
  'renders one primary CTA for a normal event',
  async () => {
    await openEventModal(
      createEvent(),
      'cs'
    );

    const modal =
      getModal();

    const container =
      getTicketOptions(modal);

    const primaryLink =
      getPrimaryTicketLink(modal);

    assert.equal(
      modal.classList.contains('open'),
      true
    );

    assert.equal(
      modal.getAttribute('aria-hidden'),
      'false'
    );

    assert.equal(
      container.hidden,
      true
    );

    assert.equal(
      getRenderedOptionLinks(modal).length,
      0
    );

    assert.equal(
      primaryLink.hidden,
      false
    );

    assert.equal(
      primaryLink.textContent.trim(),
      'Vstupenky'
    );

    assert.equal(
      primaryLink.getAttribute(
        'aria-label'
      ),
      'Vstupenky: Testovací akce'
    );

    assert.equal(
      primaryLink.dataset.placement,
      'event_modal'
    );

    assert.equal(
      primaryLink.dataset
        .ajseeModalTrackingBound,
      '1'
    );

    assert.match(
      primaryLink.href,
      /\/vstupenky\/1-test/
    );
  }
);

test(
  'renders two accessible ticket options and hides the primary CTA',
  async () => {
    await openEventModal(
      createEvent({
        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/vstupenky/69323-karel',

            priceFrom:
              '390 CZK',

            currency:
              'CZK',

            provider:
              'smsticket',
          },
          {
            url:
              'https://www.smsticket.cz/vstupenky/69262-karel',

            priceFrom:
              '390 CZK',

            currency:
              'CZK',

            provider:
              'smsticket',
          },
        ],
      }),
      'cs'
    );

    const modal =
      getModal();

    const container =
      getTicketOptions(modal);

    const primaryLink =
      getPrimaryTicketLink(modal);

    const links =
      getRenderedOptionLinks(modal);

    assert.equal(
      container.hidden,
      false
    );

    assert.equal(
      container.getAttribute('role'),
      'group'
    );

    assert.equal(
      container.getAttribute(
        'aria-label'
      ),
      'Vstupenky'
    );

    assert.equal(
      primaryLink.hidden,
      true
    );

    assert.equal(
      links.length,
      2
    );

    assert.deepEqual(
      links.map(
        (link) =>
          link.textContent.trim()
      ),
      [
        'Vstupenky 1 · 390 CZK',
        'Vstupenky 2 · 390 CZK',
      ]
    );

    assert.deepEqual(
      links.map(
        (link) =>
          link.getAttribute(
            'aria-label'
          )
      ),
      [
        'Vstupenky 1 · 390 CZK: Testovací akce',
        'Vstupenky 2 · 390 CZK: Testovací akce',
      ]
    );

    assert.deepEqual(
      links.map(
        (link) =>
          link.dataset
            .ticketOptionIndex
      ),
      [
        '1',
        '2',
      ]
    );

    assert.ok(
      links.every(
        (link) =>
          link.target === '_blank'
      )
    );

    assert.ok(
      links.every(
        (link) =>
          link.rel ===
          'noopener noreferrer'
      )
    );
  }
);

test(
  'removes duplicate ticket URLs before rendering',
  async () => {
    await openEventModal(
      createEvent({
        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/vstupenky/1-test',

            priceFrom:
              '390 CZK',

            currency:
              'CZK',
          },
          {
            url:
              '  https://www.smsticket.cz/vstupenky/1-test  ',

            priceFrom:
              '390 CZK',

            currency:
              'CZK',
          },
          {
            url:
              'https://www.smsticket.cz/vstupenky/2-test',

            priceFrom:
              '25 EUR',

            currency:
              'EUR',
          },
        ],
      }),
      'cs'
    );

    const links =
      getRenderedOptionLinks();

    assert.equal(
      links.length,
      2
    );

    assert.equal(
      new Set(
        links.map(
          (link) => link.href
        )
      ).size,
      2
    );

    assert.deepEqual(
      links.map(
        (link) =>
          link.textContent.trim()
      ),
      [
        'Vstupenky · 390 CZK',
        'Vstupenky · 25 EUR',
      ]
    );
  }
);

test(
  'clears old options when the modal is reopened for a single-ticket event',
  async () => {
    await openEventModal(
      createEvent({
        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/vstupenky/1-test',

            priceFrom:
              '390 CZK',

            currency:
              'CZK',
          },
          {
            url:
              'https://www.smsticket.cz/vstupenky/2-test',

            priceFrom:
              '25 EUR',

            currency:
              'EUR',
          },
        ],
      }),
      'cs'
    );

    assert.equal(
      getRenderedOptionLinks().length,
      2
    );

    await openEventModal(
      createEvent({
        id:
          'smsticket-3',

        title: {
          cs:
            'Jiná testovací akce',
        },

        tickets:
          'https://www.smsticket.cz/vstupenky/3-test',

        url:
          'https://www.smsticket.cz/vstupenky/3-test',
      }),
      'cs'
    );

    const container =
      getTicketOptions();

    const primaryLink =
      getPrimaryTicketLink();

    assert.equal(
      container.hidden,
      true
    );

    assert.equal(
      container.children.length,
      0
    );

    assert.equal(
      primaryLink.hidden,
      false
    );

    assert.match(
      primaryLink.href,
      /\/vstupenky\/3-test/
    );

    assert.equal(
      primaryLink.getAttribute(
        'aria-label'
      ),
      'Vstupenky: Jiná testovací akce'
    );
  }
);

test(
  'tracks one event per click after repeated modal openings',
  async () => {
    const eventData =
      createEvent();

    await openEventModal(
      eventData,
      'cs'
    );

    let primaryLink =
      getPrimaryTicketLink();

    clickWithoutNavigation(
      primaryLink
    );

    assert.equal(
      window.dataLayer.length,
      1
    );

    await openEventModal(
      eventData,
      'cs'
    );

    primaryLink =
      getPrimaryTicketLink();

    clickWithoutNavigation(
      primaryLink
    );

    assert.equal(
      window.dataLayer.length,
      2,
      'Repeated opening must not duplicate click listeners.'
    );

    const payload =
      window.dataLayer.at(-1);

    assert.equal(
      payload.event,
      'partner_click'
    );

    assert.equal(
      payload.partner,
      'smsticket'
    );

    assert.equal(
      payload.placement,
      'event_modal'
    );

    assert.equal(
      payload.ticket_option_index,
      '1'
    );

    assert.equal(
      payload.ticket_price_from,
      '390 CZK'
    );

    assert.equal(
      payload.page_path,
      '/events?city=Loket&cityCc=CZ'
    );

    assert.equal(
      payload.route_city,
      'Loket'
    );

    assert.equal(
      payload.route_country_code,
      'CZ'
    );

    const storedPayload =
      JSON.parse(
        sessionStorage.getItem(
          'ajsee:lastPartnerClick'
        )
      );

    assert.equal(
      storedPayload.event,
      'partner_click'
    );

    assert.equal(
      storedPayload.placement,
      'event_modal'
    );
  }
);

test(
  'tracks the selected multiple-ticket option with its price and currency',
  async () => {
    await openEventModal(
      createEvent({
        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/vstupenky/71109-ido',

            priceFrom:
              '750 CZK',

            currency:
              'CZK',

            provider:
              'smsticket',
          },
          {
            url:
              'https://www.smsticket.cz/vstupenky/71242-ido',

            priceFrom:
              '25 EUR',

            currency:
              'EUR',

            provider:
              'smsticket',
          },
        ],
      }),
      'cs'
    );

    const links =
      getRenderedOptionLinks();

    assert.equal(
      links.length,
      2
    );

    clickWithoutNavigation(
      links[1]
    );

    assert.equal(
      window.dataLayer.length,
      1
    );

    const payload =
      window.dataLayer[0];

    assert.equal(
      payload.event,
      'partner_click'
    );

    assert.equal(
      payload.placement,
      'event_modal'
    );

    assert.equal(
      payload.ticket_option_index,
      '2'
    );

    assert.equal(
      payload.ticket_price_from,
      '25 EUR'
    );

    assert.equal(
      payload.ticket_currency,
      'EUR'
    );

    assert.equal(
      payload.destination_host,
      'www.smsticket.cz'
    );

    assert.match(
      payload.outbound_url,
      /71242-ido/
    );

    assert.equal(
      payload.link_text,
      'Vstupenky · 25 EUR'
    );

    assert.equal(
      window.__ajsee
        .lastPartnerClick,
      payload
    );
  }
);

test(
  'rejects unsafe option URLs and keeps the safe primary CTA',
  async () => {
    await openEventModal(
      createEvent({
        ticketOptions: [
          {
            url:
              'javascript:alert(1)',

            priceFrom:
              '390 CZK',

            currency:
              'CZK',
          },
          {
            url:
              'data:text/html,unsafe',

            priceFrom:
              '25 EUR',

            currency:
              'EUR',
          },
        ],
      }),
      'cs'
    );

    const container =
      getTicketOptions();

    const primaryLink =
      getPrimaryTicketLink();

    assert.equal(
      container.hidden,
      true
    );

    assert.equal(
      getRenderedOptionLinks().length,
      0
    );

    assert.equal(
      primaryLink.hidden,
      false
    );

    assert.match(
      primaryLink.href,
      /\/vstupenky\/1-test/
    );

    assert.equal(
      primaryLink.getAttribute(
        'aria-label'
      ),
      'Vstupenky: Testovací akce'
    );
  }
);

test(
  'tracks ColosseumTicket as the selected seller in a mixed-provider modal',
  async () => {
    window.dataLayer = [];

    await openEventModal(
      createEvent({
        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/vstupenky/69190-test',

            priceFrom:
              '799 Kč',

            currency:
              'CZK',

            provider:
              'smsticket',
          },

          {
            url:
              'https://colosseumticket.cz/cs/akce/test',

            priceFrom:
              '799 Kč',

            currency:
              'CZK',

            provider:
              'colosseumticket',
          },
        ],
      }),
      'cs'
    );

    const links =
      getRenderedOptionLinks();

    assert.equal(
      links.length,
      2
    );

    assert.match(
      links[0].textContent,
      /SMS Ticket/
    );

    assert.match(
      links[1].textContent,
      /ColosseumTicket/
    );

    assert.equal(
      links[0].dataset.partner,
      'smsticket'
    );

    assert.equal(
      links[1].dataset.partner,
      'colosseumticket'
    );

    assert.equal(
      links[1].dataset.ticketOptionIndex,
      '2'
    );

    clickWithoutNavigation(
      links[1]
    );

    const payload =
      window.dataLayer.at(
        -1
      );

    assert.ok(
      payload,
      'partner_click payload must be emitted'
    );

    assert.equal(
      payload.event,
      'partner_click'
    );

    assert.equal(
      payload.partner,
      'colosseumticket'
    );

    assert.equal(
      payload.event_provider,
      'colosseumticket'
    );

    assert.equal(
      payload.ticket_option_index,
      '2'
    );

    assert.equal(
      payload.ticket_price_from,
      '799 Kč'
    );

    assert.equal(
      payload.ticket_currency,
      'CZK'
    );
  }
);


test(
  'modal ticket CTAs preserve AI result position for learning clickout',
  async () => {
    await openEventModal(
      createEvent({
        __ajseeResultPosition:
          7
      }),
      'cs'
    );

    const primaryLink =
      getPrimaryTicketLink();

    assert.equal(
      primaryLink.dataset
        .resultPosition,
      '7'
    );

    await openEventModal(
      createEvent({
        __ajseeResultPosition:
          4,

        ticketOptions: [
          {
            url:
              'https://www.smsticket.cz/vstupenky/701-test',

            priceFrom:
              '500 CZK',

            currency:
              'CZK',

            provider:
              'smsticket'
          },
          {
            url:
              'https://www.smsticket.cz/vstupenky/702-test',

            priceFrom:
              '600 CZK',

            currency:
              'CZK',

            provider:
              'smsticket'
          }
        ]
      }),
      'cs'
    );

    const optionLinks =
      getRenderedOptionLinks();

    assert.equal(
      optionLinks.length,
      2
    );

    assert.ok(
      optionLinks.every(
        link =>
          link.dataset
            .resultPosition ===
          '4'
      )
    );
  }
);

test('modal renders a price range and replaces commerce details on the next event', async () => {
  await openEventModal(createEvent({priceRanges:[{min:490,max:1290,currency:'CZK'}]}),'cs');
  assert.match(getModal().querySelector('#modalCommerce').textContent,/490.*1\s*290/s);
  assert.match(getModal().querySelector('#modalCommerce').textContent,/Orientační cena/);
  await openEventModal(createEvent({priceFrom:null,ticketOptions:[]}), 'en');
  const content=getModal().querySelector('#modalCommerce').textContent;
  assert.match(content,/Price at seller/);
  assert.equal(getModal().querySelector('.event-stock'),null);
  assert.doesNotMatch(content,/490|1\s*290|Orientační/);
  assert.equal(getModal().querySelectorAll('#modalCommerce').length,1);
});

test('open modal moves the same commerce control across the mobile breakpoint without duplication', async () => {
  await openEventModal(createEvent(), 'cs');
  const modal = getModal();
  const commerce = modal.querySelector('#modalCommerce');
  const calendar = modal.querySelector('.modal-calendar-picker');
  const summary = calendar.querySelector('summary');
  summary.click();
  assert.equal(commerce.parentElement.className, 'modal-purchase');
  assert.equal(commerce.parentElement.parentElement.className, 'modal-visual-column');
  assert.equal(commerce.parentElement.parentElement.querySelector('#modalImage').id, 'modalImage');
  const listenerCount = commerceMediaListeners.size;
  try {
    commerceMedia.matches = true;
    for (const listener of commerceMediaListeners) listener();
    assert.equal(commerce.parentElement.className, 'modal-purchase');
    assert.equal(commerce.parentElement.parentElement.className, 'event-modal-content');
    assert.equal(modal.querySelector('.modal-body').firstElementChild.className, 'modal-intro');
    assert.equal(commerce.nextElementSibling.id, 'modalTicketOptions');
    assert.equal(calendar.open, true);
    await openEventModal(createEvent(), 'en');
    assert.equal(commerceMediaListeners.size, listenerCount);
    assert.equal(modal.querySelectorAll('#modalCommerce').length, 1);
  } finally {
    commerceMedia.matches = false;
    for (const listener of commerceMediaListeners) listener();
  }
  assert.equal(commerce.parentElement.className, 'modal-purchase');
  assert.equal(commerce.parentElement.parentElement.className, 'modal-visual-column');
});

test('purchase and disclosure nodes survive desktop, tablet and mobile transitions', async () => {
  await openEventModal(createEvent({ticketInventory:{source:'smsticket',scope:'seller',observedAt:new Date().toISOString(),status:'limited',remaining:37}}), 'cs');
  const modal=getModal(), purchase=modal.querySelector('.modal-purchase'), ticket=getPrimaryTicketLink(), stock=modal.querySelector('.event-stock');
  stock.open=true;
  try {
    tabletMedia.matches=true;
    for(const listener of tabletMediaListeners) listener();
    assert.equal(modal.dataset.layout,'tablet');
    assert.equal(purchase.parentElement.className,'event-modal-content');
    assert(modal.querySelector('.modal-details > .modal-intro'));
    commerceMedia.matches=true;tabletMedia.matches=false;
    for(const listener of commerceMediaListeners) listener();
    assert.equal(modal.dataset.layout,'mobile');
    assert(modal.querySelector('.modal-body > .modal-intro'));
    assert.equal(purchase.querySelector('#modalTicketsLink'),ticket);
    assert.equal(stock.open,true);
  } finally {
    commerceMedia.matches=false;tabletMedia.matches=false;
    for(const listener of commerceMediaListeners) listener();
  }
  assert.equal(modal.dataset.layout,'desktop');
  assert.equal(purchase.parentElement.className,'modal-visual-column');
  assert.equal(modal.querySelectorAll('#modalCommerce').length,1);
});

test('modal uses the same ticket label and icon, traps Tab, and dismisses a disclosure before closing', async () => {
  await openEventModal(createEvent(), 'cs');
  const modal=getModal(), close=modal.querySelector('#modalClose'), ticket=getPrimaryTicketLink(), calendar=modal.querySelector('.modal-calendar-picker');
  assert.equal(ticket.textContent,'Vstupenky');
  assert(ticket.querySelector('svg.event-ticket-arrow'));
  assert.equal(calendar.open,false);
  close.focus();
  close.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  assert.equal(document.activeElement,calendar.querySelector('summary'));
  document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(document.activeElement,close);
  calendar.open=true;
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(calendar.open,false);
  assert(modal.classList.contains('open'));
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert(!modal.classList.contains('open'));
});

test('seller sell-out cannot navigate or record a purchase, and a subsequent event re-enables the CTA', async () => {
  await openEventModal(createEvent({ticketInventory:{source:'smsticket',scope:'seller',observedAt:new Date().toISOString(),status:'sold_out',remaining:0}}),'cs');
  const ticket=getPrimaryTicketLink();
  assert.equal(ticket.getAttribute('aria-disabled'),'true');
  assert.equal(ticket.hasAttribute('href'),false);
  const before=window.dataLayer?.length || 0;
  clickWithoutNavigation(ticket);
  assert.equal(window.dataLayer?.length || 0,before);
  await openEventModal(createEvent(),'en');
  assert.equal(ticket.getAttribute('aria-disabled'),null);
  assert.equal(ticket.textContent,'Tickets');
  assert.match(ticket.href,/smsticket/);
});
