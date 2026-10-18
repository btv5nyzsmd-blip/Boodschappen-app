// De bronnen van aanbiedingen. Wil je later een andere databron aansluiten (bijv. een
// online lijst), maak dan hier een nieuw object { naam, laad } en voeg het toe in main.js.

import gedeeld from '../../data/aanbiedingen.json';
import vanKlanten from '../../data/aanbiedingen-gedeeld.json';

const SLEUTEL = 'boodschappen.aanbiedingen.v1';

/**
 * Aanbiedingen voor iedereen: met de hand in data/aanbiedingen.json, plus wat de beheerder en
 * klanten via de app hebben gedeeld (data/aanbiedingen-gedeeld.json, elke ochtend bijgewerkt).
 */
export const bestandBron = {
  naam: 'Gedeelde lijst',
  laad: () => [...(gedeeld.aanbiedingen ?? []), ...(vanKlanten.aanbiedingen ?? [])],
};

/** Gedeelde aanbiedingen die nog niet genoeg telefoons hebben: andere klanten kunnen ze bevestigen. */
export const teBevestigen = () => vanKlanten.open ?? [];

/** Aanbiedingen die je in de app hebt ingevoerd: alleen op deze telefoon. */
export const eigenBron = {
  naam: 'Zelf ingevoerd',
  laad: () => leesEigen(),
};

export function leesEigen() {
  try {
    return JSON.parse(localStorage.getItem(SLEUTEL) ?? '[]');
  } catch {
    return [];
  }
}

export function bewaarEigen(lijst) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(lijst));
  } catch {
    // Opslaan lukt niet (bijv. privévenster); de aanbieding geldt dan alleen tot je de app sluit.
  }
}
