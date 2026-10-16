// Controleert de JSON-bestanden. Draai `npm test` nadat je een winkel of
// producten hebt aangepast: dan zie je meteen of er iets niet klopt.
import { describe, it, expect } from 'vitest';
import { berekenRoute } from '../src/route/route.js';
import producten from '../data/producten.json';
import categorieen from '../data/categorieen.json';

const winkels = import.meta.glob('../data/winkels/*.json', { eager: true, import: 'default' });
const categorieIds = new Set(categorieen.map((c) => c.id));

describe('producten.json', () => {
  it('heeft unieke ids', () => {
    const ids = producten.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gebruikt alleen bestaande categorieën', () => {
    const fout = producten.filter((p) => !categorieIds.has(p.categorie)).map((p) => `${p.id} → ${p.categorie}`);
    expect(fout).toEqual([]);
  });

  it('heeft bij elk product naam, inhoud en een prijs', () => {
    for (const p of producten) {
      expect(p.naam, p.id).toBeTruthy();
      expect(p.inhoud, p.id).toBeTruthy();
      expect(p.prijs, p.id).toBeGreaterThan(0);
    }
  });
});

describe.each(Object.entries(winkels))('winkel %s', (_, winkel) => {
  it('heeft ingang, kassa en looppaden', () => {
    expect(winkel.ingang).toBeTruthy();
    expect(winkel.kassas.length).toBeGreaterThan(0);
    expect(winkel.looppaden.length).toBeGreaterThan(0);
  });

  it('heeft unieke sectie-ids', () => {
    const ids = winkel.secties.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gebruikt alleen bestaande categorieën, elk maar op één plek', () => {
    const gezien = new Map();
    for (const s of winkel.secties) {
      for (const c of s.categorieen) {
        expect(categorieIds.has(c), `onbekende categorie "${c}" in sectie ${s.id}`).toBe(true);
        expect(gezien.get(c), `categorie "${c}" staat in ${gezien.get(c)} én ${s.id}`).toBeUndefined();
        gezien.set(c, s.id);
      }
    }
  });

  it('kan alle secties in één route bereiken', () => {
    const route = berekenRoute(winkel, winkel.secties.map((s) => s.id));
    expect(route.stops).toHaveLength(winkel.secties.length);
  });
});
