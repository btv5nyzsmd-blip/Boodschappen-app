import { describe, it, expect } from 'vitest';
import { voorraadKandidaten, standaardBasis, STANDAARD_NAMEN } from '../src/planner/basis.js';
import { berekenKosten } from '../src/planner/kosten.js';
import recepten from '../data/recepten.json';
import producten from '../data/producten.json';
import categorieen from '../data/categorieen.json';

const productenOpId = new Map(producten.map((p) => [p.id, p]));
const houdbaar = Object.fromEntries(categorieen.map((c) => [c.id, c.houdbaar]));
const kandidaten = voorraadKandidaten(recepten, productenOpId);

describe('altijd in huis', () => {
  it('biedt alleen houdbare voorraadkastproducten aan, elk één keer', () => {
    expect(kandidaten.length).toBeGreaterThan(30);
    expect(new Set(kandidaten.map((k) => k.productId)).size).toBe(kandidaten.length);
    for (const k of kandidaten) expect(houdbaar[k.categorie], k.naam).toBe(true);
    const namen = kandidaten.map((k) => k.naam);
    expect(namen).toContain('olijfolie');
    expect(namen).not.toContain('kipfilet');
    expect(namen).not.toContain('spinazie');
  });

  it('heeft standaard de gebruikelijke basisproducten aangevinkt', () => {
    const basis = standaardBasis(kandidaten);
    expect(basis).toHaveLength(STANDAARD_NAMEN.length); // elke standaardnaam bestaat in de recepten
    const namen = kandidaten.filter((k) => basis.includes(k.productId)).map((k) => k.naam);
    expect(namen).toEqual(expect.arrayContaining(['olijfolie', 'zwarte peper', 'bloem', 'bouillonblokjes']));
  });

  it('telt basisproducten niet mee in de boodschappen', () => {
    const lasagne = recepten.find((r) => r.id === 'lasagne'); // gebruikt 40 g bloem uit een kilozak
    const bloem = lasagne.ingredienten.find((i) => i.naam === 'bloem').product;
    const zonder = berekenKosten([lasagne], { personen: 4, productenOpId, houdbaar });
    const met = berekenKosten([lasagne], { personen: 4, productenOpId, houdbaar, voorraad: new Set([bloem]) });
    expect(zonder.teBetalen - met.teBetalen).toBeCloseTo(productenOpId.get(bloem).prijs);
  });
});
