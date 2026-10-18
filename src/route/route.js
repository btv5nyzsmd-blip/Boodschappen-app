// Berekent een korte looproute: ingang → alle benodigde secties → kassa.
//
// Werkwijze (heuristiek, niet gegarandeerd optimaal maar in de praktijk goed):
// 1. Nearest neighbour: loop steeds naar de dichtstbijzijnde sectie die je nog niet had.
// 2. 2-opt: draai stukken van de route om zolang de route daardoor korter wordt.
// 3. Or-opt: verplaats 1 tot 3 stops naar een betere plek in de route.
// Stap 2 en 3 worden herhaald tot geen van beide nog iets oplevert.
// Dit doen we voor elke kassa als eindpunt en we kiezen de kortste uitkomst.

import { bouwNetwerk } from './looppaden.js';
import { afstandenTabel } from './afstanden.js';

/** Lengte van een volgorde van indexen in de afstandstabel. */
export function routeLengte(d, volgorde) {
  let totaal = 0;
  for (let i = 0; i + 1 < volgorde.length; i++) totaal += d[volgorde[i]][volgorde[i + 1]];
  return totaal;
}

/** Nearest neighbour vanaf `start` langs alle `bezoek`-indexen. */
export function dichtstbijzijndeBuur(d, start, bezoek) {
  const resterend = new Set(bezoek);
  const volgorde = [start];
  let huidige = start;
  while (resterend.size > 0) {
    let beste = null;
    for (const kandidaat of resterend) {
      if (beste === null || d[huidige][kandidaat] < d[huidige][beste]) beste = kandidaat;
    }
    volgorde.push(beste);
    resterend.delete(beste);
    huidige = beste;
  }
  return volgorde;
}

/**
 * 2-opt op een route met vast begin- en eindpunt.
 * Draait het stuk volgorde[i..j] om als dat korter is. Afstanden mogen
 * symmetrisch worden verondersteld (lopen gaat beide kanten op even ver).
 */
export function tweeOpt(d, volgorde) {
  const route = [...volgorde];
  let verbeterd = true;
  while (verbeterd) {
    verbeterd = false;
    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length - 1; j++) {
        const a = route[i - 1], b = route[i], c = route[j], e = route[j + 1];
        const winst = d[a][b] + d[c][e] - (d[a][c] + d[b][e]);
        if (winst > 1e-9) {
          // stuk i..j omdraaien
          for (let lo = i, hi = j; lo < hi; lo++, hi--) [route[lo], route[hi]] = [route[hi], route[lo]];
          verbeterd = true;
        }
      }
    }
  }
  return route;
}

/**
 * Or-opt op een route met vast begin- en eindpunt.
 * Haalt een stukje van 1 tot 3 opeenvolgende stops uit de route en zet het
 * (eventueel omgedraaid) op de plek waar het de route het meest inkort.
 * Voorbeeld: de groente die je aan het eind nog moest halen, gaat naar het begin
 * omdat je er bij binnenkomst toch al langs liep.
 */
export function orOpt(d, volgorde) {
  let route = [...volgorde];
  let verbeterd = true;
  while (verbeterd) {
    verbeterd = false;
    for (let lengte = 1; lengte <= 3 && !verbeterd; lengte++) {
      for (let i = 1; i + lengte < route.length && !verbeterd; i++) {
        const stuk = route.slice(i, i + lengte);
        const rest = [...route.slice(0, i), ...route.slice(i + lengte)];
        const huidig = routeLengte(d, route);
        for (let j = 1; j < rest.length && !verbeterd; j++) {
          if (j === i) continue; // zelfde plek
          for (const variant of lengte > 1 ? [stuk, [...stuk].reverse()] : [stuk]) {
            const nieuw = [...rest.slice(0, j), ...variant, ...rest.slice(j)];
            if (routeLengte(d, nieuw) < huidig - 1e-9) {
              route = nieuw;
              verbeterd = true;
              break;
            }
          }
        }
      }
    }
  }
  return route;
}

/** Wisselt 2-opt en or-opt af tot geen van beide de route nog korter maakt. */
export function verbeter(d, volgorde) {
  let route = volgorde;
  for (;;) {
    const lengte = routeLengte(d, route);
    route = orOpt(d, tweeOpt(d, route));
    if (routeLengte(d, route) >= lengte - 1e-9) return route;
  }
}

/**
 * Bepaalt welke secties je moet bezoeken voor een lijst categorieën.
 * Staat een categorie in meerdere secties, dan nemen we de eerste.
 * @returns {{ perSectie: Map<string,string[]>, nietGevonden: string[] }}
 */
export function sectiesVoorCategorieen(winkel, categorieen) {
  const perSectie = new Map();
  const nietGevonden = [];
  for (const cat of new Set(categorieen)) {
    const sectie = winkel.secties.find((s) => s.categorieen.includes(cat));
    if (!sectie) {
      nietGevonden.push(cat);
      continue;
    }
    if (!perSectie.has(sectie.id)) perSectie.set(sectie.id, []);
    perSectie.get(sectie.id).push(cat);
  }
  return { perSectie, nietGevonden };
}

/**
 * Berekent de route langs de opgegeven secties.
 * @param {object} winkel  plattegrond (zie data/winkels)
 * @param {string[]} sectieIds  secties die bezocht moeten worden
 * @param {object} [netwerk]  optioneel een eerder gebouwd netwerk (sneller)
 * @param {string} [start]  waar je nu staat: "ingang" of een sectie-id
 * @param {{ kassaSoort?: string }} [opties]  kassaSoort: alleen kassa's van deze soort ("kassa" of "zelfscan");
 *   leeg of onbekend = de kassa die de route het kortst maakt
 * @returns {{ stops: {sectie: object, afstand: number}[], kassa: object, totaleAfstand: number,
 *   lijn: {x:number,y:number}[], stukken: {x:number,y:number}[][] }}
 *   `stukken[i]` is het looppad naar stop i; het laatste stuk loopt naar de kassa.
 */
export function berekenRoute(winkel, sectieIds, netwerk = bouwNetwerk(winkel), start = 'ingang', { kassaSoort } = {}) {
  const uniek = [...new Set(sectieIds)];
  const passend = winkel.kassas.filter((k) => kassaSoortVan(k) === kassaSoort);
  const kassaIds = (passend.length ? passend : winkel.kassas).map((k) => `kassa:${k.naam}`);
  if (kassaIds.length === 0) throw new Error('De winkel heeft geen kassa.');
  const ids = [start, ...uniek, ...kassaIds];
  const tabel = afstandenTabel(netwerk, ids);
  const sectieIndexen = uniek.map((_, i) => i + 1);

  let beste = null;
  kassaIds.forEach((_, k) => {
    const kassaIndex = 1 + uniek.length + k;
    const volgorde = [...dichtstbijzijndeBuur(tabel.d, 0, sectieIndexen), kassaIndex];
    const verbeterd = verbeter(tabel.d, volgorde);
    const lengte = routeLengte(tabel.d, verbeterd);
    if (!beste || lengte < beste.lengte) beste = { volgorde: verbeterd, lengte };
  });

  const { volgorde } = beste;
  const stops = [];
  const lijn = [];
  const stukken = [];
  for (let i = 0; i < volgorde.length; i++) {
    if (i > 0) {
      const stuk = tabel.pad(volgorde[i - 1], volgorde[i]);
      stukken.push(stuk);
      lijn.push(...(lijn.length ? stuk.slice(1) : stuk));
    }
    const id = ids[volgorde[i]];
    if (i > 0 && i < volgorde.length - 1) {
      stops.push({ sectie: winkel.secties.find((s) => s.id === id), afstand: tabel.d[volgorde[i - 1]][volgorde[i]] });
    }
  }
  const kassaNaam = ids[volgorde[volgorde.length - 1]].slice('kassa:'.length);
  return {
    stops,
    kassa: winkel.kassas.find((k) => k.naam === kassaNaam),
    totaleAfstand: beste.lengte,
    lijn,
    stukken,
  };
}

/** Soort kassa: "kassa" (met caissière) of "zelfscan". */
export const kassaSoortVan = (kassa) => kassa.soort ?? (/zelf/i.test(kassa.naam) ? 'zelfscan' : 'kassa');
