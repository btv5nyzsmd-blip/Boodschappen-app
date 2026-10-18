// Gedeelde aanbiedingen uit het Google Formulier (rijen met soort "aanbieding").
// De beheerder gaat voor: wat die invoert, geldt meteen. Een aanbieding van een gewone
// klant geldt pas als genoeg verschillende telefoons precies dezelfde aanbieding melden.
// Wordt gebruikt door scripts/meldingen-verwerken.mjs.

/** Datum uit de spreadsheet → 'JJJJ-MM-DD'. Google kan '2026-10-21', '21-10-2026' of '21/10/2026' teruggeven. */
export function leesDatum(tekst) {
  const t = String(tekst ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Prijs in centen (zo verstuurt de app hem: geen gedoe met komma's en punten) → euro's. */
export function leesCenten(tekst) {
  const t = String(tekst ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const centen = Number(t);
  return centen > 0 ? centen / 100 : null;
}

/** Eén rij uit de spreadsheet → aanbieding, of null als er iets niet klopt. */
export function leesAanbieding(rij, { prijzen, vandaag }) {
  const actiePrijs = leesCenten(rij.prijs);
  const geldigTot = leesDatum(rij.tot);
  const geldigVanaf = rij.vanaf ? leesDatum(rij.vanaf) : null;
  const normaal = prijzen.get(rij.product);
  if (!rij.apparaat || normaal === undefined || !actiePrijs || !geldigTot) return null;
  if (geldigTot < vandaag) return null; // al verlopen
  if (geldigVanaf && geldigVanaf > geldigTot) return null;
  const normalePrijs = leesCenten(rij.normaal) ?? normaal;
  if (actiePrijs >= normalePrijs) return null;
  return {
    productId: rij.product,
    normalePrijs,
    actiePrijs,
    ...(geldigVanaf ? { geldigVanaf } : {}),
    geldigTot,
    ...(rij.omschrijving ? { omschrijving: String(rij.omschrijving).slice(0, 60) } : {}),
  };
}

const sleutel = (a) => `${a.productId}|${a.actiePrijs}|${a.geldigTot}`;

/**
 * @param {object[]} rijen  alle rijen uit de spreadsheet, in volgorde van binnenkomst
 * @param {{ prijzen: Map<string, number>, beheerders: Set<string>, minimum: number, vandaag: string }} opties
 *   prijzen: product-id → normale prijs; minimum: aantal telefoons voor een klant-aanbieding
 * @returns {{ aanbiedingen: object[], open: object[] }}  open = nog niet genoeg telefoons (anderen kunnen bevestigen)
 */
export function telAanbiedingen(rijen, { prijzen, beheerders, minimum, vandaag }) {
  const vanBeheerder = new Map(); // product → laatste aanbieding van de beheerder
  const groepen = new Map(); // sleutel → { aanbieding, telefoons }
  for (const rij of rijen) {
    if (rij.soort !== 'aanbieding') continue;
    const a = leesAanbieding(rij, { prijzen, vandaag });
    if (!a) continue;
    if (beheerders.has(rij.apparaat)) {
      vanBeheerder.set(a.productId, { ...a, door: 'beheerder' });
      continue;
    }
    const k = sleutel(a);
    if (!groepen.has(k)) groepen.set(k, { aanbieding: a, telefoons: new Set() });
    const g = groepen.get(k);
    g.telefoons.add(rij.apparaat);
    g.aanbieding = { ...g.aanbieding, ...a }; // laatste omschrijving telt
  }

  const aanbiedingen = [...vanBeheerder.values()];
  const open = [];
  const perProduct = new Map();
  for (const { aanbieding, telefoons } of groepen.values()) {
    if (vanBeheerder.has(aanbieding.productId)) continue; // de beheerder gaat voor
    const regel = { ...aanbieding, door: 'klanten', telefoons: telefoons.size };
    if (telefoons.size < minimum) open.push(regel);
    else {
      // Meerdere bevestigde versies van hetzelfde product: de meest gemelde (dan de goedkoopste) wint.
      const huidig = perProduct.get(aanbieding.productId);
      if (!huidig || regel.telefoons > huidig.telefoons || (regel.telefoons === huidig.telefoons && regel.actiePrijs < huidig.actiePrijs))
        perProduct.set(aanbieding.productId, regel);
    }
  }
  aanbiedingen.push(...perProduct.values());
  const opNaam = (a, b) => a.productId.localeCompare(b.productId);
  return {
    aanbiedingen: aanbiedingen.sort(opNaam),
    open: open.filter((o) => !perProduct.has(o.productId)).sort(opNaam),
  };
}
