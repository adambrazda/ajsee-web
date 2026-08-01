export const EVENT_TAXONOMY_VERSION = 1;

function text(value) {
  if (value == null) return '';

  return String(value).trim();
}

function rawValues(value) {
  const input =
    Array.isArray(value)
      ? value
      : value == null
        ? []
        : [value];

  const output = [];
  const seen = new Set();

  for (const item of input) {
    const current = text(item);

    if (
      !current ||
      seen.has(current)
    ) {
      continue;
    }

    seen.add(current);
    output.push(current);
  }

  return output;
}

function fold(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return fold(value)
    .replace(/\band\b/g, 'and')
    .replace(/\s+/g, '-');
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ];
}

const EVENT_TYPE_ALIASES =
  new Map([
    ['koncert', 'concert'],
    ['concert', 'concert'],

    ['festival', 'festival'],

    ['show vystoupeni', 'show'],
    ['show performance', 'show'],
    ['show', 'show'],
    ['performance', 'show'],

    ['divadlo', 'theatre'],
    ['theatre', 'theatre'],
    ['theater', 'theatre'],
    ['play', 'theatre'],
    ['plays', 'theatre'],

    ['kino projekce', 'cinema'],
    ['cinema projection', 'cinema'],
    ['cinema', 'cinema'],
    ['film', 'cinema'],

    ['tanecni party', 'party'],
    ['dance party', 'party'],
    ['party', 'party'],

    ['prednaska', 'talk'],
    ['lecture', 'talk'],
    ['talk', 'talk'],

    ['setkani meeting', 'meeting'],
    ['meeting', 'meeting'],

    ['muzeum hrad prohlidka', 'tour'],
    ['museum castle tour', 'tour'],
    ['tour', 'tour'],

    ['workshop lekce', 'workshop'],
    ['workshop lesson', 'workshop'],
    ['workshop', 'workshop'],

    ['soutez zapas zavod', 'competition'],
    ['competition match race', 'competition'],
    ['competition', 'competition'],
    ['match', 'competition'],
    ['race', 'competition'],

    ['konference kongres', 'conference'],
    ['conference congress', 'conference'],
    ['conference', 'conference'],

    ['podcast', 'podcast'],

    ['vystava', 'exhibition'],
    ['exhibition', 'exhibition'],

    ['zabavni park', 'amusement'],
    ['amusement park', 'amusement'],

    ['prehlidka', 'parade'],
    ['parade', 'parade'],

    ['ples gala vecer', 'gala'],
    ['ball gala evening', 'gala'],
    ['gala', 'gala'],

    ['retreat pobyt', 'retreat'],
    ['retreat stay', 'retreat'],
    ['retreat', 'retreat'],

    ['online', 'online'],

    ['veletrh', 'fair'],
    ['fair', 'fair']
  ]);

const GENRE_ALIASES =
  new Map([
    ['pop', 'pop'],
    ['rock', 'rock'],

    ['klasika', 'classical'],
    ['classical', 'classical'],

    ['tribute', 'tribute'],

    ['folk country', 'folk-country'],
    ['country', 'country'],

    ['cinohra', 'drama'],
    ['drama', 'drama'],

    ['moderni', 'contemporary'],
    ['contemporary', 'contemporary'],

    ['filmova hudba', 'film-music'],
    ['film music', 'film-music'],

    ['worldmusic', 'world-music'],
    ['world music', 'world-music'],

    ['stinove divadlo', 'shadow-theatre'],
    ['shadow theatre', 'shadow-theatre'],

    ['cerne divadlo', 'black-light-theatre'],
    ['black light theatre', 'black-light-theatre'],

    ['pantomima', 'mime'],
    ['mime', 'mime'],

    ['muzikal', 'musical'],
    ['musical', 'musical'],

    ['jazz', 'jazz'],
    ['metal', 'metal'],
    ['punk', 'punk'],

    ['pisnickari', 'singer-songwriter'],
    ['singer songwriter', 'singer-songwriter'],

    ['elektronika', 'electronic'],
    ['electronic', 'electronic'],

    ['sanson', 'chanson'],
    ['chanson', 'chanson'],

    ['hip hop rap', 'hip-hop'],
    ['hip hop', 'hip-hop'],
    ['rap', 'rap'],

    ['indie alternative', 'indie-alternative'],
    ['alternative', 'alternative'],

    ['spiritualni', 'spiritual'],
    ['spiritual', 'spiritual'],

    ['ambient', 'ambient'],
    ['disco', 'disco'],
    ['blues', 'blues'],
    ['house', 'house'],
    ['techno', 'techno'],

    ['drum and bass', 'drum-and-bass'],
    ['drum bass', 'drum-and-bass'],

    ['funk soul', 'funk-soul'],
    ['reggae', 'reggae'],

    ['komedie', 'comedy'],
    ['comedy', 'comedy'],

    ['pro deti', 'children'],
    ['children', 'children'],

    ['loutkove divadlo', 'puppet-theatre'],
    ['puppet theatre', 'puppet-theatre'],

    ['novy cirkus', 'contemporary-circus'],
    ['contemporary circus', 'contemporary-circus'],
    ['circus', 'circus'],

    ['opera', 'opera'],

    ['balet', 'ballet'],
    ['ballet', 'ballet'],

    ['baseball', 'baseball'],

    ['behani', 'running'],
    ['running', 'running'],

    ['bojovy sport', 'combat-sports'],
    ['combat sport', 'combat-sports'],

    ['moto sport', 'motorsport'],
    ['motorsport', 'motorsport'],

    ['rodinny', 'family'],
    ['family', 'family']
  ]);

const EXPERIENCE_CATEGORY_HINTS =
  new Set([
    'gastro',
    'osobni rozvoj',
    'vzdelavani',
    'zajmy hobby',
    'cestovani outdoor',
    'zdravi zivotni styl',
    'komunita hnuti',
    'politika spolecnost',
    'charita dobrocinnost',
    'byznys profesni',
    'veda technologie',
    'jine'
  ]);

const STAGE_GENRES =
  new Set([
    'drama',
    'musical',
    'comedy',
    'opera',
    'ballet',
    'mime',
    'shadow-theatre',
    'black-light-theatre',
    'puppet-theatre',
    'contemporary-circus',
    'circus'
  ]);

function normalizeEventTypes(values) {
  return unique(
    rawValues(values)
      .map((value) => {
        const normalized =
          fold(value);

        /*
         * Unknown provider values are preserved in source.rawTypes,
         * but are not promoted to the normalized taxonomy.
         */
        return (
          EVENT_TYPE_ALIASES.get(
            normalized
          ) ||
          ''
        );
      })
  );
}

function normalizeGenres(values) {
  return unique(
    rawValues(values)
      .map((value) => {
        const normalized =
          fold(value);

        return (
          GENRE_ALIASES.get(
            normalized
          ) ||
          slug(value)
        );
      })
  );
}

function inferAudiences({
  rawCategory = '',
  rawCategories = [],
  rawGenres = []
} = {}) {
  const hints =
    [
      rawCategory,
      ...rawCategories,
      ...rawGenres
    ].map(fold);

  const isFamily =
    hints.some((value) => {
      return (
        value === 'family' ||
        value.includes('deti') ||
        value.includes('rodin') ||
        value.includes('children') ||
        value.includes('kids')
      );
    });

  return (
    isFamily
      ? ['family']
      : []
  );
}

function inferDomains({
  rawCategory = '',
  rawCategories = [],
  eventTypes = [],
  genres = []
} = {}) {
  const categoryHints =
    [
      rawCategory,
      ...rawCategories
    ].map(fold);

  const domains = [];

  const hasCategoryHint =
    (predicate) =>
      categoryHints.some(
        predicate
      );

  if (
    hasCategoryHint(
      (value) =>
        value === 'music' ||
        value.includes('hudba')
    ) ||
    eventTypes.includes('concert') ||
    eventTypes.includes('party')
  ) {
    domains.push('music');
  }

  if (
    hasCategoryHint(
      (value) =>
        value === 'arts' ||
        value.includes('predstaveni') ||
        value.includes('stand up') ||
        value.includes('talk show') ||
        value === 'tanec' ||
        value.includes('umeni') ||
        value.includes('burlesque') ||
        value.includes('kabaret') ||
        value.includes('arts and theatre') ||
        value.includes('theatre') ||
        value.includes('theater')
    ) ||
    eventTypes.includes('theatre') ||
    eventTypes.includes('show') ||
    genres.some(
      (genre) =>
        STAGE_GENRES.has(genre)
    )
  ) {
    domains.push('stage');
  }

  if (
    hasCategoryHint(
      (value) =>
        value === 'sports' ||
        value === 'sport'
    ) ||
    eventTypes.includes('competition')
  ) {
    domains.push('sport');
  }

  if (
    hasCategoryHint(
      (value) =>
        value === 'film' ||
        value.includes('kino')
    ) ||
    eventTypes.includes('cinema')
  ) {
    domains.push('film');
  }

  if (
    categoryHints.some(
      (value) =>
        EXPERIENCE_CATEGORY_HINTS.has(
          value
        )
    ) ||
    eventTypes.some(
      (type) =>
        [
          'talk',
          'meeting',
          'tour',
          'workshop',
          'conference',
          'podcast',
          'exhibition',
          'amusement',
          'parade',
          'gala',
          'retreat',
          'online',
          'fair'
        ].includes(type)
    )
  ) {
    domains.push('experience');
  }

  return unique(
    domains.length
      ? domains
      : ['other']
  );
}

export function deriveLegacyCategory(
  taxonomy = {}
) {
  const domains =
    Array.isArray(
      taxonomy.domains
    )
      ? taxonomy.domains
      : [];

  const eventTypes =
    Array.isArray(
      taxonomy.eventTypes
    )
      ? taxonomy.eventTypes
      : [];

  const audiences =
    Array.isArray(
      taxonomy.audiences
    )
      ? taxonomy.audiences
      : [];

  /*
   * Preserve current AJSEE filtering behaviour.
   * Festival remains the strongest legacy classification.
   */
  if (
    eventTypes.includes('festival')
  ) {
    return 'festival';
  }

  if (
    eventTypes.includes('concert')
  ) {
    return 'concert';
  }

  if (
    domains.includes('sport')
  ) {
    return 'sport';
  }

  if (
    domains.includes('stage')
  ) {
    return 'theatre';
  }

  if (
    audiences.includes('family')
  ) {
    return 'family';
  }

  return 'other';
}

export function buildSmsticketTaxonomy(
  event = {}
) {
  const rawCategory =
    text(event.category);

  const rawCategories =
    rawValues(
      event.categories
    );

  const rawGenres =
    rawValues(
      event.genres ??
      event.genre
    );

  const rawTypes =
    rawValues(
      event.types ??
      event.type
    );

  const eventTypes =
    normalizeEventTypes(
      rawTypes
    );

  const genres =
    normalizeGenres(
      rawGenres
    );

  const audiences =
    inferAudiences({
      rawCategory,
      rawCategories,
      rawGenres
    });

  const domains =
    inferDomains({
      rawCategory,
      rawCategories,
      eventTypes,
      genres
    });

  return {
    version:
      EVENT_TAXONOMY_VERSION,

    domains,
    eventTypes,
    genres,
    audiences,

    source: {
      provider: 'smsticket',
      rawCategory,
      rawCategories,
      rawGenres,
      rawTypes
    }
  };
}

function ticketmasterClassification(
  event = {}
) {
  return (
    event?.classifications?.[0] ||
    {}
  );
}

function classificationName(value) {
  return text(
    value?.name ??
    value
  );
}

export function buildTicketmasterTaxonomy(
  event = {}
) {
  const classification =
    ticketmasterClassification(
      event
    );

  const rawSegment =
    classificationName(
      classification.segment
    );

  const rawGenre =
    classificationName(
      classification.genre
    );

  const rawSubGenre =
    classificationName(
      classification.subGenre
    );

  const rawType =
    classificationName(
      classification.type
    );

  const rawSubType =
    classificationName(
      classification.subType
    );

  const rawCategories =
    rawValues([
      rawSegment
    ]);

  const rawGenres =
    rawValues([
      rawGenre,
      rawSubGenre
    ]);

  const rawTypes =
    rawValues([
      rawType,
      rawSubType
    ]);

  const allHints =
    rawValues([
      rawSegment,
      rawGenre,
      rawSubGenre,
      rawType,
      rawSubType,
      event.name
    ]);

  let eventTypes =
    normalizeEventTypes(
      rawTypes
    );

  const foldedHints =
    allHints.map(fold);

  if (
    foldedHints.some(
      (value) =>
        value.includes('festival')
    )
  ) {
    eventTypes =
      unique([
        'festival',
        ...eventTypes
      ]);
  }
  else if (
    foldedHints.some(
      (value) =>
        value.includes('concert')
    )
  ) {
    eventTypes =
      unique([
        'concert',
        ...eventTypes
      ]);
  }
  else if (
    fold(rawSegment) === 'music' &&
    !eventTypes.length
  ) {
    eventTypes = ['concert'];
  }

  if (
    foldedHints.some(
      (value) =>
        value.includes('theatre') ||
        value.includes('theater') ||
        value === 'plays' ||
        value === 'play' ||
        value.includes('musical')
    ) &&
    !eventTypes.includes('theatre')
  ) {
    eventTypes.push('theatre');
  }

  if (
    fold(rawSegment) === 'sports' &&
    !eventTypes.includes('competition')
  ) {
    eventTypes.push(
      'competition'
    );
  }

  if (
    foldedHints.some(
      (value) =>
        value.includes('film') ||
        value.includes('cinema')
    ) &&
    !eventTypes.includes('cinema')
  ) {
    eventTypes.push('cinema');
  }

  const genres =
    normalizeGenres(
      rawGenres
    );

  const audiences =
    inferAudiences({
      rawCategory: rawSegment,
      rawCategories: allHints,
      rawGenres
    });

  const domains =
    inferDomains({
      rawCategory: rawSegment,
      rawCategories: allHints,
      eventTypes,
      genres
    });

  return {
    version:
      EVENT_TAXONOMY_VERSION,

    domains,
    eventTypes:
      unique(eventTypes),

    genres,
    audiences,

    source: {
      provider: 'ticketmaster',
      rawCategory: rawSegment,
      rawCategories,
      rawGenres,
      rawTypes
    }
  };
}

export function buildEventTaxonomy(
  event = {},
  provider = ''
) {
  const normalizedProvider =
    fold(
      provider ||
      event.provider ||
      event.source
    );

  if (
    normalizedProvider.includes(
      'smsticket'
    )
  ) {
    return buildSmsticketTaxonomy(
      event
    );
  }

  if (
    normalizedProvider.includes(
      'ticketmaster'
    )
  ) {
    return buildTicketmasterTaxonomy(
      event
    );
  }

  throw new TypeError(
    `Unsupported event taxonomy provider: ${
      provider ||
      event.provider ||
      event.source ||
      '(empty)'
    }`
  );
}

export function withEventTaxonomy(
  event = {},
  provider = ''
) {
  const taxonomy =
    buildEventTaxonomy(
      event,
      provider
    );

  return {
    ...event,

    category:
      deriveLegacyCategory(
        taxonomy
      ),

    taxonomy
  };
}