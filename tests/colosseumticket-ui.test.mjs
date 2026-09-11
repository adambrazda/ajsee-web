import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';


function read(relativePath) {
  return fs.readFileSync(
    new URL(
      '../' + relativePath,
      import.meta.url
    ),
    'utf8'
  );
}


const eventCard =
  read('src/event-card.js');

const eventModal =
  read('src/event-modal.js');

const main =
  read('src/main.js');

const homeEntry =
  read('src/home-entry.js');

const eventsEntry =
  read('src/events-entry.js');


test(
  'shared event card recognizes and labels ColosseumTicket',
  () => {
    assert.equal(
      eventCard.includes(
        "if (raw.includes('colosseum')) return 'colosseumticket';"
      ),
      true
    );

    assert.equal(
      eventCard.includes(
        "if (provider === 'colosseumticket') return 'ColosseumTicket';"
      ),
      true
    );
  }
);


test(
  'main and events render paths recognize ColosseumTicket',
  () => {
    assert.equal(
      main.includes(
        'colosseumticket'
      ),
      true
    );

    assert.equal(
      main.includes(
        'ColosseumTicket'
      ),
      true
    );

    assert.equal(
      eventsEntry.includes(
        'colosseumticket'
      ),
      true
    );

    assert.equal(
      eventsEntry.includes(
        'ColosseumTicket'
      ),
      true
    );
  }
);


test(
  'homepage compatibility fallback never overwrites another primary provider',
  () => {
    assert.equal(
      homeEntry.includes(
        'AJSEE_HOME_ENTRY_COLOSSEUM_BADGE_DIRECT_v1'
      ),
      true
    );

    assert.match(
      homeEntry,
      /currentProvider\s*&&\s*currentProvider\s*!==\s*'colosseumticket'/
    );

    assert.equal(
      homeEntry.includes(
        'ColosseumTicket'
      ),
      true
    );
  }
);


test(
  'mixed-provider modal identifies sellers explicitly',
  () => {
    assert.equal(
      eventModal.includes(
        "colosseumticket: 'ColosseumTicket'"
      ),
      true
    );

    assert.equal(
      eventModal.includes(
        'MODAL_TICKET_SELLERS_LABELS'
      ),
      true
    );

    assert.equal(
      eventModal.includes(
        'providerNames.length > 1'
      ),
      true
    );

    assert.equal(
      eventModal.includes(
        "optionSellerNames.join(' · ')"
      ),
      true
    );
  }
);


test(
  'ColosseumTicket uses AJSEE-owned fallback media',
  () => {
    assert.equal(
      eventCard.includes(
        "const COLOSSEUMTICKET_FALLBACK_IMAGE = '/images/logo-ajsee.png';"
      ),
      true
    );

    assert.equal(
      eventCard.includes(
        "eventProviderKey(event) === 'colosseumticket'"
      ),
      true
    );

    assert.equal(
      eventCard.includes(
        "this.src='${safeFallbackImage}';"
      ),
      true
    );

    assert.equal(
      eventModal.includes(
        "modalProviderName(eventData) === 'ColosseumTicket'"
      ),
      true
    );

    assert.equal(
      eventModal.includes(
        "? '/images/logo-ajsee.png'"
      ),
      true
    );

    assert.equal(
      eventModal.includes(
        'imageEl.src = imageFallback;'
      ),
      true
    );
  }
);


test(
  'modal fallback keeps AJSEE artwork contained',
  () => {
    assert.match(
      eventModal,
      /\.modal-image\.modal-image--fallback\s*\{[\s\S]*?object-fit:\s*contain;/
    );

    assert.match(
      eventModal,
      /imageEl\.classList\.toggle\([\s\S]*?'modal-image--fallback'[\s\S]*?image === imageFallback/
    );

    assert.match(
      eventModal,
      /imageEl\.classList\.add\([\s\S]*?'modal-image--fallback'/
    );
  }
);
