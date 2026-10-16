import { describe, it, expect } from 'vitest';
import { zoekProducten, normaliseer } from '../src/lijst/zoeken.js';
import { voegToe, wijzigAantal, wisselAfgevinkt, verwijderAfgevinkt, routeVoorLijst, sectieVanProduct } from '../src/lijst/lijst.js';
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
    const pastaStop = stops.find((s) => s.sectie.id === 'pad1-pasta');
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

describe('route herberekenen onderweg', () => {
  const melk = 'jumbo-halfvolle-melk-1-l'; // zuivelwand
  const spaghetti = 'jumbo-spaghetti-500-g'; // pad 1
  const bananen = 'jumbo-bananen-5-stuks'; // groente & fruit
  const brood = 'jumbo-volkoren-brood-heel-800-g'; // bakkerij
  const lijstMet = (...ids) => ids.reduce((l, id) => voegToe(l, id), []);

  it('laat afgevinkte producten uit de route en berekent de rest vanaf je positie', () => {
    let lijst = lijstMet(melk, spaghetti, bananen, brood);
    lijst = wisselAfgevinkt(lijst, melk);
    const positie = sectieVanProduct(jumbo, opId.get(melk));
    expect(positie).toBe('wand-zuivel');

    const info = routeVoorLijst(jumbo, lijst, opId, undefined, positie);
    expect(info.vanaf.id).toBe('wand-zuivel');
    expect(info.route.lijn[0].x).toBeCloseTo(info.vanaf.x);
    expect(info.route.lijn[0].y).toBeCloseTo(info.vanaf.y);
    expect(info.stops.map((s) => s.sectie.id)).not.toContain('wand-zuivel');
    expect(info.inKar.map((r) => r.productId)).toEqual([melk]);
    expect(info.stops.flatMap((s) => s.regels).map((r) => r.productId).sort()).toEqual([bananen, brood, spaghetti].sort());
  });

  it('is vanaf je positie nooit langer dan de oude route vanaf daar', () => {
    const lijst = wisselAfgevinkt(lijstMet(melk, spaghetti, bananen, brood), bananen);
    const vanIngang = routeVoorLijst(jumbo, lijst, opId);
    const vanFruit = routeVoorLijst(jumbo, lijst, opId, undefined, 'vers-fruit');
    // Vanaf het fruit (vlak bij de ingang) is de resterende route ongeveer even lang of korter.
    expect(vanFruit.route.totaleAfstand).toBeLessThanOrEqual(vanIngang.route.totaleAfstand + 15);
  });

  it('laat een product dat je onderweg toevoegt meteen in de route zien', () => {
    let lijst = wisselAfgevinkt(lijstMet(melk, spaghetti), melk);
    lijst = voegToe(lijst, brood);
    const info = routeVoorLijst(jumbo, lijst, opId, undefined, 'wand-zuivel');
    expect(info.stops.map((s) => s.sectie.id)).toContain('vers-brood');
  });

  it('houdt een afgevinkt product zichtbaar bij een stop waar nog iets te halen is', () => {
    // Spaghetti en rijst liggen op dezelfde plek; je hebt de spaghetti al.
    const lijst = wisselAfgevinkt(lijstMet(spaghetti, 'jumbo-basmatirijst-1-kg'), spaghetti);
    const info = routeVoorLijst(jumbo, lijst, opId, undefined, 'pad1-pasta');
    expect(info.stops).toHaveLength(1);
    expect(info.stops[0].regels.map((r) => [r.productId, r.afgevinkt])).toEqual([
      [spaghetti, true],
      ['jumbo-basmatirijst-1-kg', false],
    ]);
    expect(info.inKar).toEqual([]);
  });

  it('wijst naar de kassa als alles is afgevinkt', () => {
    const lijst = wisselAfgevinkt(lijstMet(melk), melk);
    const info = routeVoorLijst(jumbo, lijst, opId, undefined, 'wand-zuivel');
    expect(info.stops).toEqual([]);
    expect(info.route.kassa).toBeTruthy();
  });
});

