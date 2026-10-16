// Zoeken in de productcatalogus.
// "cola zero" vindt "Coca-Cola Zero sugar 1,5 L" en "Jumbo Cola zero 1,5 L".

/** Kleine letters, zonder accenten (crème → creme). */
export function normaliseer(tekst) {
  return tekst
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%,.]+/g, ' ')
    .trim();
}

const KLINKERS = 'aeiou';
const isMedeklinker = (c) => c && !KLINKERS.includes(c);

/**
 * Nederlandse woordvormen, zodat "rode paprika" ook "Paprika Rood" vindt:
 * rode ↔ rood, gele ↔ geel, witte ↔ wit, verse ↔ vers, tomaten ↔ tomaat, uien ↔ ui.
 */
export function woordvormen(woord) {
  const vormen = new Set([woord]);
  if (woord.length < 3) return vormen;
  const terug = (stam) => {
    // stam zonder uitgang terug naar de basisvorm: "rod" → "rood", "witt" → "wit"
    if (stam.length >= 2 && stam.at(-1) === stam.at(-2) && isMedeklinker(stam.at(-1))) vormen.add(stam.slice(0, -1));
    else if (stam.length >= 3 && isMedeklinker(stam.at(-1)) && KLINKERS.includes(stam.at(-2)) && isMedeklinker(stam.at(-3)))
      vormen.add(stam.slice(0, -1) + stam.at(-2) + stam.at(-1));
    vormen.add(stam);
  };
  if (woord.endsWith('en') && woord.length > 4) terug(woord.slice(0, -2)); // tomaten → tomaat, uien → ui
  else if (woord.endsWith('e') && woord.length > 3) terug(woord.slice(0, -1)); // rode → rood, verse → vers
  // en andersom: rood → rode, tomaat → tomaten, wit → witte
  const m = /^(.*[^aeiou])([aeiou])\2([^aeiou])$/.exec(woord);
  if (m) {
    vormen.add(`${m[1]}${m[2]}${m[3]}e`);
    vormen.add(`${m[1]}${m[2]}${m[3]}en`);
  } else if (isMedeklinker(woord.at(-1))) {
    vormen.add(`${woord}e`);
    if (KLINKERS.includes(woord.at(-2)) && isMedeklinker(woord.at(-3))) vormen.add(`${woord}${woord.at(-1)}e`);
  }
  return vormen;
}

// De doorzoekbare tekst per product wordt één keer berekend en onthouden;
// met 17.000 producten scheelt dat veel rekenwerk per toetsaanslag.
const cache = new WeakMap();
function zoektekst(product, categorieNaam) {
  let t = cache.get(product);
  if (!t) {
    const tekst = normaliseer([product.merk, product.naam, product.inhoud, categorieNaam, ...(product.zoekwoorden ?? [])].filter(Boolean).join(' '));
    t = { tekst, woorden: tekst.split(' '), naam: normaliseer(`${product.merk ?? ''} ${product.naam}`), alleenNaam: normaliseer(product.naam) };
    cache.set(product, t);
  }
  return t;
}

/** Bouwt de zoekindex alvast op (bijv. direct na het openen), zodat de eerste zoekopdracht snel is. */
export function bereidZoekenVoor(producten, categorieNamen = {}) {
  for (const p of producten) zoektekst(p, categorieNamen[p.categorie] ?? '');
}

/**
 * Zoekt producten waarin álle zoekwoorden voorkomen.
 * Producten waarvan de naam met het zoekwoord begint komen bovenaan.
 * @param {object[]} producten
 * @param {string} zoekopdracht
 * @param {Record<string,string>} [categorieNamen]  categorie-id → naam
 * @param {number} [max]
 */
export function zoekProducten(producten, zoekopdracht, categorieNamen = {}, max = 30) {
  const woorden = normaliseer(zoekopdracht).split(' ').filter(Boolean);
  if (woorden.length === 0) return [];
  const vormen = woorden.map((w) => [...woordvormen(w)]);

  const treffers = [];
  for (const product of producten) {
    const { tekst, woorden: losseWoorden, naam, alleenNaam } = zoektekst(product, categorieNamen[product.categorie] ?? '');
    if (!vormen.every((v) => v.some((w) => tekst.includes(w)))) continue;

    let score = 0;
    for (const v of vormen) {
      if (losseWoorden.some((lw) => v.includes(lw))) score += 3; // heel woord
      else if (losseWoorden.some((lw) => v.some((w) => lw.startsWith(w)))) score += 2; // begin van een woord
      if (v.some((w) => naam.includes(w))) score += 2; // in merk of productnaam, niet alleen in een zoekwoord
    }
    if (alleenNaam.startsWith(woorden[0])) score += 2;
    // Hoe korter de naam, hoe preciezer de treffer: "Jumbo Bloemkool" vóór "Bakplaat Mix … Bloemkool & Kip".
    score -= alleenNaam.length / 25;
    if (product.verouderd) score -= 5;
    treffers.push({ product, score });
  }

  treffers.sort((a, b) => b.score - a.score || a.product.naam.localeCompare(b.product.naam) || a.product.prijs - b.product.prijs);
  return treffers.slice(0, max).map((t) => t.product);
}
