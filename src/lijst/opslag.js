// Bewaart de boodschappenlijst en eigen producten in de browser (localStorage).
// Er gaat niets naar internet; alles blijft op je eigen telefoon.

const SLEUTEL_LIJST = 'boodschappen.lijst.v1';
const SLEUTEL_EIGEN = 'boodschappen.eigen-producten.v1';
const SLEUTEL_WINKEL = 'boodschappen.winkel.v1';

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
