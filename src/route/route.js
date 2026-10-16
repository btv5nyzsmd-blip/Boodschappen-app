// Berekent een korte looproute: ingang → alle benodigde secties → kassa.
//
// Werkwijze (heuristiek, niet gegarandeerd optimaal maar in de praktijk goed):
// 1. Nearest neighbour: loop steeds naar de dichtstbijzijnde sectie die je nog niet had.
// 2. 2-opt: draai stukken van de route om zolang de route daardoor korter wordt.
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
 * @returns {{ stops: {sectie: object, afstand: number}[], kassa: object, totaleAfstand: number, lijn: {x:number,y:number}[] }}
 */
export function berekenRoute(winkel, sectieIds, netwerk = bouwNetwerk(winkel)) {
  const uniek = [...new Set(sectieIds)];
  const kassaIds = winkel.kassas.map((k) => `kassa:${k.naam}`);
  if (kassaIds.length === 0) throw new Error('De winkel heeft geen kassa.');
  const ids = ['ingang', ...uniek, ...kassaIds];
  const tabel = afstandenTabel(netwerk, ids);
  const sectieIndexen = uniek.map((_, i) => i + 1);

  let beste = null;
  kassaIds.forEach((_, k) => {
    const kassaIndex = 1 + uniek.length + k;
    const volgorde = [...dichtstbijzijndeBuur(tabel.d, 0, sectieIndexen), kassaIndex];
    const verbeterd = tweeOpt(tabel.d, volgorde);
    const lengte = routeLengte(tabel.d, verbeterd);
    if (!beste || lengte < beste.lengte) beste = { volgorde: verbeterd, lengte };
  });

  const { volgorde } = beste;
  const stops = [];
  const lijn = [];
  for (let i = 0; i < volgorde.length; i++) {
    if (i > 0) {
      const stuk = tabel.pad(volgorde[i - 1], volgorde[i]);
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
  };
}
