// Stelt een weekmenu samen.
//
// Elke mogelijke combinatie van maaltijden krijgt strafpunten (lager = beter):
// - boven budget: zwaar bestraft, zodat het menu er altijd onder blijft als het kan;
// - verspilling: de waarde van verse restjes die niemand opmaakt;
// - te vaak hetzelfde (drie keer kip in één week);
// - een klein beetje voor de totale prijs.
// Recepten die bij je voorkeuren passen krijgen juist pluspunten.
// Met een "toevalsgetal" (seed) krijg je bij "Nieuwe suggestie" een ander, even goed menu.

import { berekenKosten, maakSnelleKosten } from './kosten.js';
import { normaliseer } from '../lijst/zoeken.js';

export const UITSLUITINGEN = [
  { id: 'vlees', naam: 'Geen vlees', bevat: ['varken', 'rund', 'kip'] },
  { id: 'vis', naam: 'Geen vis', bevat: ['vis'] },
  { id: 'varken', naam: 'Geen varkensvlees', bevat: ['varken'] },
  { id: 'rund', naam: 'Geen rundvlees', bevat: ['rund'] },
];

export const VOORKEUREN = [
  { id: 'snel', naam: 'Snel klaar (≤ 30 min)', past: (r) => r.tijd <= 30 },
  { id: 'vega', naam: 'Vaker vegetarisch', past: (r) => r.bevat.length === 0 },
  { id: 'kind', naam: 'Kindvriendelijk', past: (r) => r.tags?.includes('kindvriendelijk') },
];

/** Kleine, voorspelbare toevalsgenerator: dezelfde seed geeft hetzelfde menu. */
export function maakRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Woorden uit "champignons, koriander" → ['champignons', 'koriander']. */
function lusIkNiet(tekst) {
  return normaliseer(tekst ?? '').split(/[\s,]+/).filter((w) => w.length >= 3);
}

/** Recepten die passen bij de uitsluitingen en de "lust ik niet"-lijst. */
export function toegestaneRecepten(recepten, instellingen, productenOpId) {
  const verboden = new Set(
    (instellingen.uitsluitingen ?? []).flatMap((id) => UITSLUITINGEN.find((u) => u.id === id)?.bevat ?? []),
  );
  const woorden = lusIkNiet(instellingen.nietLusten);
  return recepten.filter((r) => {
    if (r.bevat.some((b) => verboden.has(b))) return false;
    if (woorden.length === 0) return true;
    return !r.ingredienten.some((ing) => {
      const p = productenOpId.get(ing.product);
      const tekst = normaliseer([p?.naam, ...(p?.zoekwoorden ?? [])].join(' '));
      return woorden.some((w) => tekst.includes(w));
    });
  });
}

/**
 * Strafpunten voor een combinatie recepten (lager is beter).
 * @param {(recepten: object[]) => {teBetalen: number, verspilling: number}} kostenVan  zie maakSnelleKosten
 */
export function score(recepten, instellingen, kostenVan, gewicht = () => 0) {
  const k = kostenVan(recepten);
  let punten = Math.max(0, k.teBetalen - instellingen.budget) * 100 + k.verspilling + 0.1 * k.teBetalen;

  const perSoort = new Map();
  for (const r of recepten) perSoort.set(r.soort, (perSoort.get(r.soort) ?? 0) + 1);
  const vegaVoorkeur = instellingen.voorkeuren?.includes('vega');
  for (const [soort, n] of perSoort) {
    if (n > 1) punten += (n - 1) * (soort === 'vega' && vegaVoorkeur ? 0.3 : 1.5);
  }
  for (const r of recepten) {
    for (const v of VOORKEUREN) if (instellingen.voorkeuren?.includes(v.id) && v.past(r)) punten -= 1;
    punten += gewicht(r);
  }
  return { punten, kosten: k };
}

/**
 * Maakt een weekmenu.
 * @param {object[]} recepten  alle recepten
 * @param {object} instellingen  { budget, personen, aantal, uitsluitingen, voorkeuren, nietLusten, seed }
 * @param {object} ctx  { productenOpId, houdbaar, voorraad }
 * @param {object} [extra]  { vast: recept-ids die moeten blijven, nietKiezen: recept-ids om over te slaan }
 * @returns {{ maaltijden: object[], kosten: object, binnenBudget: boolean, melding: string|null }}
 */
export function maakWeekmenu(recepten, instellingen, ctx, { vast = [], nietKiezen = [] } = {}) {
  const random = maakRandom(instellingen.seed ?? 1);
  // Elk recept krijgt per seed een vast toevalsgewicht, voor afwisseling tussen suggesties.
  const gewichten = new Map(recepten.map((r) => [r.id, random() * 2]));
  const gewicht = (r) => gewichten.get(r.id) ?? 0;

  const vasteRecepten = vast.map((id) => recepten.find((r) => r.id === id)).filter(Boolean);
  const kandidaten = toegestaneRecepten(recepten, instellingen, ctx.productenOpId).filter(
    (r) => !vast.includes(r.id) && !nietKiezen.includes(r.id),
  );
  const nogNodig = Math.max(0, instellingen.aantal - vasteRecepten.length);

  if (kandidaten.length < nogNodig) {
    const maaltijden = [...vasteRecepten, ...kandidaten];
    return {
      maaltijden,
      kosten: berekenKosten(maaltijden, { ...instellingen, ...ctx }),
      binnenBudget: false,
      melding: `Er passen maar ${kandidaten.length + vasteRecepten.length} recepten bij je wensen. Haal een uitsluiting weg of voeg recepten toe.`,
    };
  }

  const kostenVan = maakSnelleKosten({ personen: instellingen.personen, ...ctx });
  const waardeer = (vrij) => score([...vasteRecepten, ...vrij], instellingen, kostenVan, gewicht).punten;
  let beste = null;

  for (let poging = 0; poging < 25; poging++) {
    // Willekeurige start…
    const pool = [...kandidaten].sort(() => random() - 0.5);
    let keuze = pool.slice(0, nogNodig);
    let punten = waardeer(keuze);
    // …en dan steeds één maaltijd ruilen zolang dat beter wordt.
    let verbeterd = true;
    while (verbeterd) {
      verbeterd = false;
      for (let i = 0; i < keuze.length; i++) {
        for (const ander of kandidaten) {
          if (keuze.includes(ander)) continue;
          const nieuw = keuze.map((r, j) => (j === i ? ander : r));
          const p = waardeer(nieuw);
          if (p < punten - 1e-9) {
            keuze = nieuw;
            punten = p;
            verbeterd = true;
          }
        }
      }
    }
    if (!beste || punten < beste.punten) beste = { keuze, punten };
  }

  const maaltijden = [...vasteRecepten, ...beste.keuze];
  const kosten = berekenKosten(maaltijden, { personen: instellingen.personen, productenOpId: ctx.productenOpId, houdbaar: ctx.houdbaar, voorraad: ctx.voorraad });
  const binnenBudget = kosten.teBetalen <= instellingen.budget + 1e-9;
  return {
    maaltijden,
    kosten,
    binnenBudget,
    melding: binnenBudget
      ? null
      : `Met deze wensen lukt het niet onder het budget te blijven. Dit is het goedkoopste menu dat past.`,
  };
}

/**
 * Vervangt één maaltijd door de beste andere keuze; de rest blijft staan.
 * @returns hetzelfde als maakWeekmenu, met de nieuwe maaltijd op dezelfde plek.
 */
export function vervangMaaltijd(recepten, huidig, index, instellingen, ctx) {
  const anderen = huidig.filter((_, i) => i !== index).map((r) => r.id);
  const resultaat = maakWeekmenu(recepten, { ...instellingen, aantal: huidig.length }, ctx, {
    vast: anderen,
    nietKiezen: [huidig[index].id],
  });
  const nieuw = resultaat.maaltijden.find((r) => !anderen.includes(r.id));
  if (!nieuw) return { ...resultaat, maaltijden: huidig, melding: 'Er is geen ander recept dat past bij je wensen.' };
  const maaltijden = huidig.map((r, i) => (i === index ? nieuw : r));
  return { ...resultaat, maaltijden };
}
