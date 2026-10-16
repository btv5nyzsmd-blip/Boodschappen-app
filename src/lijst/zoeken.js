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
  else if (woord.endsWith('s') && woord.length > 4) vormen.add(woord.slice(0, -1)); // appels → appel
  if (/[^aeious]$/.test(woord) && woord.length > 3) vormen.add(`${woord}s`); // appel → appels
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

const MAATWOORDEN = new Set(['g', 'gr', 'gram', 'kg', 'ml', 'cl', 'l', 'liter', 'stuk', 'stuks', 'x', 'ca', 'half', 'heel', 'rollen', 'zakjes']);

/** Het hoofdwoord van een productnaam: het laatste woord vóór de maat ("Jumbo Melk Brioches 10 Stuks" → "brioches"). */
function hoofdwoord(woorden) {
  for (let i = woorden.length - 1; i >= 0; i--) {
    const w = woorden[i];
    if (w && !/^[\d.,%+]+/.test(w) && !MAATWOORDEN.has(w)) return w;
  }
  return '';
}

// De doorzoekbare tekst per product wordt één keer berekend en onthouden;
// met 17.000 producten scheelt dat veel rekenwerk per toetsaanslag.
const cache = new WeakMap();
function zoektekst(product, categorieNaam) {
  let t = cache.get(product);
  if (!t) {
    const tekst = normaliseer([product.merk, product.naam, product.inhoud, categorieNaam, ...(product.zoekwoorden ?? [])].filter(Boolean).join(' '));
    const alleenNaam = normaliseer(product.naam);
    const naamWoorden = alleenNaam.split(' ');
    t = {
      tekst,
      woorden: tekst.split(' '),
      naamWoorden: new Set(naamWoorden),
      alleenNaam,
      hoofdwoord: hoofdwoord(naamWoorden),
      huismerk: alleenNaam.startsWith('jumbo'),
    };
    cache.set(product, t);
  }
  return t;
}

/** Bouwt de zoekindex alvast op (bijv. direct na het openen), zodat de eerste zoekopdracht snel is. */
export function bereidZoekenVoor(producten, categorieNamen = {}) {
  for (const p of producten) zoektekst(p, categorieNamen[p.categorie] ?? '');
}

/**
 * Zoekt producten waarin álle zoekwoorden voorkomen, het meest voor de hand liggende eerst.
 * Bij "appels" wil je appels uit de fruitafdeling, niet "Appelsientje"; daarom tellen mee:
 * - het zoekwoord als héél woord in de naam (zwaar), niet alleen als begin van een langer woord;
 * - de afdeling die bij het zoekwoord hoort (`verwachteAfdeling`, bijv. Fruit bij "appels");
 * - het huismerk Jumbo (meestal het basisproduct) en een korte naam.
 * @param {object[]} producten
 * @param {string} zoekopdracht
 * @param {Record<string,string>} [categorieNamen]  categorie-id → naam
 * @param {number} [max]
 * @param {{ verwachteAfdeling?: string|null }} [opties]
 */
export function zoekProducten(producten, zoekopdracht, categorieNamen = {}, max = 30, { verwachteAfdeling = null } = {}) {
  const woorden = normaliseer(zoekopdracht).split(' ').filter(Boolean);
  if (woorden.length === 0) return [];
  const vormen = woorden.map((w) => [...woordvormen(w)]);

  const treffers = [];
  for (const product of producten) {
    const t = zoektekst(product, categorieNamen[product.categorie] ?? '');
    if (!vormen.every((v) => v.some((w) => t.tekst.includes(w)))) continue;

    let score = 0;
    vormen.forEach((v, i) => {
      // precies het getypte woord telt iets zwaarder dan een woordvorm ervan ("appels" vóór "appel")
      if (t.naamWoorden.has(woorden[i])) score += 4.5; // heel woord in de naam: "Halfvolle Melk"
      else if (v.some((w) => t.naamWoorden.has(w))) score += 3.5;
      else if (t.woorden.some((lw) => v.includes(lw))) score += 2; // heel woord, maar niet in de naam (bijv. afdeling)
      else if ([...t.naamWoorden].some((nw) => v.some((w) => nw.startsWith(w)))) score += 1; // begin van een langer woord: "Melkunie"
    });
    // Het hoofdwoord staat in het Nederlands achteraan: "Volle Melk" is melk, "Melk Brioches" niet.
    if (woorden.includes(t.hoofdwoord)) score += 1.5;
    else if (vormen.some((v) => v.includes(t.hoofdwoord))) score += 0.75;
    if (verwachteAfdeling && product.categorie === verwachteAfdeling) score += 4;
    if (t.huismerk) score += 1.5;
    const alleenNaam = t.alleenNaam;
    // Hoe korter de naam, hoe preciezer de treffer: "Jumbo Bloemkool" vóór "Bakplaat Mix … Bloemkool & Kip".
    score -= alleenNaam.length / 25;
    if (product.verouderd) score -= 5;
    treffers.push({ product, score });
  }

  treffers.sort((a, b) => b.score - a.score || a.product.naam.localeCompare(b.product.naam) || a.product.prijs - b.product.prijs);
  return treffers.slice(0, max).map((t) => t.product);
}
