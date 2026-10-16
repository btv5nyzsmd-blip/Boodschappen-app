# Boodschappenroute

Een webapp voor op je telefoon. Je zet je boodschappen op een lijst en de app berekent de kortste looproute door de supermarkt. Onderweg vink je af wat je hebt.

- **Lijst**: zoek specifieke producten (merk, inhoud) en zet ze op je lijst.
- **Route**: de stops in looproute-volgorde, met per stop de producten om af te vinken. Vink je iets af buiten de volgorde, of voeg je onderweg iets toe? Dan wordt de rest van de route opnieuw berekend vanaf waar je nu staat.
- **Kaart**: een plattegrond van de winkel met de route, de volgende stop en waar je nu bent.

Alles draait in de browser. Er is geen account of server nodig. Je lijst wordt op je eigen telefoon bewaard.

> **Status:** fase 1 (winkelmodel en route). Fase 2 (maaltijdplanning en budget) en fase 3 (aanbiedingen) volgen.

---

## Inhoud

1. [Eenmalig installeren](#eenmalig-installeren)
2. [De app starten en testen](#de-app-starten-en-testen)
3. [Een eigen winkel toevoegen](#een-eigen-winkel-toevoegen)
4. [Producten toevoegen](#producten-toevoegen)
5. [Online zetten (GitHub Pages)](#online-zetten-github-pages)
6. [Hoe het werkt](#hoe-het-werkt)

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

## Producten toevoegen

### Via de app (snel)

Zoek je iets dat er niet tussen staat? Onder de zoekresultaten kun je het als **eigen product** toevoegen: je kiest de afdeling en klaar. Eigen producten worden alleen op dat apparaat bewaard.

### Via `data/producten.json` (blijvend, voor iedereen)

Elke regel is één product:

```json
{ "id": "coca-cola-zero-sugar-1-5-l", "merk": "Coca-Cola", "naam": "Zero sugar", "inhoud": "1,5 L",
  "categorie": "frisdrank", "prijs": 2.39, "zoekwoorden": ["cola"] }
```

| Veld | Uitleg |
|---|---|
| `id` | Unieke code, kleine letters en streepjes. Handig: merk + naam + inhoud. |
| `merk`, `naam`, `inhoud` | Zoals op de verpakking. Hierop wordt gezocht. |
| `categorie` | Een id uit `data/categorieen.json`. Bepaalt waar in de winkel het ligt. |
| `prijs` | Indicatieprijs in euro's. Nodig voor het budget in fase 2. |
| `zoekwoorden` | Optioneel: extra woorden waarop het product gevonden moet worden (bijv. `"wc-papier"` bij toiletpapier). |

De catalogus bevat nu zo'n 350 veelgekochte producten met **geschatte** prijzen. Ze zijn met de hand samengesteld en niet van de Jumbo-website gehaald.

### Een nieuwe categorie

Voeg een regel toe aan `data/categorieen.json` en zet de nieuwe id bij de juiste sectie van je winkel.

---

## Online zetten (GitHub Pages)

Zo heb je de app altijd op je telefoon, ook in de winkel:

1. Maak een gratis account op <https://github.com> en maak een nieuwe (lege) repository, bijv. `boodschappen-app`.
2. Zet deze map erin (of vraag Claude om dat te doen).
3. Ga in de repository naar **Settings → Pages** en kies bij **Source**: **GitHub Actions**.
4. Bij elke wijziging draait GitHub de tests en publiceert de app op `https://<jouw-naam>.github.io/boodschappen-app/`.
5. Open dat adres op je telefoon en kies **Zet op beginscherm**. Dan staat de app tussen je andere apps.

---

## Hoe het werkt

```
data/
  winkels/*.json        plattegronden
  producten.json        productcatalogus
  categorieen.json      afdelingen
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

**Techniek:** gewoon JavaScript zonder framework, [Vite](https://vite.dev) om te starten en te bouwen, en [Vitest](https://vitest.dev) voor de tests. Er zijn weinig onderdelen die kunnen verouderen.
