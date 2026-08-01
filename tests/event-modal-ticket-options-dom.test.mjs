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
