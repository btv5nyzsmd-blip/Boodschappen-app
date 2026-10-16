// Hulpfuncties voor het importeren van productgegevens (zie scripts/prijzen-bijwerken.mjs).
import { normaliseer } from '../lijst/zoeken.js';

/**
 * Bepaalt de afdeling van een product aan de hand van data/categorie-regels.json.
 * De eerste regel waarvan een woord in de naam staat, wint. Geen match: null.
 */
export function bepaalCategorie(naam, regels) {
  const tekst = ` ${normaliseer(naam).replace(/[%,.]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const regel of regels) {
    if (regel.woorden.some((w) => tekst.includes(w))) return regel.categorie;
  }
  return null;
}

const EENHEID = {
  kg: 'kg', kilo: 'kg', g: 'g', gr: 'g', gram: 'g',
  l: 'L', liter: 'L', ltr: 'L', ml: 'ml', cl: 'cl',
  stuk: 'stuks', stuks: 'stuks', st: 'stuks', rollen: 'rollen', rol: 'rollen', zakjes: 'zakjes',
  pads: 'stuks', capsules: 'stuks', cups: 'stuks', tabletten: 'stuks', blokjes: 'stuks', plakjes: 'stuks', x: 'stuks',
};
const GETAL = String.raw`(\d+(?:[.,]\d+)?)`;
const WOORD = String.raw`(kg|kilo|gram|gr|g|liter|ltr|ml|cl|l|stuks|stuk|st|rollen|rol|zakjes|pads|capsules|cups|tabletten|blokjes|plakjes)`;
const MEERVOUD = new RegExp(String.raw`(\d+)\s*x\s*${GETAL}\s*${WOORD}\b`, 'gi'); //  6 x 1,5 L
const MEERVOUD_ACHTER = new RegExp(String.raw`${GETAL}\s*${WOORD}\s*x\s*(\d+)\b`, 'gi'); //  250 ML x 6
const ENKEL = new RegExp(String.raw`${GETAL}\s*-?\s*${WOORD}\b`, 'gi'); //  500 g, 4-rollen

const getal = (s) => s.replace('.', ',').replace(/,0+$/, '');

/**
 * Haalt de inhoud uit een productnaam ("Coca-Cola Zero 1,5 L" → "1,5 L").
 * Lukt dat niet, dan wordt het opgegeven formaat gebruikt, en anders "1 stuk"
 * (losse groente zoals een bloemkool heeft geen gewicht in de naam).
 */
export function leesInhoudUitNaam(naam, formaat = '') {
  for (const bron of [naam, formaat]) {
    const tekst = (bron ?? '').replace(/(\d)\s*,\s*(\d)/g, '$1,$2');
    let m = [...tekst.matchAll(MEERVOUD)].at(-1);
    if (m) return `${m[1]}x${getal(m[2])} ${EENHEID[m[3].toLowerCase()]}`;
    m = [...tekst.matchAll(MEERVOUD_ACHTER)].at(-1);
    if (m) return `${m[3]}x${getal(m[1])} ${EENHEID[m[2].toLowerCase()]}`;
    m = [...tekst.matchAll(ENKEL)].at(-1);
    if (m) {
      const eenheid = EENHEID[m[2].toLowerCase()];
      const aantal = getal(m[1]);
      return `${aantal} ${eenheid === 'stuks' && aantal === '1' ? 'stuk' : eenheid}`;
    }
  }
  return '1 stuk';
}
