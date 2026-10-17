// Bewaart de boodschappenlijst en eigen producten in de browser (localStorage).
// Alles blijft op je eigen telefoon. Alleen meldingen "ligt ergens anders" gaan anoniem
// naar internet (zie src/meldingen/versturen.js), met een willekeurige code in plaats van je naam.

const SLEUTEL_LIJST = 'boodschappen.lijst.v1';
const SLEUTEL_EIGEN = 'boodschappen.eigen-producten.v1';
const SLEUTEL_WINKEL = 'boodschappen.winkel.v1';
const SLEUTEL_POSITIE = 'boodschappen.positie.v1';

function lees(sleutel, standaard) {
  try {
    const waarde = localStorage.getItem(sleutel);
    return waarde ? JSON.parse(waarde) : standaard;
  } catch {
    return standaard; // bijv. privévenster of geblokkeerde opslag
  }
}

function schrijf(sleutel, waarde) {
  try {
    localStorage.setItem(sleutel, JSON.stringify(waarde));
  } catch {
    // Opslaan lukt niet; de app werkt verder, alleen zonder onthouden.
  }
}

/** @returns {{productId: string, aantal: number, afgevinkt: boolean}[]} */
export const leesLijst = () => lees(SLEUTEL_LIJST, []);
export const bewaarLijst = (lijst) => schrijf(SLEUTEL_LIJST, lijst);

/** Producten die je zelf hebt toegevoegd omdat ze niet in de catalogus stonden. */
export const leesEigenProducten = () => lees(SLEUTEL_EIGEN, []);
export const bewaarEigenProducten = (producten) => schrijf(SLEUTEL_EIGEN, producten);

export const leesWinkelKeuze = () => lees(SLEUTEL_WINKEL, null);
export const bewaarWinkelKeuze = (bestand) => schrijf(SLEUTEL_WINKEL, bestand);

/** De sectie waar je het laatst iets afvinkte (vanaf daar wordt de route berekend). */
export const leesPositie = () => lees(SLEUTEL_POSITIE, null);
export const bewaarPositie = (sectieId) => schrijf(SLEUTEL_POSITIE, sectieId);

/** Afdelingen die je zelf hebt gekozen voor producten: product-id → categorie-id. */
const SLEUTEL_AFDELINGEN = 'boodschappen.afdelingen.v1';
export const leesAfdelingen = () => lees(SLEUTEL_AFDELINGEN, {});
export const bewaarAfdelingen = (afdelingen) => schrijf(SLEUTEL_AFDELINGEN, afdelingen);

/** Weekmenu: instellingen, gekozen recepten, vastgezette recepten en wat je al in huis hebt. */
const SLEUTEL_PLANNER = 'boodschappen.planner.v1';
export const leesPlanner = (standaard) => ({ ...standaard, ...lees(SLEUTEL_PLANNER, {}) });
export const bewaarPlanner = (planner) => schrijf(SLEUTEL_PLANNER, planner);

/** Of het welkomstscherm al eens is getoond. */
const SLEUTEL_WELKOM = 'boodschappen.welkom.v1';
export const welkomGezien = () => lees(SLEUTEL_WELKOM, false);
export const bewaarWelkomGezien = () => schrijf(SLEUTEL_WELKOM, true);

/** Meldingen "ligt ergens anders": willekeurige code van deze telefoon, nog te versturen meldingen,
 *  en waarover je al iets hebt gemeld (product-id → afdeling). */
const SLEUTEL_APPARAAT = 'boodschappen.apparaat.v1';
const SLEUTEL_WACHTRIJ = 'boodschappen.meldingen-wachtrij.v1';
const SLEUTEL_GESTEMD = 'boodschappen.meldingen-gemeld.v1';
export const leesApparaat = () => lees(SLEUTEL_APPARAAT, null);
export const bewaarApparaat = (code) => schrijf(SLEUTEL_APPARAAT, code);
export const leesWachtrij = () => lees(SLEUTEL_WACHTRIJ, []);
export const bewaarWachtrij = (rij) => schrijf(SLEUTEL_WACHTRIJ, rij);
export const leesGestemd = () => lees(SLEUTEL_GESTEMD, {});
export const bewaarGestemd = (gestemd) => schrijf(SLEUTEL_GESTEMD, gestemd);
