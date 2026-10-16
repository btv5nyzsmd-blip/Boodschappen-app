# Boodschappenroute

Een webapp voor op je telefoon. Je zet je boodschappen op een lijst en de app berekent de kortste looproute door de supermarkt. Onderweg vink je af wat je hebt.

- **Menu**: geef je weekbudget, het aantal personen en maaltijden en je wensen op. De app stelt een weekmenu samen dat binnen je budget blijft en zo min mogelijk verse restjes overlaat. Met één tik staat alles op je boodschappenlijst.
- **Lijst**: zoek specifieke producten (merk, inhoud) en zet ze op je lijst.
- **Route**: de stops in looproute-volgorde, met per stop de producten om af te vinken. Vink je iets af buiten de volgorde, of voeg je onderweg iets toe? Dan wordt de rest van de route opnieuw berekend vanaf waar je nu staat.
- **Kaart**: een plattegrond van de winkel met de route, de volgende stop en waar je nu bent.

Alles draait in de browser. Er is geen account of server nodig. Je lijst wordt op je eigen telefoon bewaard.

> **Status:** fase 1 (winkelmodel en route) en fase 2 (maaltijdplanning en budget) zijn klaar. Fase 3 (aanbiedingen) volgt.

---

## Inhoud

1. [Eenmalig installeren](#eenmalig-installeren)
2. [De app starten en testen](#de-app-starten-en-testen)
3. [Een eigen winkel toevoegen](#een-eigen-winkel-toevoegen)
4. [Producten en prijzen](#producten-en-prijzen)
5. [Recepten toevoegen](#recepten-toevoegen)
6. [Online zetten (GitHub Pages)](#online-zetten-github-pages)
7. [Hoe het werkt](#hoe-het-werkt)
8. [Hoe het weekmenu wordt gekozen](#hoe-het-weekmenu-wordt-gekozen)

---

## Eenmalig installeren

1. Installeer **Node.js** (versie 20 of nieuwer) via <https://nodejs.org>. Kies de "LTS"-versie.
2. Open een terminal in deze map:
   - Windows: open de map in Verkenner, klik in de adresbalk, typ `cmd` en druk op Enter.
   - Mac: klik met rechts op de map en kies "Nieuwe Terminal bij map".
3. Typ:

   ```
   npm install
   ```

## De app starten en testen

| Wat | Commando |
|---|---|
| App starten op je computer | `npm run dev` |
| Alle tests draaien | `npm test` |
| Publiceerbare versie maken (in de map `dist`) | `npm run build` |

Na `npm run dev` zie je een adres zoals `http://localhost:5173`. Open dat in je browser. Er staat ook een `Network`-adres (bijv. `http://192.168.1.20:5173`). Dat kun je op je telefoon openen als die op hetzelfde wifi-netwerk zit.

Wijzig je een bestand terwijl de app draait, dan ververst de pagina vanzelf.

**Draai `npm test` na elke wijziging aan een winkel of de producten.** De tests controleren onder meer of alle secties bereikbaar zijn, of elke categorie bestaat en of er geen dubbele ids zijn.

---

## Een eigen winkel toevoegen

Winkels staan in `data/winkels/`. Elk `.json`-bestand in die map verschijnt automatisch in de app. Bij meer dan één winkel krijg je bovenaan een keuzelijst.

De makkelijkste manier is `jumbo-zwolle-stadshagen.json` kopiëren en aanpassen. Die winkel is overgenomen van de officiële Jumbo-plattegrond. Vraag in de winkel of op de website naar de plattegrond van jouw filiaal; daarop staan alle afdelingen.

### Stap 1: teken de winkel op ruitjespapier

Gebruik meters, met één hokje per meter. De linkerbovenhoek (achterwand, links) is punt `(0, 0)`.

- **x** loopt van links naar rechts.
- **y** loopt van de achterwand naar de voorkant (de ingang).

```
 (0,0) ─────────────────────────── x →
   │   ┌───────── bier & wijn ─────────┐
   │   │ ═══ pad (y=2.6) ════════════  │
   │   │ ▓▓▓▓▓ schap ▓▓▓▓▓  ▓▓▓▓▓▓▓▓   │
   │   │ ═══ pad (y=6) ══════════════  │   ═══ = looppad
   y   │ ...                    kassa's│   ▓▓▓ = schap
   ↓   └──────────────────── ingang ───┘
```

### Stap 2: vul het bestand in

```json
{
  "naam": "Mijn supermarkt",
  "toelichting": "Vrije tekst, wordt onder de kaart getoond",
  "breedte": 46,
  "diepte": 34,
  "ingang": { "x": 3, "y": 33 },
  "kassas": [
    { "naam": "Kassa 1", "x": 24, "y": 32 }
  ],
  "looppaden": [
    { "id": "voorpad", "naam": "Voorkant", "van": [3, 29], "naar": [42, 29] },
    { "id": "gang-1",  "naam": "Gang 1",   "van": [9, 4],  "naar": [9, 29] }
  ],
  "schappen": [
    { "label": "", "x": 9.7, "y": 6, "breedte": 1.6, "hoogte": 21 }
  ],
  "secties": [
    { "id": "gang-1-voor", "naam": "Gang 1 (voorkant)", "groep": "Gang 1",
      "x": 9, "y": 22, "categorieen": ["brood", "gebak"] }
  ]
}
```

Wat elk onderdeel betekent:

| Onderdeel | Uitleg |
|---|---|
| `looppaden` | Rechte lijnen waarover je kunt lopen, van `van` naar `naar`. Waar twee looppaden elkaar kruisen, kun je afslaan. De ingang en de kassa's moeten ook met een looppad verbonden zijn. |
| `secties` | Een plek in de winkel waar je stilstaat om iets te pakken. `x`/`y` is waar je dan staat, dus midden in het gangpad. De app koppelt een sectie automatisch aan het dichtstbijzijnde looppad. Wil je zelf kiezen, zet er dan `"looppad": "gang-1"` bij. |
| `categorieen` | Welke afdelingen bij die sectie liggen. Gebruik de ids uit `data/categorieen.json`. **Elke categorie mag maar in één sectie staan.** |
| `schappen` | Alleen voor de tekening: grijze rechthoeken (`x`, `y` = linkerbovenhoek). Met `"soort": "kassa"` worden ze oranje. Ze hebben geen invloed op de route. |
| `omtrek` | Optioneel: de buitenmuur als lijst hoekpunten `[x, y]`, voor een winkel die niet rechthoekig is. |
| `labels` | Optioneel: afdelingsnamen op de kaart, bijv. `{ "tekst": "Zuivel", "x": 1.6, "y": 11, "draai": -90 }`. |
| `kassas` | Elke kassa is een mogelijk eindpunt. De app kiest de kassa die de totale route het kortst maakt. |

### Tips

- Je kunt niet door schappen lopen, omdat de route alleen over looppaden gaat. Vergeet je een dwarspad, dan loopt de app een omweg.
- Een categorie die in de winkel niet voorkomt, mag je weglaten. Producten uit die categorie komen dan onder "Niet op de plattegrond".
- Draai daarna `npm test`. Als iets niet klopt, zegt de test welke sectie of categorie het probleem is.

---

## Producten en prijzen

De productcatalogus (`data/producten.json`) bevat alle ±17.000 producten van Jumbo, met de actuele prijs. Die komen uit de **open data van [Checkjebon.nl](https://github.com/supermarkt/checkjebon)**. Dat project publiceert dagelijks de prijzen van Nederlandse supermarkten en staat hergebruik toe (MIT-licentie). Wij scrapen zelf niets.

**Prijzen bijwerken:**
- Automatisch: als de app op GitHub staat, gebeurt dit elke ochtend (zie [Online zetten](#online-zetten-github-pages)).
- Met de hand: `npm run prijzen`.

De datum van de prijzen staat in `data/bron.json` en onder je boodschappenlijst.

> Aanbiedingen zitten nog niet in deze gegevens. De prijs is de prijs die op dat moment op jumbo.com stond.

### Afdeling van een product

Checkjebon geeft niet aan in welke afdeling een product ligt. De app bepaalt dat zelf met de trefwoorden in **`data/categorie-regels.json`**. Een regel zegt bijvoorbeeld: staat "kipfilet" in de naam, dan hoort het product bij *Kip & gevogelte*. De regels worden van boven naar beneden gecontroleerd en de eerste die past, wint. Zo komt "Whiskas kattenvoer met kip" bij *Huisdier*, omdat die regel bovenaan staat.

Ongeveer 91% van de producten krijgt zo automatisch een afdeling. Voor de rest:

- **In de app:** een product zonder afdeling staat in de route onder **Afdeling onbekend**, met een keuzelijst. Kies de afdeling en het product komt meteen in de route. Je telefoon onthoudt die keuze.
- **Voor iedereen:** zet het product in **`data/categorie-uitzonderingen.json`**, bijvoorbeeld:
  ```json
  { "producten": { "jumbo-erwten-450-g-699986zk": "diepvries" } }
  ```
  Het product-id staat in `data/producten.json`. Draai daarna `npm run prijzen`.

### Producten die er niet in staan

Zoek je iets dat er niet tussen staat? Onder de zoekresultaten kun je het als **eigen product** toevoegen. Je kiest de afdeling en het wordt op je telefoon bewaard.

### Een nieuwe categorie

Voeg een regel toe aan `data/categorieen.json` en zet de nieuwe id bij de juiste sectie van je winkel.

Met `"houdbaar": true` geef je aan dat een restje niet bederft (rijst, pasta, kruiden, conserven). Zo'n restje telt bij het weekmenu niet als verspilling. Het blijft dan voorraad voor een volgende week.

---

## Recepten toevoegen

Recepten staan in `data/recepten.json`. Elk recept ziet er zo uit:

```json
{ "id": "bloemkoolcurry", "naam": "Bloemkoolcurry met kikkererwten", "personen": 4, "tijd": 35,
  "soort": "vega", "bevat": [], "tags": ["snel"],
  "bereiding": "Fruit ui met currypasta. Voeg bloemkool, kikkererwten en kokosmelk toe…",
  "ingredienten": [
    { "product": "jumbo-bloemkool-302249stk", "hoeveelheid": 0.5 },
    { "product": "jumbo-kokosmelk-18-vet-400-ml-408583blk", "hoeveelheid": 400 },
    { "product": "jumbo-basmati-rijst-voordeelverpakking-1-kg-186364zk", "hoeveelheid": 300 }
  ]
}
```

| Veld | Uitleg |
|---|---|
| `id` | Unieke code, kleine letters en streepjes. |
| `personen` | Voor hoeveel personen de hoeveelheden zijn. De app rekent om naar jouw aantal. |
| `tijd` | Bereidingstijd in minuten. Tot en met 30 minuten telt als "snel". |
| `soort` | Voor afwisseling: `kip`, `gehakt`, `rund`, `varken`, `vis` of `vega`. De app kiest niet te vaak dezelfde soort. |
| `bevat` | Wat erin zit, voor de uitsluitingen: `varken`, `rund`, `kip`, `vis`. Leeg (`[]`) = vegetarisch. |
| `tags` | Optioneel, bijv. `"kindvriendelijk"`. |
| `ingredienten` | Per ingrediënt de `id` van een product uit `data/producten.json` en de `hoeveelheid`. |

**De hoeveelheid is in de eenheid van de verpakking:**

- verpakking in gram of kilo → hoeveelheid in **gram** (300 g rijst = `300`);
- verpakking in ml of liter → hoeveelheid in **ml** (250 ml room = `250`);
- verpakking in stuks → hoeveelheid in **stuks** (een halve bloemkool = `0.5`, 2 eieren = `2`).

Zoek het product-id op in `data/producten.json`, bijvoorbeeld door in je editor te zoeken op "bloemkool".

Draai daarna `npm test`. De tests melden een onbekend product, een ontbrekend veld of een "vegetarisch" recept waar toch vlees in zit.

---

## Online zetten (GitHub Pages)

Zo staat de app op je eigen webadres, worden de prijzen elke ochtend vanzelf bijgewerkt en heb je de app altijd op je telefoon. Het kost niets.

**Eenmalig (± 10 minuten):**

1. **Account maken.** Ga naar <https://github.com/signup> en maak een gratis account. Je gebruikersnaam komt in het webadres van de app, bijvoorbeeld `tijn.github.io`.
2. **Lege repository maken.** Een repository is een map op GitHub waar de code in staat. Klik rechtsboven op **+** en dan **New repository**.
   - Repository name: `boodschappen-app`
   - Kies **Public**. GitHub Pages is alleen gratis voor openbare repositories. Er staan geen persoonlijke gegevens in de code: je lijst blijft op je telefoon.
   - Vink verder niets aan en klik op **Create repository**.
3. **Claude toegang geven.** Ga naar <https://claude.ai/connect-github>, koppel je GitHub-account en geef de Claude GitHub-app toegang tot `boodschappen-app`. Dan kan Claude de code erin zetten.
4. **Pages aanzetten.** Ga in de repository naar **Settings → Pages** en kies bij **Source**: **GitHub Actions**.

**Daarna gaat het vanzelf:**
- Bij elke wijziging draait GitHub de tests en publiceert de app op `https://<jouw-naam>.github.io/boodschappen-app/`.
- Elke ochtend om ± 07:17 haalt GitHub de nieuwste prijzen op en publiceert opnieuw.
- Wil je het nu meteen? Ga in de repository naar **Actions → Publiceren → Run workflow**.

Open het adres op je telefoon en kies **Zet op beginscherm**. Dan staat de app tussen je andere apps.

---

## Hoe het werkt

```
data/
  winkels/*.json        plattegronden
  producten.json        productcatalogus (wordt overschreven door npm run prijzen)
  categorieen.json      afdelingen
  categorie-regels.json trefwoorden om producten aan een afdeling te koppelen
  recepten.json         recepten voor het weekmenu
scripts/
  prijzen-bijwerken.mjs haalt producten en prijzen op bij Checkjebon.nl
src/
  route/looppaden.js    maakt een netwerk van looppaden en kruisingen
  route/afstanden.js    kortste loopafstand tussen twee punten (Dijkstra)
  route/route.js        volgorde van de stops (nearest neighbour + 2-opt)
  lijst/                zoeken, lijst bewerken, bewaren op je telefoon
  ui/                   de drie schermen
tests/                  automatische tests
```

**Routeberekening, in gewone taal:**

1. De app berekent voor elk paar stops hoe ver je moet lopen, via de gangpaden en niet hemelsbreed.
2. Hij maakt een eerste route door steeds naar de dichtstbijzijnde stop te lopen die je nog niet had.
3. Daarna probeert hij stukken van de route om te draaien ("2-opt"). Wordt de route daar korter van, dan houdt hij die versie. Dat herhaalt hij tot er niets meer te winnen valt.
4. Dan probeert hij losse stops (of groepjes van 2–3) naar een betere plek te verplaatsen ("or-opt"). Bijvoorbeeld de groente die achteraan stond, terwijl je er bij binnenkomst al langsliep.
5. Stap 3 en 4 herhaalt hij tot er niets meer te winnen valt, voor elke kassa als eindpunt. De kortste uitkomst wint.

Dit is niet gegarandeerd de allerkortste route, maar het komt heel dicht in de buurt. In de Jumbo Zwolle Stadshagen, met 200 willekeurige lijsten van 12 stops, was de route gemiddeld 0,3% langer dan de kortst mogelijke, en in het slechtste geval 5%.

**Onderweg herberekenen:** zodra je iets afvinkt, onthoudt de app dat je bij die afdeling staat. De rest van de route wordt dan vanaf daar berekend. Met **Vanaf ingang** op het routescherm begin je weer bij de ingang. Met **Klaar met boodschappen** haal je de afgevinkte producten van de lijst, en begint de volgende keer weer bij de ingang.

## Hoe het weekmenu wordt gekozen

**Kosten.** Je koopt altijd hele verpakkingen. Gebruiken twee gerechten samen één bloemkool, dan koop je er maar één. Het bedrag "Te betalen" is wat je deze week bij de kassa kwijt bent. Een pak rijst dat je deze week koopt en pas volgende week opmaakt, telt dus volledig mee in deze week, zoals je het ook betaalt. Vink je bij de boodschappen "Heb ik" aan, dan telt dat product niet mee.

De kosten **per maaltijd** zijn wat je van elk product gebruikt. Voor een recept met 300 g uit een kilozak rijst telt dus 30% van de prijs.

**Restjes.** Wat overblijft is:
- **vers** (groente, vlees, room): telt als verspilling, tenzij een ander gerecht het opmaakt;
- **houdbaar** (rijst, pasta, kruiden): voorraad voor een volgende week.

**Kiezen.** De app probeert veel combinaties van recepten en geeft elke combinatie strafpunten:
- boven het budget: heel veel strafpunten, zodat het menu er altijd onder blijft als dat kan;
- verse restjes die niemand opmaakt: strafpunten naar de waarde van het restje (de "halve bloemkool" uit de opdracht);
- te vaak dezelfde soort (drie keer kip): een paar strafpunten;
- een recept dat bij je voorkeur past (snel, vegetarisch, kindvriendelijk): juist pluspunten.

De combinatie met de minste strafpunten wint. Met **Andere suggestie** krijg je een ander, even goed menu. Zet maaltijden die je zeker wilt houden eerst **vast**. Met **Ander recept** vervang je één maaltijd en blijft de rest staan.

Lukt het niet onder het budget te blijven, dan zegt de app dat en laat hij het goedkoopste menu zien dat bij je wensen past.

---

**Techniek:** gewoon JavaScript zonder framework, [Vite](https://vite.dev) om te starten en te bouwen, en [Vitest](https://vitest.dev) voor de tests. Er zijn weinig onderdelen die kunnen verouderen.
