// Verwerkt de meldingen "ligt ergens anders" uit het Google Formulier (via de gepubliceerde CSV
// van de gekoppelde spreadsheet). Genoeg verschillende telefoons eens? Dan komt het product in
// data/categorie-uitzonderingen.json en verhuist het bij de volgende `npm run prijzen`.
// Producten met te weinig meldingen gaan naar data/meldingen-open.json: de app vraagt andere
// klanten dan na het afvinken waar zij het vonden.
// Gedeelde aanbiedingen (soort "aanbieding") gaan naar data/aanbiedingen-gedeeld.json.
//
// Gebruik:  npm run meldingen
//           node scripts/meldingen-verwerken.mjs [pad-of-url-naar-csv]

import { readFileSync, writeFileSync } from 'node:fs';
import { leesCsv, telMeldingen } from '../src/meldingen/tellen.js';
import { bepaalCategorie } from '../src/data/import.js';
import { telAanbiedingen } from '../src/aanbiedingen/tellen.js';

const pad = (bestand) => new URL(`../data/${bestand}`, import.meta.url);
const leesJson = (bestand) => JSON.parse(readFileSync(pad(bestand), 'utf8'));

const instellingen = leesJson('meldingen.json');
const adres = process.argv[2] ?? instellingen.csv;
if (!adres) {
  console.log('Meldingen nog niet ingesteld (geen "csv" in data/meldingen.json); niets te doen.');
  process.exit(0);
}

let tekst;
if (/^https?:/.test(adres)) {
  const antwoord = await fetch(adres);
  if (!antwoord.ok) throw new Error(`Meldingen downloaden mislukt (${antwoord.status})`);
  tekst = await antwoord.text();
} else tekst = readFileSync(adres, 'utf8');

const meldingen = leesCsv(tekst);
const producten = leesJson('producten.json');
const huidig = new Map(producten.map((p) => [p.id, p.categorie]));
const categorieIds = new Set(leesJson('categorieen.json').map((c) => c.id));
const { verplaatsen, open } = telMeldingen(meldingen, { huidig, categorieIds, drempel: instellingen.drempel });

const bestand = leesJson('categorie-uitzonderingen.json');
const { regels } = leesJson('categorie-regels.json');
const naam = new Map(producten.map((p) => [p.id, p.naam]));
for (const v of verplaatsen) {
  // Komt het product zo weer op de plek van de automatische regels, dan is geen uitzondering nodig.
  if (bepaalCategorie(naam.get(v.product), regels) === v.naar) delete bestand.producten[v.product];
  else bestand.producten[v.product] = v.naar;
  console.log(`Verplaatst: ${naam.get(v.product)}: ${v.van} → ${v.naar} (${v.stemmen} telefoons, ${v.tegen} tegen)`);
}
writeFileSync(pad('categorie-uitzonderingen.json'), JSON.stringify(bestand, null, 2) + '\n');

const openLijst = open.map(({ product, naar }) => ({ product, naar })).sort((a, b) => a.product.localeCompare(b.product));
writeFileSync(pad('meldingen-open.json'), JSON.stringify(openLijst, null, 2) + '\n');

// Aanbiedingen: de beheerder gaat voor, klanten tellen vanaf `aanbiedingMinimum` telefoons.
const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // JJJJ-MM-DD
const acties = telAanbiedingen(meldingen, {
  prijzen: new Map(producten.map((p) => [p.id, p.prijs])),
  beheerders: new Set(instellingen.beheerders ?? []),
  minimum: instellingen.aanbiedingMinimum ?? 2,
  vandaag,
});
writeFileSync(pad('aanbiedingen-gedeeld.json'), JSON.stringify(acties, null, 2) + '\n');
console.log(`Aanbiedingen: ${acties.aanbiedingen.length} geldig, ${acties.open.length} wachten op bevestiging.`);

console.log(`${meldingen.length} meldingen gelezen: ${verplaatsen.length} producten verplaatst, ${open.length} wachten op meer meldingen (drempel ${instellingen.drempel}).`);
