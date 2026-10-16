// Leest de inhoud van een verpakking ("1,5 L", "6x330 ml", "10 stuks") als getal + eenheid.
// Alles wordt omgerekend naar drie basiseenheden: g, ml en stuk.

const EENHEDEN = {
  g: ['g', 1], kg: ['g', 1000],
  ml: ['ml', 1], cl: ['ml', 10], l: ['ml', 1000],
  stuk: ['stuk', 1], stuks: ['stuk', 1], bos: ['stuk', 1], bollen: ['stuk', 1], bol: ['stuk', 1],
  bakje: ['stuk', 1], zakjes: ['stuk', 1], pak: ['stuk', 1], rollen: ['stuk', 1], m: ['m', 1],
};

/**
 * @param {string} inhoud  bijv. "500 g", "1,5 L", "6x330 ml", "3x5 stuks"
 * @returns {{hoeveelheid: number, eenheid: string} | null}  null als het niet te lezen is
 */
export function leesInhoud(inhoud) {
  const m = /^\s*(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*([a-z]+)\s*$/i.exec(inhoud ?? '');
  if (!m) return null;
  const [, keer, getal, woord] = m;
  const eenheid = EENHEDEN[woord.toLowerCase()];
  if (!eenheid) return null;
  const hoeveelheid = Number(getal.replace(',', '.')) * eenheid[1] * (keer ? Number(keer) : 1);
  return { hoeveelheid, eenheid: eenheid[0] };
}

/** Prijs per basiseenheid (per g, ml of stuk), of null als de inhoud onbekend is. */
export function prijsPerEenheid(product) {
  const v = leesInhoud(product.inhoud);
  return v && product.prijs ? product.prijs / v.hoeveelheid : null;
}

/** Hoe je een hoeveelheid leesbaar opschrijft: 1500 g → "1,5 kg", 0.5 stuk → "½". */
export function toonHoeveelheid(hoeveelheid, eenheid) {
  const nl = (n) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  if (eenheid === 'g') return hoeveelheid >= 1000 ? `${nl(hoeveelheid / 1000)} kg` : `${Math.round(hoeveelheid)} g`;
  if (eenheid === 'ml') return hoeveelheid >= 1000 ? `${nl(hoeveelheid / 1000)} L` : `${Math.round(hoeveelheid)} ml`;
  if (eenheid === 'stuk') {
    const breuken = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
    const heel = Math.floor(hoeveelheid + 1e-9);
    const rest = Math.round((hoeveelheid - heel) * 4) / 4;
    if (rest === 1) return `${heel + 1}`;
    if (breuken[rest]) return heel ? `${heel}${breuken[rest]}` : breuken[rest];
    return nl(hoeveelheid);
  }
  return `${nl(hoeveelheid)} ${eenheid}`;
}
