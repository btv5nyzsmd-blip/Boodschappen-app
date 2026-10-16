// "Altijd in huis": basisproducten die je standaard in de kast hebt (olie, peper, kruiden…).
// Ze tellen nooit mee in je boodschappen of budget. Daarnaast is er "Heb ik nog": producten
// die je alléén deze week nog hebt (bijv. rijst van vorige week).

/** Afdelingen waaruit je iets "altijd in huis" kunt hebben, in deze volgorde getoond. */
export const VOORRAAD_AFDELINGEN = ['kruiden', 'olie-azijn', 'sauzen', 'wereldkeuken', 'soep', 'bakken', 'boter', 'conserven', 'aardappelen', 'rijst', 'pasta', 'eieren'];

/** Wat de meeste mensen in huis hebben en waarvan een recept maar een klein beetje gebruikt. */
export const STANDAARD_NAMEN = [
  'olijfolie', 'zwarte peper', 'Italiaanse kruiden', 'paprikapoeder', 'kerriepoeder', 'komijn', 'kaneel',
  'bloem', 'bouillonblokjes', 'sojasaus', 'ketjap', 'mosterd', 'ketchup', 'mayonaise',
];

/**
 * Producten uit de recepten die je "altijd in huis" kunt hebben, met hun korte naam.
 * @returns {{ productId: string, naam: string, categorie: string }[]}  gesorteerd per afdeling en naam
 */
export function voorraadKandidaten(recepten, productenOpId) {
  const perProduct = new Map();
  for (const recept of recepten) {
    for (const ing of recept.ingredienten) {
      const product = productenOpId.get(ing.product);
      if (!product || !VOORRAAD_AFDELINGEN.includes(product.categorie)) continue;
      const naam = ing.naam ?? product.naam;
      const huidig = perProduct.get(ing.product);
      // De kortste naam is meestal de duidelijkste ("maïs" i.p.v. "mais").
      if (!huidig || naam.length < huidig.naam.length) perProduct.set(ing.product, { productId: ing.product, naam, categorie: product.categorie });
    }
  }
  return [...perProduct.values()].sort(
    (a, b) => VOORRAAD_AFDELINGEN.indexOf(a.categorie) - VOORRAAD_AFDELINGEN.indexOf(b.categorie) || a.naam.localeCompare(b.naam, 'nl'),
  );
}

/** De product-ids die standaard "altijd in huis" zijn. */
export function standaardBasis(kandidaten) {
  return kandidaten.filter((k) => STANDAARD_NAMEN.includes(k.naam)).map((k) => k.productId);
}
