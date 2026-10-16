import { describe, it, expect } from 'vitest';
import { zoekProducten, normaliseer, woordvormen } from '../src/lijst/zoeken.js';
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
    expect(zoekProducten(producten, 'CREME FRAICHE')[0].naam).toMatch(/Crème Fraîche/i);
  });

  it('vindt alleen producten met het zoekwoord in de naam', () => {
    expect(zoekProducten(producten, 'toiletpapier').every((p) => /toiletpapier/i.test(p.naam))).toBe(true);
  });

  it('begrijpt Nederlandse woordvormen (rode ↔ rood, tomaten ↔ tomaat)', () => {
    expect(woordvormen('rode')).toContain('rood');
    expect(woordvormen('gele')).toContain('geel');
    expect(woordvormen('witte')).toContain('wit');
    expect(woordvormen('tomaten')).toContain('tomaat');
    expect(woordvormen('rood')).toContain('rode');
    expect(woordvormen('wit')).toContain('witte');
    expect(zoekProducten(producten, 'rode paprika')[0].naam).toBe('Jumbo Paprika Rood');
    expect(zoekProducten(producten, 'gele paprika')[0].naam).toBe('Jumbo Paprika Geel');
  });

  it('geeft niets bij een lege zoekopdracht', () => {
    expect(zoekProducten(producten, '   ')).toEqual([]);
  });

  it('zet producten met het zoekwoord in de naam bovenaan', () => {
    expect(zoekProducten(producten, 'spaghetti').slice(0, 5).every((p) => /spaghetti/i.test(p.naam))).toBe(true);
  });
});

describe('lijst', () => {
  it('telt hetzelfde product op in plaats van het dubbel toe te voegen', () => {
    let lijst = voegToe([], 'jumbo-s-spaghetti-500-g-710328zk');
    lijst = voegToe(lijst, 'jumbo-s-spaghetti-500-g-710328zk', 2);
    expect(lijst).toEqual([{ productId: 'jumbo-s-spaghetti-500-g-710328zk', aantal: 3, afgevinkt: false }]);
  });

  it('verwijdert een product als het aantal 0 wordt', () => {
    const lijst = voegToe([], 'jumbo-s-spaghetti-500-g-710328zk');
    expect(wijzigAantal(lijst, 'jumbo-s-spaghetti-500-g-710328zk', -1)).toEqual([]);
  });

  it('kan afvinken en afgevinkte producten opruimen', () => {
    let lijst = voegToe(voegToe([], 'a'), 'b');
    lijst = wisselAfgevinkt(lijst, 'a');
    expect(lijst[0].afgevinkt).toBe(true);
    expect(verwijderAfgevinkt(lijst).map((r) => r.productId)).toEqual(['b']);
  });

  it('groepeert de lijst per stop in looproute-volgorde', () => {
    let lijst = [];
    for (const id of ['jumbo-verse-halfvolle-melk-1-l-498518pak', 'jumbo-s-spaghetti-500-g-710328zk', 'jumbo-dole-bananen-5-stuks-532148zk', 'jumbo-basmati-rijst-voordeelverpakking-1-kg-186364zk']) {
      expect(opId.has(id)).toBe(true);
      lijst = voegToe(lijst, id);
    }
    const { stops, nietGevonden } = routeVoorLijst(jumbo, lijst, opId);
    expect(nietGevonden).toEqual([]);
    const pastaStop = stops.find((s) => s.sectie.id === 'pad1-pasta');
    expect(pastaStop.regels.map((r) => r.product.naam).sort()).toEqual(['Jumbo Basmati Rijst Voordeelverpakking 1 kg', "Jumbo's Spaghetti 500 g"]);
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
  const melk = 'jumbo-verse-halfvolle-melk-1-l-498518pak'; // zuivelwand
  const spaghetti = 'jumbo-s-spaghetti-500-g-710328zk'; // pad 1
  const bananen = 'jumbo-dole-bananen-5-stuks-532148zk'; // groente & fruit
  const brood = 'jumbo-boeren-tijger-volkoren-631885stk'; // bakkerij
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
    const lijst = wisselAfgevinkt(lijstMet(spaghetti, 'jumbo-basmati-rijst-voordeelverpakking-1-kg-186364zk'), spaghetti);
    const info = routeVoorLijst(jumbo, lijst, opId, undefined, 'pad1-pasta');
    expect(info.stops).toHaveLength(1);
    expect(info.stops[0].regels.map((r) => [r.productId, r.afgevinkt])).toEqual([
      [spaghetti, true],
      ['jumbo-basmati-rijst-voordeelverpakking-1-kg-186364zk', false],
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

