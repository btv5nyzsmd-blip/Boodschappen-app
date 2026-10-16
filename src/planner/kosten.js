// Rekent uit wat een set maaltijden kost.
//
// Je koopt altijd hele verpakkingen. Gebruiken twee gerechten samen één bloemkool,
// dan koop je er maar één. Wat overblijft is:
// - houdbaar (rijst, pasta, kruiden): voorraad voor een volgende week, geen verspilling;
// - vers (groente, vlees, room): verspilling, tenzij een ander gerecht het opmaakt.

import { leesInhoud } from './verpakking.js';

/**
 * Hoeveel van elk product heb je nodig voor deze recepten?
 * @returns {Map<string, number>}  product-id → hoeveelheid in basiseenheid
 */
export function benodigd(recepten, personen) {
  const nodig = new Map();
  for (const recept of recepten) {
    const factor = personen / recept.personen;
    for (const ing of recept.ingredienten) {
      nodig.set(ing.product, (nodig.get(ing.product) ?? 0) + ing.hoeveelheid * factor);
    }
  }
  return nodig;
}

/**
 * Volledige kostenberekening voor een weekmenu.
 * @param {object[]} recepten  de gekozen recepten
 * @param {object} opties
 * @param {number} opties.personen
 * @param {Map<string,object>} opties.productenOpId
 * @param {Record<string,boolean>} opties.houdbaar  categorie-id → houdbaar?
 * @param {Set<string>} [opties.voorraad]  product-ids die je al in huis hebt (kosten €0)
 */
export function berekenKosten(recepten, { personen, productenOpId, houdbaar, voorraad = new Set() }) {
  const nodig = benodigd(recepten, personen);
  const regels = [];
  let teBetalen = 0;
  let verspilling = 0;

  for (const [id, hoeveelheid] of nodig) {
    const product = productenOpId.get(id);
    if (!product) throw new Error(`Recept gebruikt onbekend product "${id}"`);
    const verpakking = leesInhoud(product.inhoud);
    if (!verpakking) throw new Error(`Inhoud van "${id}" is niet te lezen: "${product.inhoud}"`);

    const inHuis = voorraad.has(id);
    // Kleine marge, zodat 0,5 + 0,5 bloemkool niet als 1,0000001 → 2 bloemkolen telt.
    const pakken = inHuis ? 0 : Math.ceil(hoeveelheid / verpakking.hoeveelheid - 1e-6);
    const prijs = pakken * product.prijs;
    const over = inHuis ? 0 : pakken * verpakking.hoeveelheid - hoeveelheid;
    const isHoudbaar = Boolean(houdbaar[product.categorie]);
    const restWaarde = (over / verpakking.hoeveelheid) * product.prijs;

    teBetalen += prijs;
    if (!isHoudbaar) verspilling += restWaarde;
    regels.push({ product, nodig: hoeveelheid, eenheid: verpakking.eenheid, pakken, prijs, over, restWaarde, houdbaar: isHoudbaar, inHuis });
  }

  // Kosten per maaltijd: wat je van elk product daadwerkelijk gebruikt.
  const perMaaltijd = recepten.map((recept) => {
    const factor = personen / recept.personen;
    let kosten = 0;
    for (const ing of recept.ingredienten) {
      if (voorraad.has(ing.product)) continue;
      const product = productenOpId.get(ing.product);
      kosten += ((ing.hoeveelheid * factor) / leesInhoud(product.inhoud).hoeveelheid) * product.prijs;
    }
    return { recept, kosten, perPersoon: kosten / personen };
  });

  regels.sort((a, b) => a.product.categorie.localeCompare(b.product.categorie) || a.product.naam.localeCompare(b.product.naam));
  return { regels, perMaaltijd, teBetalen, verspilling };
}

/**
 * Snelle versie van berekenKosten voor tijdens het zoeken naar een menu: geeft alleen
 * het totaalbedrag en de verspilling, zonder alle details. Rekent precies hetzelfde.
 * @returns {(recepten: object[]) => {teBetalen: number, verspilling: number}}
 */
export function maakSnelleKosten({ personen, productenOpId, houdbaar, voorraad = new Set() }) {
  const info = new Map();
  const productInfo = (id) => {
    if (!info.has(id)) {
      const product = productenOpId.get(id);
      if (!product) throw new Error(`Recept gebruikt onbekend product "${id}"`);
      const pak = leesInhoud(product.inhoud);
      if (!pak) throw new Error(`Inhoud van "${id}" is niet te lezen: "${product.inhoud}"`);
      info.set(id, { pak: pak.hoeveelheid, prijs: product.prijs, houdbaar: Boolean(houdbaar[product.categorie]), inHuis: voorraad.has(id) });
    }
    return info.get(id);
  };
  return (recepten) => {
    const nodig = new Map();
    for (const recept of recepten) {
      const factor = personen / recept.personen;
      for (const ing of recept.ingredienten) nodig.set(ing.product, (nodig.get(ing.product) ?? 0) + ing.hoeveelheid * factor);
    }
    let teBetalen = 0;
    let verspilling = 0;
    for (const [id, hoeveelheid] of nodig) {
      const p = productInfo(id);
      if (p.inHuis) continue;
      const pakken = Math.ceil(hoeveelheid / p.pak - 1e-6);
      teBetalen += pakken * p.prijs;
      if (!p.houdbaar) verspilling += ((pakken * p.pak - hoeveelheid) / p.pak) * p.prijs;
    }
    return { teBetalen, verspilling };
  };
}

/**
 * Welke andere maaltijden in het menu gebruiken een vers product ook?
 * Handig om te laten zien: "gebruikt de rest van de bloemkool".
 * @returns {Map<string, string[]>}  product-id → namen van recepten (alleen gedeelde, verse producten)
 */
export function gedeeldeVerseProducten(recepten, productenOpId, houdbaar) {
  const gebruik = new Map();
  for (const recept of recepten) {
    for (const ing of recept.ingredienten) {
      const product = productenOpId.get(ing.product);
      if (!product || houdbaar[product.categorie]) continue;
      if (!gebruik.has(ing.product)) gebruik.set(ing.product, []);
      const namen = gebruik.get(ing.product);
      if (!namen.includes(recept.naam)) namen.push(recept.naam);
    }
  }
  return new Map([...gebruik].filter(([, namen]) => namen.length > 1));
}
