// Alternatieven voor een product dat in de winkel niet ligt.
// "Jumbo Verse Halfvolle Melk 1 L" is op → bijvoorbeeld "Jumbo Halfvolle Melk 1,5 L" of "Campina Halfvolle Melk 1 L".

import { normaliseer } from './zoeken.js';
import { leesInhoud } from '../planner/verpakking.js';

// Woorden die niets zeggen over wát het product is.
const RUIS = new Set([
  'jumbo', 's', 'g', 'gr', 'gram', 'kg', 'ml', 'cl', 'l', 'liter', 'stuk', 'stuks', 'x', 'ca', 'en', 'met', 'van', 'de', 'het', 'in', 'voor', 'half', 'heel',
  'xs', 'm', 'xl', 'xxl', 'naturel', 'biologisch', 'biologische', 'bio', 'voordeelverpakking', 'voordeelpak', 'knapperig', 'lekker', 'original', 'origineel',
]);

function kernwoorden(naam) {
  return normaliseer(naam)
    .split(' ')
    .filter((w) => w && !RUIS.has(w) && !/^[\d.,%+]+/.test(w));
}

/**
 * Zoekt de beste vervangers: zelfde afdeling, zelfde soort product (hoofdwoord),
 * zo veel mogelijk dezelfde woorden, een vergelijkbare verpakking en prijs.
 * @param {object} product  het product dat er niet ligt
 * @param {object[]} producten  alle producten
 * @param {{ aantal?: number, uitsluiten?: Set<string> }} [opties]
 * @returns {object[]}  hooguit `aantal` producten, de beste eerst
 */
export function zoekAlternatieven(product, producten, { aantal = 2, uitsluiten = new Set() } = {}) {
  const woorden = kernwoorden(product.naam);
  if (woorden.length === 0) return [];
  // Het soort product staat meestal voorop of achteraan: "Paprika Rood", "Halfvolle Melk".
  const soort = [woorden[0], woorden.at(-1)];
  const pak = leesInhoud(product.inhoud);

  const kandidaten = [];
  for (const p of producten) {
    if (p.id === product.id || p.verouderd || uitsluiten.has(p.id) || p.categorie !== product.categorie) continue;
    const andere = new Set(kernwoorden(p.naam));
    const gedeeld = woorden.filter((w) => andere.has(w)).length;
    if (gedeeld === 0) continue;
    const zelfdeSoort = soort.some((w) => andere.has(w));

    let score = gedeeld * 2 - (andere.size - gedeeld) * 0.5; // veel dezelfde woorden, weinig extra's
    if (zelfdeSoort) score += 4;
    const anderPak = leesInhoud(p.inhoud);
    if (pak && anderPak && pak.eenheid !== anderPak.eenheid) score -= 1.5; // los per stuk ↔ in een pot of zak
    if (pak && anderPak && pak.eenheid === anderPak.eenheid) {
      const verhouding = anderPak.hoeveelheid / pak.hoeveelheid;
      if (verhouding >= 0.66 && verhouding <= 1.5) score += 2; // ongeveer even groot
      else if (verhouding < 0.4 || verhouding > 2.5) score -= 2; // veel groter of kleiner
    }
    if (product.prijs > 0) score -= Math.min(3, Math.abs(p.prijs - product.prijs) / product.prijs) * 1.5; // vergelijkbare prijs
    kandidaten.push({ p, score, zelfdeSoort });
  }
  // Alleen echte vervangers: hetzelfde soort product, of veel woorden gemeen.
  return kandidaten
    .filter((k) => k.zelfdeSoort || k.score >= 3)
    .sort((a, b) => b.score - a.score || a.p.prijs - b.p.prijs)
    .slice(0, aantal)
    .map((k) => k.p);
}
