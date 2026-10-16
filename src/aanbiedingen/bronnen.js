// De bronnen van aanbiedingen. Wil je later een andere databron aansluiten (bijv. een
// online lijst), maak dan hier een nieuw object { naam, laad } en voeg het toe in main.js.

import gedeeld from '../../data/aanbiedingen.json';

const SLEUTEL = 'boodschappen.aanbiedingen.v1';

/** Aanbiedingen uit data/aanbiedingen.json: gelden voor iedereen die de app gebruikt. */
export const bestandBron = {
  naam: 'Gedeelde lijst',
  laad: () => gedeeld.aanbiedingen ?? [],
};

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
