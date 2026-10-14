const localized = (cs, en, de, sk, pl, hu) => ({ cs, en, de, sk, pl, hu });

// This is a curated set. Add each photograph together with its credit and
// localized description; the hero never downloads the whole collection.
export const HOME_HERO_PHOTOS = [
  {
    id: 'jesus-christ-superstar', category: 'theatre', author: 'Oya Canli',
    caption: 'Jesus Christ Superstar · London Palladium',
    source: '/reviews/jesus-christ-superstar-london-2026/',
    alt: localized('Děkovačka muzikálu Jesus Christ Superstar v London Palladium', 'The Jesus Christ Superstar company taking a curtain call at the London Palladium', 'Schlussapplaus für Jesus Christ Superstar im London Palladium', 'Ďakovačka muzikálu Jesus Christ Superstar v London Palladium', 'Ukłony zespołu Jesus Christ Superstar w London Palladium', 'A Jesus Christ Superstar társulatának meghajlása a London Palladiumban')
  },
  {
    id: 'concert-gold', category: 'concert', author: 'Nainoa Shizuru', provider: 'Unsplash',
    caption: localized('Atmosféra živého koncertu', 'Live concert atmosphere', 'Live-Konzertatmosphäre', 'Atmosféra živého koncertu', 'Atmosfera koncertu na żywo', 'Élő koncert hangulata'),
    source: 'https://unsplash.com/photos/concert-photos-NcdG9mK3PBY',
    alt: localized('Publikum se zvednutýma rukama před pódiem ve zlatém světle', 'An audience raising their hands in front of a stage lit in gold', 'Publikum mit erhobenen Händen vor einer golden beleuchteten Bühne', 'Publikum so zdvihnutými rukami pred pódiom v zlatom svetle', 'Publiczność z uniesionymi rękami przed sceną oświetloną złotym światłem', 'Felemelt kezű közönség az aranyfényben úszó színpad előtt')
  },
  {
    id: 'festival-field-day', category: 'festival', author: 'Danny Howe', provider: 'Unsplash',
    caption: 'Field Day · Sydney',
    source: 'https://unsplash.com/photos/people-gathering-on-concert-field-bn-D2bCvpik',
    alt: localized('Festivalové publikum před pódiem na Field Day v Sydney', 'Festival audience in front of the stage at Field Day in Sydney', 'Festivalpublikum vor der Bühne beim Field Day in Sydney', 'Festivalové publikum pred pódiom na Field Day v Sydney', 'Festiwalowa publiczność przed sceną na Field Day w Sydney', 'Fesztiválközönség a színpad előtt a sydney-i Field Day fesztiválon')
  },
  {
    id: 'chicago', category: 'theatre', author: 'Paul Coltas',
    caption: localized('Chicago · britské turné', 'Chicago · UK tour', 'Chicago · UK-Tour', 'Chicago · britské turné', 'Chicago · brytyjska trasa', 'Chicago · brit turné'),
    source: '/reviews/chicago-the-musical-uk-tour-2027/',
    alt: localized('Soubor muzikálu Chicago při společném tanečním čísle', 'The Chicago company performing a dance number together', 'Das Chicago-Ensemble bei einer gemeinsamen Tanznummer', 'Súbor muzikálu Chicago pri spoločnom tanečnom čísle', 'Zespół musicalu Chicago podczas wspólnego numeru tanecznego', 'A Chicago társulata egy közös táncszámban')
  },
  {
    id: 'sport-football', category: 'sport', author: 'Vienna Reyes', provider: 'Unsplash',
    caption: 'Santiago Bernabéu · Madrid',
    source: 'https://unsplash.com/photos/soccer-field-qCrKTET_09o',
    alt: localized('Fotbalové hřiště a zaplněné tribuny stadionu Santiago Bernabéu v Madridu', 'The football pitch and full stands at the Santiago Bernabéu in Madrid', 'Fußballplatz und volle Tribünen im Santiago Bernabéu in Madrid', 'Futbalové ihrisko a zaplnené tribúny štadióna Santiago Bernabéu v Madride', 'Boisko piłkarskie i pełne trybuny stadionu Santiago Bernabéu w Madrycie', 'A madridi Santiago Bernabéu futballpályája és megtelt lelátói')
  },
  {
    id: 'concert-tilburg', category: 'concert', author: 'CHRSNDRSN', provider: 'Unsplash',
    caption: 'Chase & Status · Tilburg',
    source: 'https://unsplash.com/photos/vibrant-stage-lights-illuminate-a-large-energetic-concert-crowd-XdgjISWC2Bg',
    alt: localized('Publikum pod barevnými světly na koncertu Chase & Status v Tilburgu', 'An audience under colourful lights at a Chase & Status concert in Tilburg', 'Publikum unter farbigen Lichtern beim Chase-&-Status-Konzert in Tilburg', 'Publikum pod farebnými svetlami na koncerte Chase & Status v Tilburgu', 'Publiczność pod kolorowymi światłami na koncercie Chase & Status w Tilburgu', 'Közönség színes fények alatt a Chase & Status koncertjén Tilburgban')
  },
  {
    id: 'mamma-mia', category: 'theatre', author: 'TodayTix',
    caption: 'MAMMA MIA! · West End',
    source: '/reviews/mamma-mia-from-abba-to-the-west-end/',
    alt: localized('Taneční scéna z muzikálu MAMMA MIA! v londýnském West Endu', 'A dance scene from MAMMA MIA! in London’s West End', 'Eine Tanzszene aus MAMMA MIA! im Londoner West End', 'Tanečná scéna z muzikálu MAMMA MIA! v londýnskom West Ende', 'Scena taneczna z MAMMA MIA! na londyńskim West Endzie', 'Táncjelenet a MAMMA MIA! musicalből a londoni West Enden')
  },
  {
    id: 'festival-melt', category: 'festival', author: 'Yvette de Wit', provider: 'Unsplash',
    caption: 'Melt Festival · Gräfenhainichen',
    source: 'https://unsplash.com/photos/stage-light-front-of-audience-NYrVisodQ2M',
    alt: localized('Publikum na Melt Festivalu v záři světel a kouře nad pódiem', 'The Melt Festival audience with stage lights shining through smoke', 'Publikum beim Melt Festival mit Bühnenlichtern im Rauch', 'Publikum na Melt Festivale v žiare svetiel a dymu nad pódiom', 'Publiczność na Melt Festival w blasku świateł i dymu nad sceną', 'A Melt Festival közönsége a füstön átszűrődő színpadi fényekben')
  },
  {
    id: 'sport-basketball', category: 'sport', author: 'JC Gellidon', provider: 'Unsplash',
    caption: localized('Basketbalová aréna · Manila', 'Basketball arena · Manila', 'Basketballarena · Manila', 'Basketbalová aréna · Manila', 'Arena koszykarska · Manila', 'Kosárlabda-aréna · Manila'),
    source: 'https://unsplash.com/photos/people-inside-the-basketball-court-XmYSlYrupL8',
    alt: localized('Basketbalové hřiště uprostřed zaplněné a nasvícené arény', 'A basketball court in the middle of a packed, illuminated arena', 'Ein Basketballfeld inmitten einer vollen, beleuchteten Arena', 'Basketbalové ihrisko uprostred zaplnenej a nasvietenej arény', 'Boisko do koszykówki pośrodku pełnej, oświetlonej areny', 'Kosárlabdapálya egy megtelt, kivilágított aréna közepén')
  },
  {
    id: 'concert-stuttgart', category: 'concert', author: 'Marcel Strauß', provider: 'Unsplash',
    caption: localized('Koncert · Stuttgart', 'Concert · Stuttgart', 'Konzert · Stuttgart', 'Koncert · Stuttgart', 'Koncert · Stuttgart', 'Koncert · Stuttgart'),
    source: 'https://unsplash.com/photos/crowd-enjoying-a-concert-with-blue-stage-lights-ubwn8GI9-2o',
    alt: localized('Publikum na koncertě ve Stuttgartu pod modrými světelnými paprsky', 'A concert audience in Stuttgart beneath blue beams of light', 'Konzertpublikum in Stuttgart unter blauen Lichtstrahlen', 'Publikum na koncerte v Stuttgarte pod modrými svetelnými lúčmi', 'Publiczność koncertowa w Stuttgarcie pod niebieskimi promieniami światła', 'Koncertközönség Stuttgartban kék fénysugarak alatt')
  }
];

export function selectHomeHeroPhoto(photos, previousId, random = Math.random) {
  if (!photos?.length) return null;
  const others = photos.filter(photo => photo.id !== previousId);
  const candidates = others.length ? others : photos;
  const value = Number(random());
  const index = Number.isFinite(value) ? Math.max(0, Math.min(candidates.length - 1, Math.floor(value * candidates.length))) : 0;
  return candidates[index];
}

export function homeHeroPhotoText(photo, language) {
  const lang = String(language || 'cs').toLowerCase().split(/[-_]/)[0];
  const caption = typeof photo.caption === 'string' ? photo.caption : photo.caption[lang] || photo.caption.en;
  const alt = photo.alt[lang] || photo.alt.en;
  const prefix = { cs: 'Foto:', en: 'Photo:', de: 'Foto:', sk: 'Foto:', pl: 'Foto:', hu: 'Fotó:' }[lang] || 'Photo:';
  return { caption, alt, credit: `${prefix} ${photo.author}${photo.provider ? ' / ' + photo.provider : ''}` };
}
