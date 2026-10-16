import { describe, it, expect } from 'vitest';
import { beeldVoorPunten, heleWinkel, zoomRond, verschuif, begrens, naarKaart, tussen, MIN_BREEDTE } from '../src/ui/kaart-beeld.js';
import { pijlpunten } from '../src/ui/kaart.js';
import jumbo from '../data/winkels/jumbo-zwolle-stadshagen.json';

const dichtbij = (a, b) => Object.keys(b).forEach((k) => expect(a[k]).toBeCloseTo(b[k], 5));

describe('kaartbeeld', () => {
  it('past punten in beeld met de vorm van het scherm', () => {
    const b = beeldVoorPunten([{ x: 10, y: 10 }, { x: 30, y: 20 }], 0.5, 2);
    expect(b.w / b.h).toBeCloseTo(0.5);
    expect(b.x).toBeLessThanOrEqual(8);
    expect(b.x + b.w).toBeGreaterThanOrEqual(32);
    expect(b.y).toBeLessThanOrEqual(8);
    expect(b.y + b.h).toBeGreaterThanOrEqual(22);
  });

  it('zoomt niet verder in dan de minimale breedte bij één punt', () => {
    const b = beeldVoorPunten([{ x: 5, y: 5 }], 1, 0.5);
    expect(b.w).toBeCloseTo(MIN_BREEDTE);
  });

  it('houdt het punt onder je vingers op zijn plek bij zoomen', () => {
    const b = { x: 0, y: 0, w: 40, h: 20 };
    const z = zoomRond(b, 10, 5, 2);
    expect(z.w).toBe(20);
    // 10,5 lag op 25% / 25% van het beeld en ligt daar nog steeds
    expect((10 - z.x) / z.w).toBeCloseTo(0.25);
    expect((5 - z.y) / z.h).toBeCloseTo(0.25);
  });

  it('verschuift en rekent schermpixels om naar meters', () => {
    dichtbij(verschuif({ x: 5, y: 5, w: 10, h: 10 }, 2, -1), { x: 3, y: 6, w: 10, h: 10 });
    dichtbij(naarKaart({ x: 0, y: 0, w: 20, h: 40 }, { width: 200, height: 400 }, 100, 100), { x: 10, y: 10 });
  });

  it('blijft binnen de grenzen: niet eindeloos uitzoomen of de winkel uit schuiven', () => {
    const v = 0.75;
    const ver = begrens({ x: -500, y: -500, w: 1000, h: 1000 / v }, jumbo, v);
    expect(ver.w).toBeLessThanOrEqual(heleWinkel(jumbo, v).w * 1.5 + 1e-6);
    const weg = begrens({ x: 500, y: 500, w: 20, h: 20 / v }, jumbo, v);
    expect(weg.x + weg.w / 2).toBeCloseTo(jumbo.breedte);
    const te = begrens({ x: 10, y: 10, w: 1, h: 1 / v }, jumbo, v);
    expect(te.w).toBeCloseTo(MIN_BREEDTE);
  });

  it('gaat vloeiend van het ene beeld naar het andere', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 10, y: 20, w: 30, h: 30 };
    dichtbij(tussen(a, b, 0), a);
    dichtbij(tussen(a, b, 1), b);
    dichtbij(tussen(a, b, 0.5), { x: 5, y: 10, w: 20, h: 20 });
  });
});

describe('pijltjes langs de route', () => {
  it('zet om de 4 meter een pijl met de looprichting', () => {
    const p = pijlpunten([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(p.map((q) => [q.x, q.y, q.hoek])).toEqual([
      [2, 0, 0],
      [6, 0, 0],
      [10, 0, 90],
      [10, 4, 90],
      [10, 8, 90],
    ]);
  });
});
