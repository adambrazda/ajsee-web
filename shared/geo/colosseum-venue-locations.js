// Sources: ČÚZK / RÚIAN address points and explicitly published venue GPS.
// Reviewed 2026-10-14. Venue/address identity comes from ColosseumTicket;
// corrected or missing addresses additionally cite their operator evidence.
// Unknown and ambiguous locations never use a city-centre fallback.
export const COLOSSEUM_VENUE_LOCATIONS = [
  {
    "venue": "Kulturní středisko Bechyně - Malý sál",
    "city": "Bechyně",
    "street": "U Nádraží 602",
    "lat": 49.3004421,
    "lon": 14.4760811,
    "matchedAddress": "U Nádraží 602, 39165 Bechyně",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=U+N%C3%A1dra%C5%BE%C3%AD+602%2C+Bechyn%C4%9B&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Sál Wagnerovo náměstí",
    "city": "Beroun",
    "street": "Wagnerovo náměstí 1541",
    "lat": 49.9662672,
    "lon": 14.0705202,
    "matchedAddress": "Wagnerovo nám. 1541, Beroun-Město, 26601 Beroun",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Wagnerovo+n%C3%A1m%C4%9Bst%C3%AD+1541%2C+Beroun&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Wagnerovo nám. 1541"
    ]
  },
  {
    "venue": "Besední dům",
    "city": "Brno",
    "street": "Husova 534/20",
    "lat": 49.1960369,
    "lon": 16.6040096,
    "matchedAddress": "Husova 534/20, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Husova+534%2F20%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Besední dům Brno",
    "city": "Brno",
    "street": "Husova 534/20",
    "lat": 49.1960369,
    "lon": 16.6040096,
    "matchedAddress": "Husova 534/20, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Husova+534%2F20%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo Radost",
    "city": "Brno",
    "street": "Bratislavská 216/32",
    "lat": 49.1988051,
    "lon": 16.6178436,
    "matchedAddress": "Bratislavská 216/32, Zábrdovice, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Bratislavsk%C3%A1+216%2F32%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Janáčkovo divadlo",
    "city": "Brno",
    "street": "Rooseveltova 31",
    "lat": 49.1982349,
    "lon": 16.611043,
    "matchedAddress": "Rooseveltova 31/7, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Rooseveltova+31%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Rooseveltova 31/7"
    ]
  },
  {
    "venue": "Koncertní sál Leoše Janáčka",
    "city": "Brno",
    "street": "Lužánecká 1890/14",
    "lat": 49.2045705,
    "lon": 16.6098859,
    "matchedAddress": "Lužánecká 1890/14, Černá Pole, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Lu%C5%BE%C3%A1neck%C3%A1+1890%2F14%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Mahenovo divadlo",
    "city": "Brno",
    "street": "Malinovského nám. 1",
    "lat": 49.1959063,
    "lon": 16.6136906,
    "matchedAddress": "Malinovského náměstí 571/1, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Malinovsk%C3%A9ho+n%C3%A1m.+1%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Malinovského náměstí 571/1"
    ]
  },
  {
    "venue": "Mendelův refektář",
    "city": "Brno",
    "street": "Mendlovo nám. 157/1",
    "lat": 49.1913701,
    "lon": 16.5937816,
    "matchedAddress": "Mendlovo náměstí 157/1, Staré Brno, 60300 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Mendlovo+n%C3%A1m.+157%2F1%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Mendlovo náměstí 157/1"
    ]
  },
  {
    "venue": "Reduta Divad. sál",
    "city": "Brno",
    "street": "",
    "lat": 49.1921197,
    "lon": 16.6094219,
    "matchedAddress": "Zelný trh 313/4, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Zeln%C3%BD+trh+4%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Zelný trh 313/4",
      "Zelný trh 4"
    ],
    "addressSourceUrl": "https://www.ndbrno.cz/o-divadle/budovy/divadlo-reduta/"
  },
  {
    "venue": "Reduta Mozartův sál",
    "city": "Brno",
    "street": "",
    "lat": 49.1921197,
    "lon": 16.6094219,
    "matchedAddress": "Zelný trh 313/4, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Zeln%C3%BD+trh+4%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Zelný trh 313/4",
      "Zelný trh 4"
    ],
    "addressSourceUrl": "https://ndbrno-onlinearchiv.cz/prehled-pusobist-ndb/"
  },
  {
    "venue": "Starez Arena Vodova Brno",
    "city": "Brno",
    "street": "Vodova 336/108",
    "lat": 49.2269715,
    "lon": 16.5839537,
    "matchedAddress": "Vodova 336/108, Královo Pole, 61200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Vodova+336%2F108%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Studio 7",
    "city": "Brno",
    "street": "Beethovenova 4",
    "lat": 49.1964859,
    "lon": 16.6104625,
    "matchedAddress": "Beethovenova 25/4, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Beethovenova+4%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Beethovenova 25/4"
    ]
  },
  {
    "venue": "Sál Milosrdných bratří",
    "city": "Brno",
    "street": "Vídeňská 228/7",
    "lat": 49.1851675,
    "lon": 16.5954748,
    "matchedAddress": "Vídeňská 228/7, Štýřice, 63900 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=V%C3%ADde%C5%88sk%C3%A1+228%2F7%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Červený Kostel",
    "city": "Brno",
    "street": "Komenského náměstí 2",
    "lat": 49.196607,
    "lon": 16.602995,
    "matchedAddress": "Komenského náměstí 220/2, Brno-město, 60200 Brno",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komensk%C3%A9ho+n%C3%A1m%C4%9Bst%C3%AD+2%2C+Brno&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Komenského náměstí 220/2"
    ]
  },
  {
    "venue": "Zámek Brtnice",
    "city": "Brtnice",
    "street": "Zámek 1",
    "lat": 49.3057242,
    "lon": 15.6741216,
    "matchedAddress": "Zámek 1, 58832 Brtnice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Z%C3%A1mek+1%2C+Brtnice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Fibichův sál Chrudim",
    "city": "Chrudim",
    "street": "Široká 85",
    "lat": 49.9531816,
    "lon": 15.7921969,
    "matchedAddress": "Široká 85, Chrudim IV, 53701 Chrudim",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C5%A0irok%C3%A1+85%2C+Chrudim&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Zámek Dobříš - Zrcadlový sál",
    "city": "Dobříš",
    "street": "nám Svobody 1",
    "lat": 49.7813104,
    "lon": 14.1790173,
    "matchedAddress": "náměstí Svobody 1, 26301 Dobříš",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=n%C3%A1m+Svobody+1%2C+Dob%C5%99%C3%AD%C5%A1&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "náměstí Svobody 1"
    ]
  },
  {
    "venue": "Kongresové centrum Aldis",
    "city": "Hradec Králové",
    "street": "Eliščino nábř. 375",
    "lat": 50.2154884,
    "lon": 15.8290209,
    "matchedAddress": "Eliščino nábřeží 375/1, Věkoše, 50003 Hradec Králové",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Eli%C5%A1%C4%8Dino+n%C3%A1b%C5%99.+375%2C+Hradec+Kr%C3%A1lov%C3%A9&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Eliščino nábřeží 375/1"
    ]
  },
  {
    "venue": "Sál Filharmonie Hradec Králové",
    "city": "Hradec Králové",
    "street": "Eliščino nábřeží 777/5",
    "lat": 50.2138261,
    "lon": 15.8291198,
    "matchedAddress": "Eliščino nábřeží 777/5, 50003 Hradec Králové",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Eli%C5%A1%C4%8Dino+n%C3%A1b%C5%99e%C5%BE%C3%AD+777%2F5%2C+Hradec+Kr%C3%A1lov%C3%A9&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "ČPP ARÉNA - Hradec Králové",
    "city": "Hradec Králové",
    "street": "Komenského 1214/2",
    "lat": 50.2066144,
    "lon": 15.8292214,
    "matchedAddress": "Komenského 1214/2, 50003 Hradec Králové",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komensk%C3%A9ho+1214%2F2%2C+Hradec+Kr%C3%A1lov%C3%A9&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo Jaroměř - velký sál",
    "city": "Jaroměř",
    "street": "Náměstí Dukelských hrdinů 240",
    "lat": 50.3527487,
    "lon": 15.9184077,
    "matchedAddress": "nám. Dukelských hrdinů 240, Pražské Předměstí, 55101 Jaroměř",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1m%C4%9Bst%C3%AD+Dukelsk%C3%BDch+hrdin%C5%AF+240%2C+Jarom%C4%9B%C5%99&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "nám. Dukelských hrdinů 240"
    ]
  },
  {
    "venue": "DKO Jihlava",
    "city": "Jihlava",
    "street": "Tolstého 1455",
    "lat": 49.3998125,
    "lon": 15.5872791,
    "matchedAddress": "Tolstého 1455/2, 58601 Jihlava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Tolst%C3%A9ho+1455%2C+Jihlava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Tolstého 1455/2"
    ]
  },
  {
    "venue": "Zámek Červený Hrádek",
    "city": "Jirkov",
    "street": "Červený Hrádek 1",
    "lat": 50.5125196,
    "lon": 13.4443879,
    "matchedAddress": "Červený Hrádek 1, 43111 Jirkov",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C4%8Cerven%C3%BD+Hr%C3%A1dek+1%2C+Jirkov&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Masarykovo divadlo",
    "city": "Jičín",
    "street": "Husova 206",
    "lat": 50.4357182,
    "lon": 15.3580052,
    "matchedAddress": "Husova 206, Valdické Předměstí, 50601 Jičín",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Husova+206%2C+Ji%C4%8D%C3%ADn&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "KZ Orfeum",
    "city": "Kadaň",
    "street": "J. Švermy 824",
    "lat": 50.3773988,
    "lon": 13.2647726,
    "matchedAddress": "Jana Švermy 824, 43201 Kadaň",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=J.+%C5%A0vermy+824%2C+Kada%C5%88&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Jana Švermy 824"
    ]
  },
  {
    "venue": "Divadlo Karlovy Vary",
    "city": "Karlovy Vary",
    "street": "Divadelní náměstí 21",
    "lat": 50.2209439,
    "lon": 12.8816619,
    "matchedAddress": "Divadelní náměstí 21, Karlovy Vary",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://www.karlovarske-divadlo.cz/en",
    "source": "official-venue-gps",
    "precision": "venue"
  },
  {
    "venue": "Sál Atrium - Císařské lázně",
    "city": "Karlovy Vary",
    "street": "Mariánskolázeňská 2",
    "lat": 50.2189032,
    "lon": 12.8815612,
    "matchedAddress": "Mariánskolázeňská 306/2, 36001 Karlovy Vary",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Mari%C3%A1nskol%C3%A1ze%C5%88sk%C3%A1+2%2C+Karlovy+Vary&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Mariánskolázeňská 306/2"
    ]
  },
  {
    "venue": "MSD Kolín, velký sál",
    "city": "Kolín",
    "street": "Zámecká 109",
    "lat": 50.0289722,
    "lon": 15.2006771,
    "matchedAddress": "Zámecká 109, Kolín I, 28002 Kolín",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Z%C3%A1meck%C3%A1+109%2C+Kol%C3%ADn&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Kulturní dům Lorec",
    "city": "Kutná Hora",
    "street": "U Lorce 57",
    "lat": 49.9574519,
    "lon": 15.2715181,
    "matchedAddress": "U Lorce 57, Šipší, 28401 Kutná Hora",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=U+Lorce+57%2C+Kutn%C3%A1+Hora&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "HOME CREDIT ARÉNA - Liberec",
    "city": "Liberec",
    "street": "Jeronýmova 570/22",
    "lat": 50.753955,
    "lon": 15.0481197,
    "matchedAddress": "Jeronýmova 570/22, Liberec VII-Horní Růžodol, 46007 Liberec",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Jeron%C3%BDmova+570%2F22%2C+Liberec&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Lidové sady - velký sál",
    "city": "Liberec",
    "street": "Lidové sady 425/1",
    "lat": 50.7772145,
    "lon": 15.0812544,
    "matchedAddress": "Lidové sady 425/1, Liberec I-Staré Město, 46001 Liberec",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Lidov%C3%A9+sady+425%2F1%2C+Liberec&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Smetanův dům Litomyšl",
    "city": "Litomyšl",
    "street": "Komenského nám. 402",
    "lat": 49.8728966,
    "lon": 16.3075354,
    "matchedAddress": "Komenského nám. 402, Litomyšl-Město, 57001 Litomyšl",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komensk%C3%A9ho+n%C3%A1m.+402%2C+Litomy%C5%A1l&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Městské kulturní středisko Loštice",
    "city": "Loštice",
    "street": "Hradská 380",
    "lat": 49.7440105,
    "lon": 16.9275214,
    "matchedAddress": "Hradská 380/1, 78983 Loštice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Hradsk%C3%A1+380%2C+Lo%C5%A1tice&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Hradská 380/1"
    ]
  },
  {
    "venue": "Kulturní a kongresové centrum Elektra",
    "city": "Luhačovice",
    "street": "Masarykova 950",
    "lat": 49.1010246,
    "lon": 17.7586549,
    "matchedAddress": "Masarykova 950, 76326 Luhačovice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Masarykova+950%2C+Luha%C4%8Dovice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo kouzel Pavla Kožíška",
    "city": "Líbeznice u Prahy",
    "street": "Mírové nám. 44",
    "lat": 50.1932189,
    "lon": 14.4930109,
    "matchedAddress": "Mírové náměstí 44, 25065 Líbeznice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=M%C3%ADrov%C3%A9+n%C3%A1m%C4%9Bst%C3%AD+44%2C+L%C3%ADbeznice&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Mírové náměstí 44"
    ],
    "cityAliases": [
      "Líbeznice"
    ],
    "addressSourceUrl": "https://divadlokouzel.cz/pokladna/"
  },
  {
    "venue": "Společenský dům Casino",
    "city": "Mariánské lázně",
    "street": "Reitenbergerova 95/4",
    "lat": 49.9744101,
    "lon": 12.7068248,
    "matchedAddress": "Reitenbergerova 95/4, 35301 Mariánské Lázně",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Reitenbergerova+95%2F4%2C+Mari%C3%A1nsk%C3%A9+l%C3%A1zn%C4%9B&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Zámecký sál Mikulov",
    "city": "Mikulov",
    "street": "Zámek 1/4",
    "lat": 48.8063851,
    "lon": 16.6360279,
    "matchedAddress": "Zámek 1/4, 69201 Mikulov",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Z%C3%A1mek+1%2F4%2C+Mikulov&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Škoda Muzeum - Laurin & Klement Fórum",
    "city": "Mladá Boleslav",
    "street": "tř. Václava Klementa 294",
    "lat": 50.4182492,
    "lon": 14.9131566,
    "matchedAddress": "tř. Václava Klementa 294, Mladá Boleslav II, 29301 Mladá Boleslav",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=t%C5%99.+V%C3%A1clava+Klementa+294%2C+Mlad%C3%A1+Boleslav&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "KLUB Mnichovo Hradiště",
    "city": "Mnichovo Hradiště",
    "street": "Masarykovo náměstí 299",
    "lat": 50.5227595,
    "lon": 14.9742325,
    "matchedAddress": "Masarykovo náměstí 299, 29501 Mnichovo Hradiště",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Masarykovo+n%C3%A1m%C4%9Bst%C3%AD+299%2C+Mnichovo+Hradi%C5%A1t%C4%9B&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Beskydské divadlo",
    "city": "Nový Jičín",
    "street": "Divadelní 873/5",
    "lat": 49.5926043,
    "lon": 18.0078945,
    "matchedAddress": "Divadelní 873/5, 74101 Nový Jičín",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Divadeln%C3%AD+873%2F5%2C+Nov%C3%BD+Ji%C4%8D%C3%ADn&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Velký sál - hotel Beránek",
    "city": "Náchod",
    "street": "Masarykovo nám. 74",
    "lat": 50.4172215,
    "lon": 16.1621136,
    "matchedAddress": "Masarykovo náměstí 74, 54701 Náchod",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Masarykovo+n%C3%A1m.+74%2C+N%C3%A1chod&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Masarykovo náměstí 74"
    ]
  },
  {
    "venue": "Vlastivědné muzeum v Olomouci",
    "city": "Olomouc",
    "street": "Náměstí Republiky 823/5",
    "lat": 49.5968157,
    "lon": 17.2568533,
    "matchedAddress": "nám. Republiky 823/5, 77900 Olomouc",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1m%C4%9Bst%C3%AD+Republiky+823%2F5%2C+Olomouc&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "nám. Republiky 823/5"
    ]
  },
  {
    "venue": "Brick House Ostrava",
    "city": "Ostrava",
    "street": "Vítkovická 3335/15",
    "lat": 49.8225079,
    "lon": 18.2786068,
    "matchedAddress": "Vítkovická 3335/15, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=V%C3%ADtkovick%C3%A1+3335%2F15%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo \"12\"",
    "city": "Ostrava",
    "street": "Čs. legií 148/12",
    "lat": 49.836578,
    "lon": 18.2886237,
    "matchedAddress": "Čs. legií 1236/12, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C4%8Cs.+legi%C3%AD+1236%2F12%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Čs. legií 1236/12"
    ],
    "addressSourceUrl": "https://www.visitostrava.eu/pl/czas-wolny/kultura/teatry/8602-divadlo-12.html"
  },
  {
    "venue": "Divadlo Antonína Dvořáka",
    "city": "Ostrava",
    "street": "Smetanovo nám. 3104",
    "lat": 49.8325724,
    "lon": 18.2910769,
    "matchedAddress": "Smetanovo náměstí 3104/8a, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Smetanovo+n%C3%A1m.+3104%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Smetanovo náměstí 3104/8a"
    ]
  },
  {
    "venue": "Divadlo Jiřího Myrona",
    "city": "Ostrava",
    "street": "Čs. legií 148",
    "lat": 49.8366137,
    "lon": 18.2879634,
    "matchedAddress": "Čs. legií 148/14, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C4%8Cs.+legi%C3%AD+148%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Čs. legií 148/14"
    ]
  },
  {
    "venue": "Evangelický Kristův kostel",
    "city": "Ostrava",
    "street": "Husovo náměstí 1188/4",
    "lat": 49.8392857,
    "lon": 18.2865754,
    "matchedAddress": "Husovo náměstí 1188/4, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Husovo+n%C3%A1m%C4%9Bst%C3%AD+1188%2F4%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Komorní scéna Aréna",
    "city": "Ostrava",
    "street": "28. října 289/2,",
    "lat": 49.8375923,
    "lon": 18.2953334,
    "matchedAddress": "28. října 289/2, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=28.+%C5%99%C3%ADjna+289%2F2%2C%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "28. října 289/2"
    ]
  },
  {
    "venue": "MUSTANG ARÉNA - Ostrava",
    "city": "Ostrava",
    "street": "Ruská 3077 /135",
    "lat": 49.8049194,
    "lon": 18.2484578,
    "matchedAddress": "Ruská 3077/135, Zábřeh, 70030 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Rusk%C3%A1+3077+%2F135%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Ruská 3077/135"
    ]
  },
  {
    "venue": "Multifunkční aula Gong",
    "city": "Ostrava",
    "street": "Ruská 2993",
    "lat": 49.8189007,
    "lon": 18.2799776,
    "matchedAddress": "Ruská 2993/20, Vítkovice, 70300 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Rusk%C3%A1+2993%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Ruská 2993/20"
    ]
  },
  {
    "venue": "Sál Vesmír",
    "city": "Ostrava",
    "street": "Zahradní 17",
    "lat": 49.8367165,
    "lon": 18.2872939,
    "matchedAddress": "Zahradní 1741/17, Moravská Ostrava, 70200 Ostrava",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Zahradn%C3%AD+17%2C+Ostrava&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Zahradní 1741/17"
    ]
  },
  {
    "venue": "Dům hudby Pardubice - Sukova síň",
    "city": "Pardubice",
    "street": "Sukova tř. 1260",
    "lat": 50.038706,
    "lon": 15.7747924,
    "matchedAddress": "Sukova třída 1260, Zelené Předměstí, 53002 Pardubice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Sukova+t%C5%99.+1260%2C+Pardubice&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Sukova třída 1260"
    ]
  },
  {
    "venue": "ENTERIA ARENA - Pardubice",
    "city": "Pardubice",
    "street": "Sukova tř. 1735",
    "lat": 50.0402703,
    "lon": 15.7694887,
    "matchedAddress": "Sukova třída 1735, Zelené Předměstí, 53002 Pardubice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Sukova+t%C5%99.+1735%2C+Pardubice&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Sukova třída 1735"
    ]
  },
  {
    "venue": "MD Pelhřimov",
    "city": "Pelhřimov",
    "street": "Solní 854",
    "lat": 49.4307311,
    "lon": 15.2215618,
    "matchedAddress": "Solní 854, 39301 Pelhřimov",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Soln%C3%AD+854%2C+Pelh%C5%99imov&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Amfiteátr Lochotín Plzeň",
    "city": "Plzeň",
    "street": "Pod Vinicemi 9",
    "lat": 49.7595656,
    "lon": 13.3612481,
    "matchedAddress": "Pod Vinicemi 928/9, Severní Předměstí, 30100 Plzeň",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Pod+Vinicemi+9%2C+Plze%C5%88&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Pod Vinicemi 928/9"
    ]
  },
  {
    "venue": "Husův Chrám",
    "city": "Plzeň",
    "street": "Němejcova 1722/2",
    "lat": 49.7396139,
    "lon": 13.3665552,
    "matchedAddress": "Němejcova 1722/2, Jižní Předměstí, 30100 Plzeň",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C4%9Bmejcova+1722%2F2%2C+Plze%C5%88&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Konzervatoř Plzeň, Dům Hudby",
    "city": "Plzeň",
    "street": "Husova 30",
    "lat": 49.7457195,
    "lon": 13.368015,
    "matchedAddress": "Husova 305/30, Jižní Předměstí, 30100 Plzeň",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Husova+30%2C+Plze%C5%88&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Husova 305/30"
    ]
  },
  {
    "venue": "Kongres.centrum Lázeň. kolonáda malý sál",
    "city": "Poděbrady",
    "street": "nám. T.G.Masaryka 433",
    "lat": 50.1446963,
    "lon": 15.1198504,
    "matchedAddress": "nám. T.G.Masaryka 433, Poděbrady III, 29001 Poděbrady",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=n%C3%A1m.+T.G.Masaryka+433%2C+Pod%C4%9Bbrady&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Barokní refektář Emauzského kláštera",
    "city": "Praha",
    "street": "Vyšehradská 49",
    "lat": 50.0720454,
    "lon": 14.4178689,
    "matchedAddress": "Vyšehradská 320/49, Nové Město, 12800 Praha 2",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Vy%C5%A1ehradsk%C3%A1+49%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Vyšehradská 320/49"
    ]
  },
  {
    "venue": "Divadlo ABC",
    "city": "Praha",
    "street": "Vodičkova 699/28",
    "lat": 50.0806849,
    "lon": 14.4243325,
    "matchedAddress": "Vodičkova 699/28, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Vodi%C4%8Dkova+699%2F28%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo Bez zábradlí",
    "city": "Praha",
    "street": "Jungmannova ulice č. 36/3",
    "lat": 50.0824786,
    "lon": 14.4221298,
    "matchedAddress": "Jungmannova 36/31, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Jungmannova+36%2F31%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Jungmannova 36/31"
    ],
    "addressSourceUrl": "https://bezzabradli.cz/"
  },
  {
    "venue": "Divadlo Broadway",
    "city": "Praha",
    "street": "Na Příkopě 988/31",
    "lat": 50.0865969,
    "lon": 14.4269815,
    "matchedAddress": "Na příkopě 988/31, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Na+P%C5%99%C3%ADkop%C4%9B+988%2F31%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Na příkopě 988/31"
    ]
  },
  {
    "venue": "Divadlo Dobeška",
    "city": "Praha",
    "street": "Jasná I 1181/6",
    "lat": 50.0406632,
    "lon": 14.4153674,
    "matchedAddress": "Jasná I 1181/6, Braník, 14700 Praha 4",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Jasn%C3%A1+I+1181%2F6%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo Hybernia",
    "city": "Praha",
    "street": "Náměstí Republiky 3/4",
    "lat": 50.0873755,
    "lon": 14.4287627,
    "matchedAddress": "náměstí Republiky 3/4, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1m%C4%9Bst%C3%AD+Republiky+3%2F4%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "náměstí Republiky 3/4"
    ]
  },
  {
    "venue": "Divadlo Lucie Bílé",
    "city": "Praha",
    "street": "Karlova 186/8",
    "lat": 50.0859373,
    "lon": 14.4151282,
    "matchedAddress": "Karlova 186/8, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Karlova+186%2F8%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo Na Jezerce",
    "city": "Praha",
    "street": "",
    "lat": 50.0580846,
    "lon": 14.4446797,
    "matchedAddress": "Na Jezerce 1451/2a, Nusle, 14000 Praha 4",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Na+Jezerce+1451%2F2a%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Na Jezerce 1451/2a"
    ],
    "addressSourceUrl": "https://www.divadlonajezerce.cz/kontakt"
  },
  {
    "venue": "Divadlo Radka Brzobohatého",
    "city": "Praha",
    "street": "Opletalova 5",
    "lat": 50.0813692,
    "lon": 14.4295913,
    "matchedAddress": "Opletalova 919/5, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Opletalova+5%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Opletalova 919/5"
    ]
  },
  {
    "venue": "Divadlo Semafor",
    "city": "Praha",
    "street": "Dejvická 688",
    "lat": 50.099185,
    "lon": 14.3976678,
    "matchedAddress": "Dejvická 688/27, Dejvice, 16000 Praha 6",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Dejvick%C3%A1+688%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Dejvická 688/27"
    ]
  },
  {
    "venue": "Divadlo U Valšů",
    "city": "Praha",
    "street": "Karoliny Světlé 286",
    "lat": 50.0836801,
    "lon": 14.4144349,
    "matchedAddress": "Karoliny Světlé 286/18, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Karoliny+Sv%C4%9Btl%C3%A9+286%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Karoliny Světlé 286/18"
    ]
  },
  {
    "venue": "Divadlo Venuše ve Švehlovce",
    "city": "Praha",
    "street": "Slavíkova 1499",
    "lat": 50.0804487,
    "lon": 14.4469257,
    "matchedAddress": "Slavíkova 1499/22, Žižkov, 13000 Praha 3",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Slav%C3%ADkova+1499%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Slavíkova 1499/22"
    ]
  },
  {
    "venue": "Divadlo v Celetné",
    "city": "Praha",
    "street": "Celetná 595/17",
    "lat": 50.0872244,
    "lon": 14.4247724,
    "matchedAddress": "Celetná 595/17, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Celetn%C3%A1+595%2F17%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Divadlo Říše Loutek",
    "city": "Praha",
    "street": "Žatecká 98/1",
    "lat": 50.0877235,
    "lon": 14.4176778,
    "matchedAddress": "Žatecká 98/1, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C5%BDateck%C3%A1+98%2F1%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Educentrum, Rudolfinum",
    "city": "Praha",
    "street": "Alšovo nábř. 79/12",
    "lat": 50.0901719,
    "lon": 14.4152094,
    "matchedAddress": "Alšovo nábřeží 79/12, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Al%C5%A1ovo+n%C3%A1b%C5%99.+79%2F12%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Alšovo nábřeží 79/12"
    ]
  },
  {
    "venue": "Galerie Vinohradská",
    "city": "Praha",
    "street": "Vinohradská 12",
    "lat": 50.0785898,
    "lon": 14.4345049,
    "matchedAddress": "Vinohradská 1409/12, Vinohrady, 12000 Praha 2",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Vinohradsk%C3%A1+12%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Vinohradská 1409/12"
    ]
  },
  {
    "venue": "Hlavní sál KCZ",
    "city": "Praha",
    "street": "Malenická 1784/2",
    "lat": 50.0249208,
    "lon": 14.4935932,
    "matchedAddress": "Malenická 1784/2, Chodov, 14800 Praha 4",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Malenick%C3%A1+1784%2F2%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Klementinum",
    "city": "Praha",
    "street": "Křižovnické nám. 1040/4",
    "lat": 50.0862876,
    "lon": 14.4146275,
    "matchedAddress": "Křižovnické náměstí 1040/4, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=K%C5%99i%C5%BEovnick%C3%A9+n%C3%A1m.+1040%2F4%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Křižovnické náměstí 1040/4"
    ]
  },
  {
    "venue": "Klementinum - Zrcadlová kaple",
    "city": "Praha",
    "street": "Mariánské náměstí 5",
    "lat": 50.0869662,
    "lon": 14.4171983,
    "matchedAddress": "Mariánské náměstí 190/5, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Mari%C3%A1nsk%C3%A9+n%C3%A1m%C4%9Bst%C3%AD+5%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Mariánské náměstí 190/5"
    ]
  },
  {
    "venue": "Kostel U Salvátora",
    "city": "Praha",
    "street": "Salvátorská 1045",
    "lat": 50.089035,
    "lon": 14.4205343,
    "matchedAddress": "Salvátorská 1045/1, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Salv%C3%A1torsk%C3%A1+1045%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Salvátorská 1045/1"
    ]
  },
  {
    "venue": "Kulturní centrum Zahrada - hlavní sál",
    "city": "Praha",
    "street": "Malenická 1784/2",
    "lat": 50.0249208,
    "lon": 14.4935932,
    "matchedAddress": "Malenická 1784/2, Chodov, 14800 Praha 4",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Malenick%C3%A1+1784%2F2%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "La Fabrika (Slévárna - Studio 2)",
    "city": "Praha",
    "street": "Přístavní 22",
    "lat": 50.1040893,
    "lon": 14.4511437,
    "matchedAddress": "Přístavní 503/22, Holešovice, 17000 Praha 7",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=P%C5%99%C3%ADstavn%C3%AD+22%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Přístavní 503/22"
    ]
  },
  {
    "venue": "La Fabrika (Studio 1)",
    "city": "Praha",
    "street": "Komunardů 30",
    "lat": 50.1037293,
    "lon": 14.450142,
    "matchedAddress": "Komunardů 1001/30, Holešovice, 17000 Praha 7",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komunard%C5%AF+30%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Komunardů 1001/30"
    ]
  },
  {
    "venue": "Lichtenštejnský palác (HAMU)",
    "city": "Praha",
    "street": "Malostranské nám. 13",
    "lat": 50.0881712,
    "lon": 14.402129,
    "matchedAddress": "Malostranské náměstí 258/13, Malá Strana, 11800 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Malostransk%C3%A9+n%C3%A1m.+13%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Malostranské náměstí 258/13"
    ]
  },
  {
    "venue": "Lichtenštejnský palác (HAMU) - Sál Martinů",
    "city": "Praha",
    "street": "Malostranské nám. 258/13",
    "lat": 50.0881712,
    "lon": 14.402129,
    "matchedAddress": "Malostranské náměstí 258/13, Malá Strana, 11800 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Malostransk%C3%A9+n%C3%A1m.+258%2F13%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Malostranské náměstí 258/13"
    ]
  },
  {
    "venue": "Lucerna - Velký sál",
    "city": "Praha",
    "street": "Štěpánská 61",
    "lat": 50.0808906,
    "lon": 14.4264072,
    "matchedAddress": "Štěpánská 704/61, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C5%A0t%C4%9Bp%C3%A1nsk%C3%A1+61%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Štěpánská 704/61"
    ]
  },
  {
    "venue": "Malá scéna HD Karlín",
    "city": "Praha",
    "street": "Křižíkova 10",
    "lat": 50.0902077,
    "lon": 14.4412264,
    "matchedAddress": "Křižíkova 283/10, Karlín, 18600 Praha 8",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=K%C5%99i%C5%BE%C3%ADkova+10%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Křižíkova 283/10"
    ]
  },
  {
    "venue": "Malá scéna Studia Ypsilon",
    "city": "Praha",
    "street": "Spálená 16",
    "lat": 50.0808792,
    "lon": 14.419873,
    "matchedAddress": "Spálená 75/16, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Sp%C3%A1len%C3%A1+16%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Spálená 75/16"
    ]
  },
  {
    "venue": "Muzeum slivovice - Rudolf Jelínek",
    "city": "Praha",
    "street": "U Lužického semináře 116/48, 118 00 Malá Strana",
    "lat": 50.0897368,
    "lon": 14.4101344,
    "matchedAddress": "U lužického semináře 116/48, Malá Strana, 11800 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=U+Lu%C5%BEick%C3%A9ho+semin%C3%A1%C5%99e+116%2F48%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "U lužického semináře 116/48"
    ]
  },
  {
    "venue": "Novogotická kaple ČCE",
    "city": "Praha",
    "street": "Korunní 60",
    "lat": 50.0752406,
    "lon": 14.4468972,
    "matchedAddress": "Korunní 1440/60, Vinohrady, 12000 Praha 2",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Korunn%C3%AD+60%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Korunní 1440/60"
    ]
  },
  {
    "venue": "Novoměstská radnice",
    "city": "Praha",
    "street": "Karlovo náměstí 1/23",
    "lat": 50.0781238,
    "lon": 14.4213016,
    "matchedAddress": "Karlovo náměstí 1/23, Nové Město, 12000 Praha 2",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Karlovo+n%C3%A1m%C4%9Bst%C3%AD+1%2F23%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Národní divadlo",
    "city": "Praha",
    "street": "Národní 2",
    "lat": 50.0812584,
    "lon": 14.413471,
    "matchedAddress": "Národní 223/2, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1rodn%C3%AD+2%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Národní 223/2"
    ]
  },
  {
    "venue": "Palác Akropolis",
    "city": "Praha",
    "street": "Kubelíkova 27",
    "lat": 50.0822582,
    "lon": 14.4489159,
    "matchedAddress": "Kubelíkova 1548/27, Žižkov, 13000 Praha 3",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Kubel%C3%ADkova+27%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Kubelíkova 1548/27"
    ]
  },
  {
    "venue": "Pražská konzervatoř",
    "city": "Praha",
    "street": "Na Rejdišti 1",
    "lat": 50.090495,
    "lon": 14.4157404,
    "matchedAddress": "Na rejdišti 77/1, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Na+Rejdi%C5%A1ti+1%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Na rejdišti 77/1"
    ]
  },
  {
    "venue": "Pražská křižovatka - kostel sv. Anny",
    "city": "Praha",
    "street": "Zlatá 211",
    "lat": 50.0850162,
    "lon": 14.415331,
    "matchedAddress": "Zlatá 211/1, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Zlat%C3%A1+211%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Zlatá 211/1"
    ]
  },
  {
    "venue": "Reduta Jazz Club",
    "city": "Praha",
    "street": "Národní 20",
    "lat": 50.0820268,
    "lon": 14.4185129,
    "matchedAddress": "Národní 116/20, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1rodn%C3%AD+20%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Národní 116/20"
    ]
  },
  {
    "venue": "RockOpera Praha",
    "city": "Praha",
    "street": "Komunardů 306/1",
    "lat": 50.1000618,
    "lon": 14.4497473,
    "matchedAddress": "Komunardů 306/1, Holešovice, 17000 Praha 7",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komunard%C5%AF+306%2F1%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Rudolfinum - Dvořákova síň",
    "city": "Praha",
    "street": "Alšovo nábřeží 79/12",
    "lat": 50.0901719,
    "lon": 14.4152094,
    "matchedAddress": "Alšovo nábřeží 79/12, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Al%C5%A1ovo+n%C3%A1b%C5%99e%C5%BE%C3%AD+79%2F12%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Rudolfinum - Sukova síň",
    "city": "Praha",
    "street": "Alšovo nábř. 12",
    "lat": 50.0901719,
    "lon": 14.4152094,
    "matchedAddress": "Alšovo nábřeží 79/12, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Al%C5%A1ovo+n%C3%A1b%C5%99.+12%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Alšovo nábřeží 79/12"
    ]
  },
  {
    "venue": "Smetanova síň - Obecní dům",
    "city": "Praha",
    "street": "Náměstí Republiky 1090",
    "lat": 50.0876199,
    "lon": 14.4282466,
    "matchedAddress": "náměstí Republiky 1090/5, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1m%C4%9Bst%C3%AD+Republiky+1090%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "náměstí Republiky 1090/5"
    ]
  },
  {
    "venue": "Spolek Kašpar - Klubovna",
    "city": "Praha",
    "street": "Jindřišká 23",
    "lat": 50.0845441,
    "lon": 14.4290115,
    "matchedAddress": "Jindřišská 875/23, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Jind%C5%99i%C5%A1sk%C3%A1+23%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Jindřišská 875/23",
      "Jindřišská 23"
    ],
    "addressSourceUrl": "https://divadlovceletne.cz/kontakt/"
  },
  {
    "venue": "Stavovské divadlo",
    "city": "Praha",
    "street": "Ovocný trh",
    "lat": 50.0857824,
    "lon": 14.4232967,
    "matchedAddress": "Železná 540/11, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C5%BDelezn%C3%A1+540%2F11%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Železná 540/11"
    ],
    "addressSourceUrl": "https://nen.nipez.cz/verejne-zakazky/detail-zakazky/N006-18-V00004548"
  },
  {
    "venue": "Strašnické divadlo",
    "city": "Praha",
    "street": "Solidarity 1986/53",
    "lat": 50.0753607,
    "lon": 14.4992043,
    "matchedAddress": "Solidarity 1986/53, Strašnice, 10000 Praha 10",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Solidarity+1986%2F53%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Strašnické divadlo - kavárna",
    "city": "Praha",
    "street": "Solidarity 1986/53",
    "lat": 50.0753607,
    "lon": 14.4992043,
    "matchedAddress": "Solidarity 1986/53, Strašnice, 10000 Praha 10",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Solidarity+1986%2F53%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Studio 1",
    "city": "Praha",
    "street": "Vinohradská 12",
    "lat": 50.0785898,
    "lon": 14.4345049,
    "matchedAddress": "Vinohradská 1409/12, Vinohrady, 12000 Praha 2",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Vinohradsk%C3%A1+12%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Vinohradská 1409/12"
    ]
  },
  {
    "venue": "Studio 2, Český rozhlas",
    "city": "Praha",
    "street": "Vinohradská 1409/12",
    "lat": 50.0785898,
    "lon": 14.4345049,
    "matchedAddress": "Vinohradská 1409/12, Vinohrady, 12000 Praha 2",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Vinohradsk%C3%A1+1409%2F12%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Státní opera Praha",
    "city": "Praha",
    "street": "Wilsonova 4",
    "lat": 50.0807072,
    "lon": 14.4326341,
    "matchedAddress": "Wilsonova 101/4, Vinohrady, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Wilsonova+4%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Wilsonova 101/4"
    ]
  },
  {
    "venue": "Sál Pražské konzervatoře",
    "city": "Praha",
    "street": "Dvořákovo nábř. 2",
    "lat": 50.0907248,
    "lon": 14.4154709,
    "matchedAddress": "Dvořákovo nábřeží 77/2, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Dvo%C5%99%C3%A1kovo+n%C3%A1b%C5%99.+2%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Dvořákovo nábřeží 77/2"
    ]
  },
  {
    "venue": "Týnský chrám",
    "city": "Praha",
    "street": "Staroměstské náměstí",
    "lat": 50.0876101,
    "lon": 14.422031,
    "matchedAddress": "Staroměstské náměstí 604/14, Staré Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Starom%C4%9Bstsk%C3%A9+n%C3%A1m%C4%9Bst%C3%AD+604%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Staroměstské náměstí 604/14",
      "Staroměstské náměstí 604"
    ],
    "addressSourceUrl": "https://prague.eu/cs/objevujte/chram-matky-bozi-pred-tynem/"
  },
  {
    "venue": "Velká scéna HD Karlín",
    "city": "Praha",
    "street": "Křižíkova 10",
    "lat": 50.0902077,
    "lon": 14.4412264,
    "matchedAddress": "Křižíkova 283/10, Karlín, 18600 Praha 8",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=K%C5%99i%C5%BE%C3%ADkova+10%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Křižíkova 283/10"
    ]
  },
  {
    "venue": "Velká scéna Studia Ypsilon",
    "city": "Praha",
    "street": "Spálená 16",
    "lat": 50.0808792,
    "lon": 14.419873,
    "matchedAddress": "Spálená 75/16, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Sp%C3%A1len%C3%A1+16%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Spálená 75/16"
    ]
  },
  {
    "venue": "Zpěvácký spolek Hlahol v Praze",
    "city": "Praha",
    "street": "Masarykovo nábřeží 16",
    "lat": 50.0779588,
    "lon": 14.4144349,
    "matchedAddress": "Masarykovo nábřeží 248/16, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Masarykovo+n%C3%A1b%C5%99e%C5%BE%C3%AD+16%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Masarykovo nábřeží 248/16"
    ]
  },
  {
    "venue": "Činoherní klub",
    "city": "Praha",
    "street": "Ve Smečkách 594/26",
    "lat": 50.0792722,
    "lon": 14.4273199,
    "matchedAddress": "Ve Smečkách 594/26, Nové Město, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Ve+Sme%C4%8Dk%C3%A1ch+594%2F26%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Španělská synagoga",
    "city": "Praha",
    "street": "Vězeňská 1",
    "lat": 50.0902107,
    "lon": 14.4210134,
    "matchedAddress": "Vězeňská 141/1, Josefov, 11000 Praha 1",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=V%C4%9Bze%C5%88sk%C3%A1+1%2C+Praha&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Vězeňská 141/1"
    ]
  },
  {
    "venue": "Společenský dům Prostějov",
    "city": "Prostějov",
    "street": "Komenského 4142, 796 01 Prostějov 1",
    "lat": 49.4707591,
    "lon": 17.113305,
    "matchedAddress": "Komenského 4142/6, 79601 Prostějov",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komensk%C3%A9ho+4142%2C+Prost%C4%9Bjov&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Komenského 4142/6"
    ]
  },
  {
    "venue": "ZIMNÍ STADION PROSTĚJOV",
    "city": "Prostějov",
    "street": "U Stadionu 4452",
    "lat": 49.4797536,
    "lon": 17.1025662,
    "matchedAddress": "U Stadionu 4452, 79601 Prostějov",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=U+Stadionu+4452%2C+Prost%C4%9Bjov&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Zámek Průhonice - rytířský sál",
    "city": "Průhonice",
    "street": "Zámek 1",
    "lat": 50.0004507,
    "lon": 14.5574722,
    "matchedAddress": "Zámek 1, 25243 Průhonice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Z%C3%A1mek+1%2C+Pr%C5%AFhonice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Dům Natura Příbram",
    "city": "Příbram",
    "street": "Plzeňská 134",
    "lat": 49.689078,
    "lon": 14.0081365,
    "matchedAddress": "Plzeňská 134, Příbram I, 26101 Příbram",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Plze%C5%88sk%C3%A1+134%2C+P%C5%99%C3%ADbram&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Estrádní sál Příbram",
    "city": "Příbram",
    "street": "Legionářů 400",
    "lat": 49.6812953,
    "lon": 14.0008464,
    "matchedAddress": "Legionářů 400, Příbram VII, 26101 Příbram",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Legion%C3%A1%C5%99%C5%AF+400%2C+P%C5%99%C3%ADbram&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Foyer - Divadlo A. Dvořáka - Příbram",
    "city": "Příbram",
    "street": "Legionářů 400",
    "lat": 49.6812953,
    "lon": 14.0008464,
    "matchedAddress": "Legionářů 400, Příbram VII, 26101 Příbram",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Legion%C3%A1%C5%99%C5%AF+400%2C+P%C5%99%C3%ADbram&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Kino Příbram",
    "city": "Příbram",
    "street": "",
    "lat": 49.6812953,
    "lon": 14.0008464,
    "matchedAddress": "Legionářů 400, Příbram VII, 26101 Příbram",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Legion%C3%A1%C5%99%C5%AF+400%2C+P%C5%99%C3%ADbram&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Legionářů 400"
    ],
    "addressSourceUrl": "https://www.kinopribram.eu/o-kine/"
  },
  {
    "venue": "Kulturní dům - Estrádní sál",
    "city": "Příbram",
    "street": "Legionářů 400",
    "lat": 49.6812953,
    "lon": 14.0008464,
    "matchedAddress": "Legionářů 400, Příbram VII, 26101 Příbram",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Legion%C3%A1%C5%99%C5%AF+400%2C+P%C5%99%C3%ADbram&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Velká scéna Divadla A. Dvořáka Příbram",
    "city": "Příbram",
    "street": "Legionářů 400",
    "lat": 49.6812953,
    "lon": 14.0008464,
    "matchedAddress": "Legionářů 400, Příbram VII, 26101 Příbram",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Legion%C3%A1%C5%99%C5%AF+400%2C+P%C5%99%C3%ADbram&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Společenské centrum Bonaparte",
    "city": "Slavkov u Brna",
    "street": "Palackého náměstí 126",
    "lat": 49.1538351,
    "lon": 16.8756785,
    "matchedAddress": "Palackého náměstí 126, 68401 Slavkov u Brna",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Palack%C3%A9ho+n%C3%A1m%C4%9Bst%C3%AD+126%2C+Slavkov+u+Brna&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Kaple Zjevení Páně",
    "city": "Smiřice",
    "street": "Zámek 1",
    "lat": 50.2991323,
    "lon": 15.870043,
    "matchedAddress": "Zámek 1, 50303 Smiřice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Z%C3%A1mek+1%2C+Smi%C5%99ice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Dům Kultury Strakonice",
    "city": "Strakonice",
    "street": "Mírová 831",
    "lat": 49.2624373,
    "lon": 13.8974984,
    "matchedAddress": "Mírová 831, Strakonice I, 38601 Strakonice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=M%C3%ADrov%C3%A1+831%2C+Strakonice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Zámek Stráž nad Nežárkou",
    "city": "Stráž nad Nežárkou",
    "street": "nám. Emy Destinnové 1",
    "lat": 49.0687715,
    "lon": 14.9097916,
    "matchedAddress": "náměstí Emy Destinnové 1, 37802 Stráž nad Nežárkou",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=n%C3%A1m.+Emy+Destinnov%C3%A9+1%2C+Str%C3%A1%C5%BE+nad+Ne%C5%BE%C3%A1rkou&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "náměstí Emy Destinnové 1"
    ]
  },
  {
    "venue": "Státní zámek Telč",
    "city": "Telč",
    "street": "nám. Zachariáše z Hradce 1",
    "lat": 49.1853651,
    "lon": 15.4513208,
    "matchedAddress": "náměstí Zachariáše z Hradce 1, Telč-Vnitřní Město, 58856 Telč",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=n%C3%A1m.+Zachari%C3%A1%C5%A1e+z+Hradce+1%2C+Tel%C4%8D&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "náměstí Zachariáše z Hradce 1"
    ]
  },
  {
    "venue": "Spolkový dům Střelnice",
    "city": "Tábor",
    "street": "Žižkova 249",
    "lat": 49.4141586,
    "lon": 14.6614901,
    "matchedAddress": "Žižkova 249, 39001 Tábor",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=%C5%BDi%C5%BEkova+249%2C+T%C3%A1bor&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Kino a divadlo Pasáž",
    "city": "Třebíč",
    "street": "Masarykovo nám. 1323",
    "lat": 49.2135867,
    "lon": 15.8803292,
    "matchedAddress": "Masarykovo nám. 1323, Horka-Domky, 67401 Třebíč",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Masarykovo+n%C3%A1m.+1323%2C+T%C5%99eb%C3%AD%C4%8D&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "JUPITER club - Velké Meziříčí",
    "city": "Velké Meziříčí",
    "street": "Náměstí 17/19",
    "lat": 49.3543314,
    "lon": 16.0124934,
    "matchedAddress": "Náměstí 17/19, 59401 Velké Meziříčí",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=N%C3%A1m%C4%9Bst%C3%AD+17%2F19%2C+Velk%C3%A9+Mezi%C5%99%C3%AD%C4%8D%C3%AD&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Datart hala Zlín",
    "city": "Zlín",
    "street": "U Zimního stadionu 4286",
    "lat": 49.2184923,
    "lon": 17.6594162,
    "matchedAddress": "U Zimního stadionu 4286, 76001 Zlín",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=U+Zimn%C3%ADho+stadionu+4286%2C+Zl%C3%ADn&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "TRINITY BANK ARÉNA - Zlín",
    "city": "Zlín",
    "street": "Březnická 4068",
    "lat": 49.2174624,
    "lon": 17.6599592,
    "matchedAddress": "Březnická 4068, 76001 Zlín",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=B%C5%99eznick%C3%A1+4068%2C+Zl%C3%ADn&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Dům kultury Ústí nad Labem",
    "city": "Ústí nad Labem",
    "street": "Velká Hradební 1025/19",
    "lat": 50.6623388,
    "lon": 14.0397761,
    "matchedAddress": "Velká Hradební 1025/19, Ústí nad Labem-centrum, 40001 Ústí nad Labem",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Velk%C3%A1+Hradebn%C3%AD+1025%2F19%2C+%C3%9Ast%C3%AD+nad+Labem&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "Dům kultury Česká Kamenice",
    "city": "Česká Kamenice",
    "street": "Komenského 288",
    "lat": 50.8006229,
    "lon": 14.4186238,
    "matchedAddress": "Komenského 288, 40721 Česká Kamenice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Komensk%C3%A9ho+288%2C+%C4%8Cesk%C3%A1+Kamenice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "BUDVAR ARÉNA - Č. Budějovice",
    "city": "České Budějovice",
    "street": "F. A. Gerstnera 7",
    "lat": 48.9707966,
    "lon": 14.4711621,
    "matchedAddress": "F. A. Gerstnera 7/8, České Budějovice 7, 37001 České Budějovice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=F.+A.+Gerstnera+7%2C+%C4%8Cesk%C3%A9+Bud%C4%9Bjovice&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "F. A. Gerstnera 7/8"
    ]
  },
  {
    "venue": "Koncertní síň O. Jeremiáše",
    "city": "České Budějovice",
    "street": "Kněžská 411",
    "lat": 48.9740501,
    "lon": 14.4765469,
    "matchedAddress": "Kněžská 411/6, České Budějovice 1, 37001 České Budějovice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Kn%C4%9B%C5%BEsk%C3%A1+411%2C+%C4%8Cesk%C3%A9+Bud%C4%9Bjovice&outSR=4326&outFields=%2A&maxLocations=5&f=json",
    "streetAliases": [
      "Kněžská 411/6"
    ]
  },
  {
    "venue": "Restaurace Beseda",
    "city": "České Budějovice",
    "street": "Na Sadech 2036/18",
    "lat": 48.9769398,
    "lon": 14.478144,
    "matchedAddress": "Na Sadech 2036/18, České Budějovice 3, 37001 České Budějovice",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Na+Sadech+2036%2F18%2C+%C4%8Cesk%C3%A9+Bud%C4%9Bjovice&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  },
  {
    "venue": "KD MOSKVA",
    "city": "Žatec",
    "street": "Podměstí 2126",
    "lat": 50.330826,
    "lon": 13.5383004,
    "matchedAddress": "Podměstí 2126, 43801 Žatec",
    "verifiedAt": "2026-10-14",
    "verificationUrl": "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1/findAddressCandidates?SingleLine=Podm%C4%9Bst%C3%AD+2126%2C+%C5%BDatec&outSR=4326&outFields=%2A&maxLocations=5&f=json"
  }
];
