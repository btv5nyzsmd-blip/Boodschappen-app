// Telt de meldingen "ligt ergens anders" (zoals bij Flitsmeister): pas als genoeg
// verschillende telefoons hetzelfde zeggen, verhuist een product naar een andere afdeling.
// Wordt gebruikt door scripts/meldingen-verwerken.mjs (elke ochtend via GitHub).

/** Leest CSV (zoals Google Spreadsheets die publiceert) als lijst objecten, met de kolomkoppen als sleutels. */
export function leesCsv(tekst) {
  const rijen = [];
  let rij = [];
  let veld = '';
  let tussenAanhalingstekens = false;
  for (let i = 0; i < tekst.length; i++) {
    const t = tekst[i];
    if (tussenAanhalingstekens) {
      if (t === '"' && tekst[i + 1] === '"') veld += '"', i++;
      else if (t === '"') tussenAanhalingstekens = false;
      else veld += t;
    } else if (t === '"') tussenAanhalingstekens = true;
    else if (t === ',') rij.push(veld), (veld = '');
    else if (t === '\n' || t === '\r') {
      if (t === '\r' && tekst[i + 1] === '\n') i++;
      rij.push(veld), rijen.push(rij), (rij = []), (veld = '');
    } else veld += t;
  }
  if (veld || rij.length) rij.push(veld), rijen.push(rij);
  const [kop = [], ...data] = rijen.filter((r) => r.some((v) => v.trim()));
  const sleutels = kop.map((k) => k.trim().toLowerCase());
  return data.map((r) => Object.fromEntries(sleutels.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/**
 * Bepaalt welke producten verhuizen.
 * Elke telefoon telt één keer per product (zijn laatste melding telt). Een product verhuist als
 * minstens `drempel` telefoons dezelfde nieuwe afdeling noemen én dat er meer zijn dan
 * telefoons die zeggen dat het op de huidige plek ligt.
 * @param {{apparaat: string, product: string, afdeling: string}[]} meldingen  in volgorde van binnenkomst
 * @param {{ huidig: Map<string,string>, categorieIds: Set<string>, drempel: number }} opties
 *   huidig: product-id → afdeling waar de app het nu laat zien
 * @returns {{ verplaatsen: object[], open: object[] }}  open = nog niet genoeg stemmen (andere klanten vragen)
 */
export function telMeldingen(meldingen, { huidig, categorieIds, drempel }) {
  const perProduct = new Map(); // product → (apparaat → afdeling)
  for (const m of meldingen) {
    if (!m.apparaat || !huidig.has(m.product) || !categorieIds.has(m.afdeling)) continue; // onzin of onbekend
    if (!perProduct.has(m.product)) perProduct.set(m.product, new Map());
    perProduct.get(m.product).set(m.apparaat, m.afdeling);
  }

  const verplaatsen = [];
  const open = [];
  for (const [product, stemmen] of perProduct) {
    const telling = new Map();
    for (const afdeling of stemmen.values()) telling.set(afdeling, (telling.get(afdeling) ?? 0) + 1);
    const nu = huidig.get(product);
    const tegen = telling.get(nu) ?? 0;
    const [naar, aantal] =
      [...telling].filter(([a]) => a !== nu).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0] ?? [];
    if (!naar) continue; // iedereen bevestigt de huidige plek
    const regel = { product, van: nu, naar, stemmen: aantal, tegen };
    if (aantal >= drempel && aantal > tegen) verplaatsen.push(regel);
    else open.push(regel);
  }
  return { verplaatsen, open };
}
