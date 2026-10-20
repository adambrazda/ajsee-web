# AJSEE: pilot samostatných stránek akcí

Stav k 20. říjnu 2026: konkrétní návrh čtyř stránek, nikoli již publikované
detaily. Výběr kombinuje muzikál, koncert, festival a sport. Všechny čtyři akce
jsou v aktuálních veřejných datech AJSEE; termíny byly porovnány i se stránkami
prodejců. Samotné tlačítko pro nákup nedokládá volná konkrétní sedadla.

| Akce | Vybraný termín, místní čas | Místo | Záznam feedu |
| --- | --- | --- | --- |
| Jesus Christ Superstar (NDM) | 13. 12. 2026, 16:00 | Divadlo Jiřího Myrona, Ostrava | `colosseumticket-5470841-4205829` |
| KoRn | 16. 11. 2026, 19:30 | O2 arena, Praha | `ticketmaster-Z698xZu0Z16vow_8_9` |
| Folk a country festival na krumlovském zámku | 24. 4. 2027, 14:00 | Zámecká jízdárna, Český Krumlov | `smsticket-68785` |
| TOHLE JE BOX – Galavečer profesionálního boxu | 21. 11. 2026, 18:00 | Sono Centrum, Brno | `smsticket-76162` |

## Podklady a ověření

- [Jesus Christ Superstar u ColosseumTicket](https://colosseumticket.cz/cs/akce/5470841-jesus-christ-superstar)
  uvádí prosincový termín i místo. Feed nese celé ID konkrétní reprízy;
  partnerský odkaz míří na výběr termínu daného titulu.
- [KoRn u Ticketmaster](https://www.ticketmaster.cz/event/korn-vstupenky/1472650657)
  potvrzuje 16. listopadu v 19:30 a O2 arenu. Nákup zachová stávající serverový
  přechod `tmOutbound` a Impact.
- [Folk a country festival u smsticket](https://www.smsticket.cz/vstupenky/68785-folk-a-country-festival-na-krumlovskem-zamku-zamecka-jizdarna-cesky-krumlov-nezmari-hop-trop-spiritual-kvartet)
  uvádí 24. dubna 2027 ve 14:00 a Zámeckou jízdárnu.
- [TOHLE JE BOX u smsticket](https://www.smsticket.cz/vstupenky/76162-tohle-je-box-galavecer-profesionalniho-boxu-sono-centrum-brno)
  potvrzuje 21. listopadu 2026 v 18:00 a Sono Centrum.

Podklad SMS Ticket byl načten z produkčního snapshotu s časem synchronizace
`2026-10-20T13:09:32.500Z` (3 170 záznamů). ColosseumTicket má v kontrolovaném
produkčním snapshotu 2 276 záznamů. Počty označují obsah konkrétních snapshotů,
nikoli úplnou nabídku všech partnerů.

## Podoba a text

Zachovat současné písmo, barvy, hlavičku, patičku a light/dark režim AJSEE.
Každý detail začne názvem akce, krátkým původním úvodem, datem a místem.
Vedle hlavního obrázku bude na desktopu kompaktní blok vstupenek; na mobilu
se přesune pod hlavní informace. Cena se zobrazí jen z platného podkladu,
jinak „Cenu ověříte u prodejce“. CTA pojmenuje partnera, například
„Vstupenky u ColosseumTicket“. U odkazu bude srozumitelně uvedeno, že výběr
míst a nákup dokončí návštěvník u partnera.

Návrhy krátkých úvodů:

- **Jesus Christ Superstar:** Rocková opera Tima Rice a Andrewa Lloyda
  Webbera se vrací na scénu Divadla Jiřího Myrona. Prosincovou reprízu
  v Ostravě si můžete naplánovat na neděli 13. prosince od 16:00.
- **KoRn:** KoRn míří do pražské O2 areny. Koncert začne v pondělí
  16. listopadu v 19:30.
- **Folk a country festival:** Za folkem a country do Českého Krumlova.
  V sobotu 24. dubna 2027 se v Zámecké jízdárně představí mimo jiné Nezmaři,
  Hop Trop a Spirituál kvartet.
- **TOHLE JE BOX:** Profesionální box v brněnském SONO. Galavečer TOHLE JE BOX
  začne v sobotu 21. listopadu v 18:00.

Další obsah tvoří stručné představení programu, ověřená adresa, dostupné
praktické informace a související články AJSEE. Neopisovat celý partnerský
popis ani nedoplňovat neověřené obsazení, délku nebo dopravní informace.

## Technický rozsah

1. Každý vybraný termín dostane stálou URL, která přežije aktualizaci feedu.
   Návrh: `/udalosti/korn-praha-2026-11-16/`; nejde zatím o existující URL.
2. Název, datum, místo a hlavní text budou čitelné v prvním HTML i bez
   JavaScriptu. Karty a modal mohou odkazovat na tentýž detail.
3. Strukturovaná data `Event` popíší konkrétní termín a skutečné místo,
   s časovou zónou `Europe/Prague`. Cena a dostupnost nabídky se uvedou jen,
   pokud jsou aktuálně doložené. Partner není automaticky pořadatel.
4. Jeden zdroj pravdy propojí feed, viditelný obsah a JSON-LD. Chybějící
   událost v novém neúplném feedu sama neznamená zrušenou nebo vyprodanou akci.
5. Přesunutí či zrušení aktualizuje stránku a stav události. Po skončení
   detail zůstane s jasným označením a užitečným dalším obsahem; nepřesměrovat
   automaticky každý starý termín na nesouvisející nabídku.
6. Zachovat přesné partnerské URL a affiliate parametry. Proklik použije
   společné měření `ajsee_partner_click`, nové umístění `event_detail` a celé
   `partner_event_id`. Bez souhlasu se analytika nespustí.
7. Před zveřejněním ověřit vlastní canonical, odkazy, obrázky, stavové kódy,
   JSON-LD, mobil a oba barevné režimy. Do sitemap patří až zveřejněné detaily;
   jazykové alternativy až po skutečném překladu.

Oporou pro schéma jsou [pokyny Google pro události](https://developers.google.com/search/docs/appearance/structured-data/event)
a [typ Event na Schema.org](https://schema.org/Event). Nasazení validního
schématu nezaručuje indexaci ani konkrétní podobu výsledku v Googlu či AI.

## Vyhodnocení pilotu

Po zveřejnění porovnat indexaci, relevantní dotazy a zobrazení v Search
Console a počet uživatelů přecházejících k partnerům v GA4. Výsledky posuzovat
pro jednotlivé stránky a před konáním akce; chybějící zobrazení po několika
dnech není důvod automaticky vyrábět stovky dalších detailů.
