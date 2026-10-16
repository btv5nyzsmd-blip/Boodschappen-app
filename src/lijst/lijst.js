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

export function verwijderAfgevinkt(lijst) {
  return lijst.filter((r) => !r.afgevinkt);
}

/**
 * Koppelt de lijst aan de winkel en berekent de route.
 * @param {object} winkel
 * @param {{productId:string, aantal:number, afgevinkt:boolean}[]} lijst
 * @param {Map<string,object>} productenOpId
 * @returns {{ route: object|null, stops: {sectie: object, regels: object[]}[], nietGevonden: object[] }}
 *   Elke regel is { ...lijstregel, product }.
 */
export function routeVoorLijst(winkel, lijst, productenOpId, netwerk) {
  const regels = lijst
    .map((r) => ({ ...r, product: productenOpId.get(r.productId) }))
    .filter((r) => r.product);

  const { perSectie, nietGevonden } = sectiesVoorCategorieen(winkel, regels.map((r) => r.product.categorie));
  const sectieVanCategorie = new Map();
  for (const [sectieId, cats] of perSectie) for (const c of cats) sectieVanCategorie.set(c, sectieId);

  const regelsNietGevonden = regels.filter((r) => nietGevonden.includes(r.product.categorie));
  if (perSectie.size === 0) return { route: null, stops: [], nietGevonden: regelsNietGevonden };

  const route = berekenRoute(winkel, [...perSectie.keys()], netwerk);
  const stops = route.stops.map(({ sectie }) => ({
    sectie,
    regels: regels.filter((r) => sectieVanCategorie.get(r.product.categorie) === sectie.id),
  }));
  return { route, stops, nietGevonden: regelsNietGevonden };
}
