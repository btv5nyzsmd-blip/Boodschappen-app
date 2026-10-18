import { describe, it, expect } from 'vitest';
import { beeldVoorPunten, heleWinkel, zoomRond, verschuif, begrens, naarKaart, tussen, MIN_BREEDTE, draai, draaiRond, leesbaar, normaliseerHoek, middenVan } from '../src/ui/kaart-beeld.js';
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

describe('kaart draaien', () => {
  const m = { x: 10, y: 5 };

  it('draait punten met de klok mee rond het midden', () => {
    dichtbij(draai({ x: 20, y: 5 }, 90, m), { x: 10, y: 15 }); // rechts → onder
    dichtbij(draai({ x: 20, y: 5 }, 180, m), { x: 0, y: 5 });
    dichtbij(draai(draai({ x: 3, y: 7 }, 37, m), -37, m), { x: 3, y: 7 });
  });

  it('houdt het punt tussen je vingers op zijn plek bij draaien', () => {
    const b = { x: 0, y: 0, w: 20, h: 10 };
    const vingers = { x: 14, y: 6 }; // beeldpunt
    const winkelpunt = draai(vingers, -30, m); // wat daar ligt bij hoek 30
    const nb = draaiRond(b, vingers.x, vingers.y, 30, 75, m);
    const nu = draai(winkelpunt, 75, m);
    // Zelfde winkelpunt, zelfde plek in het beeld.
    expect((nu.x - nb.x) / nb.w).toBeCloseTo((vingers.x - b.x) / b.w);
    expect((nu.y - nb.y) / nb.h).toBeCloseTo((vingers.y - b.y) / b.h);
  });

  it('toont de hele gedraaide winkel', () => {
    const staand = heleWinkel(jumbo, 0.6, 90);
    const plat = heleWinkel(jumbo, 0.6, 0);
    // Een brede winkel wordt na een kwartslag hoog: hij past dan groter op een telefoonscherm.
    expect(jumbo.breedte).toBeGreaterThan(jumbo.diepte);
    expect(staand.w).toBeLessThan(plat.w);
    const midden = middenVan(jumbo);
    for (const hoek of [{ x: 0, y: 0 }, { x: jumbo.breedte, y: jumbo.diepte }].map((p) => draai(p, 90, midden))) {
      expect(hoek.x).toBeGreaterThanOrEqual(staand.x);
      expect(hoek.x).toBeLessThanOrEqual(staand.x + staand.w);
    }
  });

  it('houdt het gedraaide beeld bij de winkel', () => {
    const ver = { x: 500, y: 500, w: 20, h: 30 };
    const b = begrens(ver, jumbo, 20 / 30, 90);
    const midden = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const terug = draai(midden, -90, middenVan(jumbo)); // in winkelcoördinaten
    expect(terug.x).toBeGreaterThanOrEqual(-0.01);
    expect(terug.x).toBeLessThanOrEqual(jumbo.breedte + 0.01);
    expect(terug.y).toBeGreaterThanOrEqual(-0.01);
    expect(terug.y).toBeLessThanOrEqual(jumbo.diepte + 0.01);
  });

  it('zet tekst nooit op z\'n kop', () => {
    expect(leesbaar(0)).toBe(0);
    expect(leesbaar(180)).toBe(0);
    expect(leesbaar(270)).toBe(90);
    expect(leesbaar(-120)).toBe(60);
    expect(normaliseerHoek(450)).toBe(90);
    expect(normaliseerHoek(-90)).toBe(-90);
  });
});
