import { describe, it, expect } from 'vitest';
import { bouwNetwerk } from '../src/route/looppaden.js';
import { afstandenTabel } from '../src/route/afstanden.js';
import { berekenRoute, tweeOpt, orOpt, verbeter, routeLengte, dichtstbijzijndeBuur, sectiesVoorCategorieen } from '../src/route/route.js';
import jumbo from '../data/winkels/jumbo-zwolle-stadshagen.json';

// Een winkel met één rechte gang: ingang links, kassa rechts.
const gangWinkel = {
  ingang: { x: 0, y: 0 },
  kassas: [{ naam: 'Kassa', x: 10, y: 0 }],
  looppaden: [{ id: 'gang', van: [0, 0], naar: [10, 0] }],
  secties: [
    { id: 'c', x: 8, y: 0, categorieen: ['kaas'] },
    { id: 'a', x: 2, y: 0, categorieen: ['brood'] },
    { id: 'b', x: 5, y: 0, categorieen: ['melk'] },
  ],
};

// Twee evenwijdige gangen die alleen achterin (y = 0) met elkaar verbonden zijn.
// Hemelsbreed liggen de voorkanten 4 m uit elkaar, maar lopend is het 4 + 2×10 = 24 m.
const tweeGangen = {
  ingang: { x: 0, y: 10 },
  kassas: [{ naam: 'Kassa', x: 4, y: 10 }],
  looppaden: [
    { id: 'links', van: [0, 0], naar: [0, 10] },
    { id: 'rechts', van: [4, 0], naar: [4, 10] },
    { id: 'achter', van: [0, 0], naar: [4, 0] },
  ],
  secties: [
    { id: 'links-voor', x: 0, y: 9, categorieen: ['a'] },
    { id: 'rechts-voor', x: 4, y: 9, categorieen: ['b'] },
  ],
};

/** Beste route door alle volgordes te proberen (alleen haalbaar voor weinig stops). */
function optimaal(d, start, bezoek, einde) {
  let beste = Infinity;
  const permuteer = (rest, pad) => {
    if (rest.length === 0) {
      beste = Math.min(beste, routeLengte(d, [start, ...pad, einde]));
      return;
    }
    rest.forEach((x, i) => permuteer([...rest.slice(0, i), ...rest.slice(i + 1)], [...pad, x]));
  };
  permuteer(bezoek, []);
  return beste;
}

/** Voorspelbare "willekeurige" getallen, zodat de test elke keer hetzelfde doet. */
function maakRandom(zaad) {
  let s = zaad;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

describe('looppadennetwerk', () => {
  it('meet afstand langs de paden, niet hemelsbreed', () => {
    const netwerk = bouwNetwerk(tweeGangen);
    const tabel = afstandenTabel(netwerk, ['links-voor', 'rechts-voor']);
    expect(tabel.d[0][1]).toBeCloseTo(9 + 4 + 9);
  });

  it('afstanden zijn symmetrisch', () => {
    const netwerk = bouwNetwerk(jumbo);
    const ids = jumbo.secties.slice(0, 10).map((s) => s.id);
    const { d } = afstandenTabel(netwerk, ids);
    for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) expect(d[i][j]).toBeCloseTo(d[j][i]);
  });

  it('geeft een duidelijke fout als een punt niet bereikbaar is', () => {
    const kapot = {
      ...gangWinkel,
      looppaden: [...gangWinkel.looppaden, { id: 'los', van: [0, 5], naar: [10, 5] }],
      secties: [{ id: 'eiland', x: 5, y: 5, looppad: 'los', categorieen: ['x'] }],
    };
    expect(() => berekenRoute(kapot, ['eiland'])).toThrow(/niet bereiken/);
  });
});

describe('berekenRoute', () => {
  it('loopt in een rechte gang gewoon van voor naar achter', () => {
    const route = berekenRoute(gangWinkel, ['c', 'a', 'b']);
    expect(route.stops.map((s) => s.sectie.id)).toEqual(['a', 'b', 'c']);
    expect(route.totaleAfstand).toBeCloseTo(10);
  });

  it('begint bij de ingang en eindigt bij een kassa', () => {
    const route = berekenRoute(jumbo, ['wand-zuivel', 'pad1-pasta']);
    expect(route.lijn[0]).toEqual({ x: jumbo.ingang.x, y: jumbo.ingang.y });
    const laatste = route.lijn[route.lijn.length - 1];
    expect(jumbo.kassas.some((k) => k.x === laatste.x && k.y === laatste.y)).toBe(true);
  });

  it('bezoekt elke sectie precies één keer, ook bij dubbele invoer', () => {
    const ids = ['pad3-bakken', 'vers-kaas', 'pad3-bakken', 'vers-fruit'];
    const route = berekenRoute(jumbo, ids);
    expect(route.stops.map((s) => s.sectie.id).sort()).toEqual(['pad3-bakken', 'vers-fruit', 'vers-kaas']);
  });

  it('kiest de kassa die de route het kortst maakt', () => {
    const winkel = {
      ...gangWinkel,
      kassas: [{ naam: 'Ver', x: 10, y: 0 }, { naam: 'Dichtbij', x: 3, y: 0 }],
      secties: [{ id: 'a', x: 2, y: 0, categorieen: ['brood'] }],
    };
    expect(berekenRoute(winkel, ['a']).kassa.naam).toBe('Dichtbij');
  });

  it('kan starten vanaf een sectie in plaats van de ingang', () => {
    // Je staat bij b (x = 5): eerst c (x = 8) en dan pas a (x = 2) zou omlopen zijn.
    const winkel = { ...gangWinkel, kassas: [{ naam: 'Kassa', x: 0, y: 0 }] };
    const route = berekenRoute(winkel, ['a', 'c'], undefined, 'b');
    expect(route.stops.map((s) => s.sectie.id)).toEqual(['c', 'a']);
    expect(route.lijn[0]).toEqual({ x: 5, y: 0 });
    expect(route.totaleAfstand).toBeCloseTo(3 + 8);
  });

  it('werkt ook met een lege lijst (ingang → kassa)', () => {
    const route = berekenRoute(gangWinkel, []);
    expect(route.stops).toEqual([]);
    expect(route.totaleAfstand).toBeCloseTo(10);
  });

  it('komt in de Jumbo dicht bij de echte kortste route', () => {
    const netwerk = bouwNetwerk(jumbo);
    const random = maakRandom(42);
    for (let poging = 0; poging < 25; poging++) {
      const gekozen = [...jumbo.secties].sort(() => random() - 0.5).slice(0, 6).map((s) => s.id);
      const route = berekenRoute(jumbo, gekozen, netwerk);
      const kassaIds = jumbo.kassas.map((k) => `kassa:${k.naam}`);
      const tabel = afstandenTabel(netwerk, ['ingang', ...gekozen, ...kassaIds]);
      const stops = gekozen.map((_, i) => i + 1);
      const besteMogelijk = Math.min(...kassaIds.map((_, k) => optimaal(tabel.d, 0, stops, 1 + gekozen.length + k)));
      expect(route.totaleAfstand).toBeLessThanOrEqual(besteMogelijk * 1.05 + 1e-9);
    }
  });
});

describe('2-opt', () => {
  it('maakt een route nooit langer en houdt begin en eind vast', () => {
    const random = maakRandom(7);
    for (let poging = 0; poging < 50; poging++) {
      const n = 8;
      const punten = Array.from({ length: n }, () => ({ x: random() * 50, y: random() * 50 }));
      const d = punten.map((a) => punten.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
      const start = [0, ...[1, 2, 3, 4, 5, 6].sort(() => random() - 0.5), 7];
      const beter = tweeOpt(d, start);
      expect(routeLengte(d, beter)).toBeLessThanOrEqual(routeLengte(d, start) + 1e-9);
      expect(beter[0]).toBe(0);
      expect(beter[n - 1]).toBe(7);
      expect([...beter].sort()).toEqual([...start].sort());
    }
  });

  it('haalt een kruising uit de route', () => {
    // vierkant: 0 linksonder, 1 linksboven, 2 rechtsonder, 3 rechtsboven
    const p = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const d = p.map((a) => p.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
    // 0 → 3 → 1 → 2 kruist (twee diagonalen)… 2-opt mag alleen de middelste stops omdraaien.
    expect(tweeOpt(d, [0, 3, 1, 2])).toEqual([0, 1, 3, 2]);
  });
});

describe('or-opt', () => {
  it('verplaatst een stop die achteraan staat naar waar je er al langs liep', () => {
    // Punten op een lijn: 0 (ingang) — 1 — 2 — 3 — 4 (kassa). Stop 1 staat achteraan.
    const x = [0, 1, 2, 3, 4];
    const d = x.map((a) => x.map((b) => Math.abs(a - b)));
    expect(orOpt(d, [0, 2, 3, 1, 4])).toEqual([0, 1, 2, 3, 4]);
  });

  it('maakt een route nooit langer en houdt begin en eind vast', () => {
    const random = maakRandom(11);
    for (let poging = 0; poging < 50; poging++) {
      const punten = Array.from({ length: 9 }, () => ({ x: random() * 50, y: random() * 50 }));
      const d = punten.map((a) => punten.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
      const start = [0, ...[1, 2, 3, 4, 5, 6, 7].sort(() => random() - 0.5), 8];
      for (const beter of [orOpt(d, start), verbeter(d, start)]) {
        expect(routeLengte(d, beter)).toBeLessThanOrEqual(routeLengte(d, start) + 1e-9);
        expect(beter[0]).toBe(0);
        expect(beter[8]).toBe(8);
        expect([...beter].sort()).toEqual([...start].sort());
      }
    }
  });
});

describe('nearest neighbour', () => {
  it('gaat steeds naar het dichtstbijzijnde punt', () => {
    const d = [
      [0, 5, 1, 9],
      [5, 0, 2, 9],
      [1, 2, 0, 9],
      [9, 9, 9, 0],
    ];
    expect(dichtstbijzijndeBuur(d, 0, [1, 2, 3])).toEqual([0, 2, 1, 3]);
  });
});

describe('sectiesVoorCategorieen', () => {
  it('groepeert categorieën per sectie en meldt onbekende', () => {
    const { perSectie, nietGevonden } = sectiesVoorCategorieen(jumbo, ['pasta', 'rijst', 'zuivel', 'onbekend']);
    expect(perSectie.get('pad1-pasta')).toEqual(['pasta', 'rijst']);
    expect(perSectie.get('wand-zuivel')).toEqual(['zuivel']);
    expect(nietGevonden).toEqual(['onbekend']);
  });
});
