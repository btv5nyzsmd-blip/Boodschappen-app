// Haalt actuele Jumbo-producten en -prijzen op uit de open data van Checkjebon.nl
// (https://github.com/supermarkt/checkjebon, MIT-licentie) en zet ze om naar
// data/producten.json. Wij scrapen zelf niets: Checkjebon publiceert deze gegevens
// dagelijks en staat hergebruik toe.
//
// Gebruik:  npm run prijzen
//           node scripts/prijzen-bijwerken.mjs [pad-of-url-naar-supermarkets.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { bepaalCategorie, leesInhoudUitNaam } from '../src/data/import.js';

const BRON = 'https://raw.githubusercontent.com/supermarkt/checkjebon/main/data/supermarkets.json';
const SUPERMARKT = 'jumbo';
const pad = (bestand) => new URL(`../data/${bestand}`, import.meta.url);
const leesJson = (bestand) => JSON.parse(readFileSync(pad(bestand), 'utf8'));

async function laadBron(adres) {
  if (/^https?:/.test(adres)) {
    const antwoord = await fetch(adres);
    if (!antwoord.ok) throw new Error(`Downloaden mislukt (${antwoord.status}): ${adres}`);
    return antwoord.json();
  }
  return JSON.parse(readFileSync(adres, 'utf8'));
}

const adres = process.argv[2] ?? BRON;
const supermarkten = await laadBron(adres);
const winkel = supermarkten.find((s) => s.n === SUPERMARKT);
if (!winkel?.d?.length) throw new Error(`Geen producten van "${SUPERMARKT}" gevonden in ${adres}`);

const { regels } = leesJson('categorie-regels.json');
const uitzonderingen = leesJson('categorie-uitzonderingen.json').producten;
const categorieIds = new Set(leesJson('categorieen.json').map((c) => c.id));
for (const r of regels) if (!categorieIds.has(r.categorie)) throw new Error(`Onbekende categorie in categorie-regels.json: ${r.categorie}`);

const producten = new Map();
for (const item of winkel.d) {
  if (!item.n || !item.l || !(item.p > 0)) continue;
  const id = item.l.toLowerCase();
  if (producten.has(id)) continue;
  // Kapotte tekens (U+FFFD) uit de bron opruimen, bijv. "Nestl?" wordt "Nestlé".
  const naam = item.n.replace(/Nestl\uFFFD/g, 'Nestlé').replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim();
  producten.set(id, {
    id,
    naam,
    inhoud: leesInhoudUitNaam(naam, item.s),
    categorie: uitzonderingen[id] ?? bepaalCategorie(naam, regels),
    prijs: Math.round(item.p * 100) / 100,
  });
}

// Producten die in een recept staan maar (tijdelijk) niet meer in de bron: oude versie bewaren.
const vorige = new Map(leesJson('producten.json').map((p) => [p.id, p]));
const nodigVoorRecepten = new Set(leesJson('recepten.json').flatMap((r) => r.ingredienten.map((i) => i.product)));
const verdwenen = [];
for (const id of nodigVoorRecepten) {
  if (!producten.has(id) && vorige.has(id)) {
    producten.set(id, { ...vorige.get(id), verouderd: true });
    verdwenen.push(id);
  }
}

const lijst = [...producten.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
const regel = (p) =>
  '  ' + JSON.stringify(p).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }');
writeFileSync(pad('producten.json'), '[\n' + lijst.map(regel).join(',\n') + '\n]\n');

const zonderAfdeling = lijst.filter((p) => !p.categorie).length;
const bron = {
  bron: 'Checkjebon.nl open data (MIT-licentie)',
  url: 'https://github.com/supermarkt/checkjebon',
  supermarkt: SUPERMARKT,
  bijgewerkt: new Date().toISOString().slice(0, 10),
  aantal: lijst.length,
  zonderAfdeling,
};
writeFileSync(pad('bron.json'), JSON.stringify(bron, null, 2) + '\n');

console.log(`${lijst.length} producten opgeslagen, ${zonderAfdeling} zonder afdeling (${((100 * zonderAfdeling) / lijst.length).toFixed(1)}%).`);
if (verdwenen.length) console.warn(`Let op: ${verdwenen.length} receptproducten zitten niet meer in de bron en houden hun oude prijs:\n  ${verdwenen.join('\n  ')}`);
