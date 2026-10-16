// Aanbiedingen: een losse module met verwisselbare bronnen.
//
// Een bron is een object { naam, laad() } waarbij laad() een lijst aanbiedingen
// teruggeeft (direct of als Promise). Een aanbieding ziet er zo uit:
//
//   { productId, normalePrijs, actiePrijs, geldigTot: '2026-10-20',
//     geldigVanaf?: '2026-10-14', omschrijving?: '1+1 gratis' }
//
// Nu zijn er twee bronnen: het bestand data/aanbiedingen.json en wat je zelf in de
// app invoert. Een nieuwe databron aansluiten = een nieuw bestand met zo'n object
// maken en het toevoegen aan de lijst bronnen in main.js. De rest van de app merkt
// daar niets van.

/** Vandaag als 'JJJJ-MM-DD' in de tijdzone van de telefoon. */
export function vandaag(datum = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${datum.getFullYear()}-${p(datum.getMonth() + 1)}-${p(datum.getDate())}`;
}

/** Is de aanbieding geldig? Fouten in de invoer (geen prijs, geen datum) tellen als ongeldig. */
export function isGeldig(a) {
  return (
    a &&
    typeof a.productId === 'string' &&
    a.actiePrijs > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(a.geldigTot ?? '') &&
    (a.geldigVanaf === undefined || /^\d{4}-\d{2}-\d{2}$/.test(a.geldigVanaf))
  );
}

/** Loopt de aanbieding op deze datum? Begin- en einddatum tellen allebei mee. */
export function isActueel(a, dag = vandaag()) {
  return isGeldig(a) && a.geldigTot >= dag && (!a.geldigVanaf || a.geldigVanaf <= dag);
}

/**
 * Laadt alle bronnen. Werkt een bron niet (bijv. geen internet), dan gaan de andere gewoon door.
 * @returns {Promise<{ aanbiedingen: object[], fouten: string[] }>}
 */
export async function laadAanbiedingen(bronnen) {
  const resultaten = await Promise.allSettled(bronnen.map(async (b) => ({ bron: b.naam, lijst: await b.laad() })));
  const aanbiedingen = [];
  const fouten = [];
  resultaten.forEach((r, i) => {
    if (r.status === 'rejected') {
      fouten.push(`${bronnen[i].naam}: ${r.reason?.message ?? r.reason}`);
      return;
    }
    for (const a of r.value.lijst ?? []) if (isGeldig(a)) aanbiedingen.push({ ...a, bron: r.value.bron });
  });
  return { aanbiedingen, fouten };
}

/**
 * De aanbiedingen die vandaag lopen, één per product (de goedkoopste wint).
 * @returns {Map<string, object>}  product-id → aanbieding
 */
export function actueleAanbiedingen(aanbiedingen, dag = vandaag()) {
  const perProduct = new Map();
  for (const a of aanbiedingen) {
    if (!isActueel(a, dag)) continue;
    const huidig = perProduct.get(a.productId);
    if (!huidig || a.actiePrijs < huidig.actiePrijs) perProduct.set(a.productId, a);
  }
  return perProduct;
}

/**
 * Zet de actieprijs op de producten die in de aanbieding zijn. Het product houdt zijn
 * normale prijs in `normalePrijs` en krijgt de aanbieding erbij in `aanbieding`.
 * Lijst, budget en weekmenu rekenen daardoor vanzelf met de actieprijs.
 */
export function pasToe(producten, actueel) {
  if (actueel.size === 0) return producten;
  return producten.map((p) => {
    const a = actueel.get(p.id);
    if (!a || a.actiePrijs >= p.prijs) return p;
    return { ...p, prijs: a.actiePrijs, normalePrijs: a.normalePrijs ?? p.prijs, aanbieding: a };
  });
}

/** Hoeveel bespaar je op dit product per verpakking? */
export function korting(product) {
  return product.aanbieding ? Math.max(0, product.normalePrijs - product.prijs) : 0;
}
