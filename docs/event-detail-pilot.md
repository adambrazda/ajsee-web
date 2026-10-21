# AJSEE: čtyři samostatné detaily akcí

Pilot má 24 stránek: čtyři konkrétní termíny v češtině, slovenštině,
angličtině, němčině, polštině a maďarštině. Kanonická adresa má tvar
`/udalosti/<slug>/`, překlady přidávají jazykový prefix. ID termínu ani
adresa se při přesunu akce nemění. Seznam pilotu není žebříček prodejnosti.

| Akce | ID konkrétního termínu | Slug |
| --- | --- | --- |
| Jesus Christ Superstar (NDM), Ostrava | `colosseumticket-5470841-4205829` | `jesus-christ-superstar-ostrava-2026-12-13` |
| KoRn, Praha | `ticketmaster-Z698xZu0Z16vow_8_9` | `korn-praha-2026-11-16` |
| Folk a country festival, Český Krumlov | `smsticket-68785` | `folk-country-cesky-krumlov-2027-04-24` |
| TOHLE JE BOX, Brno | `smsticket-76162` | `tohle-je-box-brno-2026-11-21` |

## Obsah a navigace

`content/event-detail-pilot.json` určuje identitu, původní redakční obsah,
obrázky, ověřené nákupní odkazy a původní termín. `content/event-detail-copy.json`
obsahuje skutečné překlady všech textů, stavů, popisků, alternativních textů
obrázků a souvisejících článků. V názvech účinkujících a míst se zachovávají
vlastní jména. Překlad stránky netvrdí, že představení probíhá v tomto jazyce.

Každý detail obsahuje název, úvod, fotografii/plakát, datum, místo, cenu pouze
při čerstvém podkladu, tlačítko partnera, praktické informace a související
čtení. Na mobilu jsou vstupenky pod obrázkem před delším textem. Stránky
používají společnou navigaci, patičku, oba barevné režimy a ovládání souhlasů.
Přepínač jazyků vede vždy na stejný konkrétní termín.

Odkazy na detaily jsou v prvním HTML homepage i Událostí ve všech šesti
jazycích. Titulek a obrázek karty otevřou detail jen při přesné shodě jednoho
ze čtyř ID; další repríza stejného titulu dál otevírá původní modal. Tlačítko
Vstupenky na kartě nadále vede přímo k partnerovi.

## Aktuální data a chování při výpadku

`shared/event-details/sources.js` používá existující normalizaci veřejných
feedů smsticket a ColosseumTicket. Ticketmaster ověřuje konkrétní ID přes
Discovery API; bez klíče při lokálním sestavení používá existující proxy a
přesnou shodu výsledného ID. Nikdy nevybere podobně pojmenovanou jinou akci.

- Sestavení vytvoří výchozí snapshot z právě synchronizovaných feedů.
- `event-detail-refresh` jej v produkci obnovuje v 00:15, 06:15, 12:15
  a 18:15 UTC; jde o čtyři spuštění denně, nikoli o pevné pražské hodiny.
- Jednotliví partneři se obnovují nezávisle. Neúplný, poškozený, příliš malý
  nebo zastaralý feed se nepovažuje za nové ověření.
- Snapshot je v Netlify Blobs `event-details-v1`, klíč `current`. Náhled
  neprovádí pravidelné zápisy; plánované funkce běží až v produkci.
- Návštěva stránky nepoptává katalog partnera. Server přečte snapshot a
  vygeneruje úplné HTML; při výpadku Blobs použije snapshot ze sestavení.
- Cena platí nejvýše 24 hodin od skutečného ověření. Tato lhůta se kontroluje
  při každém vykreslení, i když pravidelná obnova selhává. Poté se cena a
  cenová nabídka v JSON-LD odstraní; zůstane odkaz na nabídku prodejce.
- Nula ani chybějící cena nejsou důkazem vstupu zdarma. Nezobrazují se jako
  nulová cena. Změna ceny se nikdy nepřenáší z jiného termínu stejného titulu.
- Vynechání ID z feedu zachová stránku a poslední doložený termín; neznamená
  zrušení, vyprodání ani odložení. Původní cena po 24 hodinách propadne.
- Pouze výslovný stav poskytovatele změní akci na zrušenou či odloženou.
  Ticketmaster `offsale` se nevydává za vyprodání. Po změně data zůstává
  původní datum v `previousStartDate` a viditelném upozornění na přesun.
- Při nejednoznačném lokálním čase během změny letního času se datum bez
  výslovného UTC offsetu nepřepíše. Časy patří zóně Europe/Prague.
- Po uplynutí kalendářního dne v Praze zůstává užitečná stránka s označením
  minulého termínu; nákupní CTA se nezobrazuje. Konec představení se neodhaduje.

Při přípravě 21. října 2026 feed potvrzoval termín a cenu Jesus Christ
Superstar. U boxu uváděl 0 Kč, což se správně změnilo na neznámou cenu.
Krumlovský festival ve feedu chyběl, ačkoliv jeho prodejní stránka byla
20. října ověřena jako aktivní. Chybějící feed tak nezrušil jeho detail.

## Renderování, SEO a měření

`build-event-details.mjs` vytváří 24 statických stránek a sedm souborů v
`dist/event-detail-assets/`: šest lokalizovaných HTML šablon a výchozí data.
`event-detail-page` má vlastní cesty pro detaily a používá stejné vykreslení
jako build. Soubory pro server jsou výslovně zahrnuté do balíčku funkce.

Obsah, metadata, vlastní canonical, sedm jazykových alternativ a JSON-LD
jsou v první odpovědi serveru bez JavaScriptu. `Event` a viditelné údaje
používají stejný termín, místo a čerstvou cenu. `Offer` neobsahuje vymyšlené
`InStock`, konec akce, bezplatné vstupné ani prodejce vydávaného za pořadatele.
Sitemap obsahuje 24 nových stránek, celkem 222 adres; staré odstraněné články
se do ní nevracejí. Neznámé slugs vracejí skutečnou 404.

Původní `/previews/event-details/` dál slouží jako neindexovaný český návrh.
Produkční data a všechny překlady se ověřují na skutečných `/udalosti/`
cestách náhledu nasazení. Náhled designu se nepřidává do sitemap.

Prokliky vyžadují souhlas s analytikou a používají `ajsee_partner_click`,
`placement=event_detail`, přesné `partner_event_id` a jazyk stránky. Samotný
přechod na interní detail se nezapočítává jako proklik k partnerovi.
Ticketmaster zachovává `tmOutbound`/Impact; ColosseumTicket přidává svůj
identifikátor stávajícím serverovým přechodem, smsticket původním `a_box`.
Při vizuálních kontrolách se nákupní odkazy neaktivují.

## Ověření a vyhodnocení

Cílené testy pokrývají obnovu, výpadky, chybějící ID, přesuny a DST, propadnutí
ceny při vykreslení, soulad HTML/schema ve všech šesti jazycích, serverové
GET/HEAD/404/405, zachování partnerských odkazů a selektivní navigaci karet.
Kontroly sestaveného výstupu ověřují všech 24 stránek a sitemapu. Balení
Netlify funkcí ověřuje přítomnost všech serverových podkladů.

Po nasazení porovnávat indexaci a relevantní dotazy v Search Console a
počet uživatelů přecházejících z detailů k partnerům v GA4. Proklik není
potvrzený prodej ani provize; uživatele nelze sčítat z jednotlivých řádků.
Několik dní bez zobrazení není důvod vyrábět stovky dalších stránek.
