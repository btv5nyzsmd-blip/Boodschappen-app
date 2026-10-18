// Bewerkingen op de boodschappenlijst. Deze functies veranderen de lijst niet,
// maar geven een nieuwe lijst terug (makkelijker te testen en te bewaren).

import { sectiesVoorCategorieen, berekenRoute } from '../route/route.js';

export function voegToe(lijst, productId, aantal = 1) {
  const bestaand = lijst.find((r) => r.productId === productId);
  if (bestaand) return lijst.map((r) => (r === bestaand ? { ...r, aantal: r.aantal + aantal, afgevinkt: false } : r));
  return [...lijst, { productId, aantal, afgevinkt: false }];
}

export function wijzigAantal(lijst, productId, verschil) {
  return lijst
    .map((r) => (r.productId === productId ? { ...r, aantal: r.aantal + verschil } : r))
    .filter((r) => r.aantal > 0);
}

export function verwijder(lijst, productId) {
  return lijst.filter((r) => r.productId !== productId);
}

export function wisselAfgevinkt(lijst, productId) {
  return lijst.map((r) => (r.productId === productId ? { ...r, afgevinkt: !r.afgevinkt } : r));
}

/**
 * "Niet gevonden": het product gaat uit de route, maar blijft op je lijst.
 * Nog een keer drukken zet het terug in de route.
 */
export function wisselOvergeslagen(lijst, productId) {
  return lijst.map((r) => (r.productId === productId ? { ...r, overgeslagen: !r.overgeslagen, afgevinkt: false } : r));
}

/**
 * Vervangt een product dat er niet lag door een alternatief, met hetzelfde aantal.
 * Staat het alternatief al op de lijst, dan worden de aantallen opgeteld.
 */
export function vervangProduct(lijst, oudId, nieuwId) {
  const oud = lijst.find((r) => r.productId === oudId);
  if (!oud) return lijst;
  const zonder = lijst.filter((r) => r !== oud);
  if (zonder.some((r) => r.productId === nieuwId)) {
    return zonder.map((r) => (r.productId === nieuwId ? { ...r, aantal: r.aantal + oud.aantal, afgevinkt: false, overgeslagen: false } : r));
  }
  return lijst.map((r) => (r === oud ? { productId: nieuwId, aantal: oud.aantal, afgevinkt: false } : r));
}

/** Klaar met boodschappen: afgevinkte producten eraf; wat je niet vond blijft staan voor de volgende keer. */
export function verwijderAfgevinkt(lijst) {
  return lijst.filter((r) => !r.afgevinkt).map(({ overgeslagen, ...r }) => r);
}

/** In welke sectie van de winkel ligt dit product? (sectie-id of null) */
export function sectieVanProduct(winkel, product) {
  return winkel.secties.find((s) => s.categorieen.includes(product?.categorie))?.id ?? null;
}

/**
 * Koppelt de lijst aan de winkel en berekent de route voor wat je nog moet pakken.
 *
 * De route begint bij `positie` (de plek waar je het laatst iets afvinkte) of bij
 * de ingang. Zo wordt de route vanzelf opnieuw berekend als je iets in een andere
 * volgorde pakt of onderweg iets aan je lijst toevoegt.
 *
 * @param {object} winkel
 * @param {{productId:string, aantal:number, afgevinkt:boolean}[]} lijst
 * @param {Map<string,object>} productenOpId
 * @param {object} [netwerk]
 * @param {string|null} [positie]  sectie-id waar je nu staat
 * @returns {{ route: object|null, vanaf: object|null, stops: {sectie: object, regels: object[]}[], inKar: object[],
 *   nietGevonden: object[], overgeslagen: object[] }}
 *   nietGevonden = producten zonder afdeling; overgeslagen = producten die je in de winkel niet kon vinden.
 *   Elke regel is { ...lijstregel, product }. Stops bevatten de nog te pakken producten,
 *   plus wat je in diezelfde sectie al hebt afgevinkt.
 */
export function routeVoorLijst(winkel, lijst, productenOpId, netwerk, positie = null, opties = {}) {
  const regels = lijst
    .map((r) => ({ ...r, product: productenOpId.get(r.productId) }))
    .filter((r) => r.product);
  const overgeslagen = regels.filter((r) => r.overgeslagen);
  const nogTeDoen = regels.filter((r) => !r.afgevinkt && !r.overgeslagen);

  const { perSectie, nietGevonden } = sectiesVoorCategorieen(winkel, nogTeDoen.map((r) => r.product.categorie));
  const sectieVan = (r) => sectieVanProduct(winkel, r.product);

  const vanaf = winkel.secties.find((s) => s.id === positie) ?? null;
  const regelsNietGevonden = regels.filter((r) => nietGevonden.includes(r.product.categorie) || (r.afgevinkt && !sectieVan(r)));

  const route = perSectie.size > 0 || vanaf ? berekenRoute(winkel, [...perSectie.keys()], netwerk, vanaf ? vanaf.id : 'ingang', opties) : null;
  const stops = (route?.stops ?? []).map(({ sectie }) => ({
    sectie,
    regels: regels.filter((r) => sectieVan(r) === sectie.id && !r.overgeslagen),
  }));
  const inStop = new Set(stops.flatMap((s) => s.regels));
  const inKar = regels.filter((r) => r.afgevinkt && !inStop.has(r) && sectieVan(r));

  return { route, vanaf, stops, inKar, nietGevonden: regelsNietGevonden.filter((r) => !r.overgeslagen), overgeslagen };
}
