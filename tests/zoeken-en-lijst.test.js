import { describe, it, expect } from 'vitest';
import { zoekProducten, normaliseer } from '../src/lijst/zoeken.js';
import { voegToe, wijzigAantal, wisselAfgevinkt, verwijderAfgevinkt, routeVoorLijst } from '../src/lijst/lijst.js';
import producten from '../data/producten.json';
import jumbo from '../data/winkels/jumbo-zwolle-stadshagen.json';

const opId = new Map(producten.map((p) => [p.id, p]));

describe('zoeken', () => {
  it('vindt specifieke varianten', () => {
    const treffers = zoekProducten(producten, 'cola zero');
    expect(treffers.length).toBeGreaterThan(1);
    for (const p of treffers) expect(normaliseer(`${p.merk} ${p.naam}`)).toMatch(/cola.*zero/);
  });

  it('negeert hoofdletters en accenten', () => {
    expect(zoekProducten(producten, 'CREME FRAICHE')[0].naam).toBe('Crème fraîche');
  });

  it('vindt producten via zoekwoorden', () => {
    expect(zoekProducten(producten, 'wc-papier').some((p) => p.naam === 'Toiletpapier')).toBe(true);
  });

  it('geeft niets bij een lege zoekopdracht', () => {
    expect(zoekProducten(producten, '   ')).toEqual([]);
  });

  it('zet een exacte naam bovenaan', () => {
    expect(zoekProducten(producten, 'spaghetti')[0].naam).toMatch(/^Spaghetti/);
  });
});

describe('lijst', () => {
  it('telt hetzelfde product op in plaats van het dubbel toe te voegen', () => {
    let lijst = voegToe([], 'jumbo-spaghetti-500-g');
    lijst = voegToe(lijst, 'jumbo-spaghetti-500-g', 2);
    expect(lijst).toEqual([{ productId: 'jumbo-spaghetti-500-g', aantal: 3, afgevinkt: false }]);
  });

  it('verwijdert een product als het aantal 0 wordt', () => {
    const lijst = voegToe([], 'jumbo-spaghetti-500-g');
    expect(wijzigAantal(lijst, 'jumbo-spaghetti-500-g', -1)).toEqual([]);
  });

  it('kan afvinken en afgevinkte producten opruimen', () => {
    let lijst = voegToe(voegToe([], 'a'), 'b');
    lijst = wisselAfgevinkt(lijst, 'a');
    expect(lijst[0].afgevinkt).toBe(true);
    expect(verwijderAfgevinkt(lijst).map((r) => r.productId)).toEqual(['b']);
  });

  it('groepeert de lijst per stop in looproute-volgorde', () => {
    let lijst = [];
    for (const id of ['jumbo-halfvolle-melk-1-l', 'jumbo-spaghetti-500-g', 'jumbo-bananen-5-stuks', 'jumbo-basmatirijst-1-kg']) {
      expect(opId.has(id)).toBe(true);
      lijst = voegToe(lijst, id);
    }
    const { stops, nietGevonden } = routeVoorLijst(jumbo, lijst, opId);
    expect(nietGevonden).toEqual([]);
    const pastaStop = stops.find((s) => s.sectie.id === 'gang-3-voor');
    expect(pastaStop.regels.map((r) => r.product.naam).sort()).toEqual(['Basmatirijst', 'Spaghetti']);
    expect(stops.flatMap((s) => s.regels)).toHaveLength(4);
  });

  it('zet producten zonder plek in de winkel apart', () => {
    const eigen = new Map([['x', { id: 'x', naam: 'Iets', categorie: 'bestaat-niet' }]]);
    const { stops, nietGevonden } = routeVoorLijst(jumbo, voegToe([], 'x'), eigen);
    expect(stops).toEqual([]);
    expect(nietGevonden.map((r) => r.productId)).toEqual(['x']);
  });
});
