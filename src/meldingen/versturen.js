// Verstuurt meldingen "ligt ergens anders" anoniem naar het Google Formulier uit data/meldingen.json.
// Wat er gaat: een willekeurige code van deze telefoon (geen naam, geen locatie), het product,
// de afdeling en de winkel. Zonder internet wachten meldingen tot de volgende keer.
import instellingen from '../../data/meldingen.json';
import * as opslag from '../lijst/opslag.js';

const MAX_WACHTRIJ = 50;

/** Of er een formulier is ingesteld om meldingen naartoe te sturen. */
export const isIngesteld = (ins = instellingen) => Boolean(ins.formulier && ins.velden?.product);

/** Willekeurige, vaste code voor deze telefoon; zo telt elke telefoon maar één keer. */
export function apparaatCode() {
  let code = opslag.leesApparaat();
  if (!code) {
    code = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    opslag.bewaarApparaat(code);
  }
  return code;
}

/** De velden voor het formulier (entry.123=…), zoals Google ze verwacht. */
export function formulierVelden(ins, melding) {
  const data = new URLSearchParams();
  for (const [naam, entry] of Object.entries(ins.velden)) if (entry) data.append(entry, melding[naam] ?? '');
  return data;
}

/**
 * Meld waar een product ligt.
 * @param {{ product: string, afdeling: string, winkel: string, soort: 'melding'|'bevestiging'|'tegenspraak' }} melding
 */
export function meld(melding) {
  opslag.bewaarGestemd({ ...opslag.leesGestemd(), [melding.product]: melding.afdeling });
  const rij = [...opslag.leesWachtrij(), { ...melding, apparaat: apparaatCode() }].slice(-MAX_WACHTRIJ);
  opslag.bewaarWachtrij(rij);
  verstuur();
}

/** Of deze telefoon al iets over dit product heeft gemeld (dan vragen we het niet nog eens). */
export const alGemeld = (productId) => productId in opslag.leesGestemd();

let bezig = false;
/** Stuurt wachtende meldingen weg. Lukt het niet (geen bereik), dan blijven ze bewaard. */
export async function verstuur() {
  if (bezig || !isIngesteld() || typeof fetch !== 'function') return;
  bezig = true;
  try {
    const adres = instellingen.formulier.replace(/\/viewform.*$/, '/formResponse');
    for (const melding of opslag.leesWachtrij()) {
      // 'no-cors': Google stuurt geen leesbaar antwoord terug, maar ontvangt de melding wel.
      await fetch(adres, { method: 'POST', mode: 'no-cors', body: formulierVelden(instellingen, melding) });
      opslag.bewaarWachtrij(opslag.leesWachtrij().filter((m) => JSON.stringify(m) !== JSON.stringify(melding)));
    }
  } catch {
    // Geen verbinding: later opnieuw.
  } finally {
    bezig = false;
  }
}
