import { describe, it, expect } from 'vitest';
import { leesCsv, telMeldingen } from '../src/meldingen/tellen.js';
import { formulierVelden, isIngesteld } from '../src/meldingen/versturen.js';
import instellingen from '../data/meldingen.json';
import open from '../data/meldingen-open.json';
import producten from '../data/producten.json';
import categorieen from '../data/categorieen.json';

const huidig = new Map([['melk', 'zuivel'], ['pizzadeeg', 'zuivel']]);
const categorieIds = new Set(['zuivel', 'brood', 'diepvries']);
const tel = (meldingen, drempel = 3) => telMeldingen(meldingen, { huidig, categorieIds, drempel });
const m = (apparaat, product, afdeling) => ({ apparaat, product, afdeling });

describe('meldingen tellen (zoals Flitsmeister)', () => {
  it('verplaatst pas bij genoeg verschillende telefoons', () => {
    const twee = [m('a', 'pizzadeeg', 'brood'), m('b', 'pizzadeeg', 'brood')];
    expect(tel(twee).verplaatsen).toEqual([]);
    expect(tel(twee).open).toEqual([{ product: 'pizzadeeg', van: 'zuivel', naar: 'brood', stemmen: 2, tegen: 0 }]);
    const drie = tel([...twee, m('c', 'pizzadeeg', 'brood')]);
    expect(drie.verplaatsen).toEqual([{ product: 'pizzadeeg', van: 'zuivel', naar: 'brood', stemmen: 3, tegen: 0 }]);
    expect(drie.open).toEqual([]);
  });

  it('telt één telefoon maar één keer per product (de laatste melding telt)', () => {
    const spam = [m('a', 'melk', 'brood'), m('a', 'melk', 'brood'), m('a', 'melk', 'brood'), m('a', 'melk', 'brood')];
    expect(tel(spam).verplaatsen).toEqual([]);
    expect(tel(spam).open[0].stemmen).toBe(1);
    // Van gedachten veranderd: telt nu voor de huidige plek.
    expect(tel([...spam, m('a', 'melk', 'zuivel')]).open).toEqual([]);
  });

  it('verplaatst niet als meer klanten de huidige plek bevestigen', () => {
    const meldingen = ['a', 'b', 'c'].map((t) => m(t, 'melk', 'brood')).concat(['d', 'e', 'f'].map((t) => m(t, 'melk', 'zuivel')));
    expect(tel(meldingen).verplaatsen).toEqual([]);
    expect(tel([...meldingen, m('g', 'melk', 'brood'), m('h', 'melk', 'brood')]).verplaatsen).toHaveLength(1);
  });

  it('negeert onbekende producten, afdelingen en lege codes', () => {
    const r = tel([m('a', 'onbekend', 'brood'), m('b', 'melk', 'nergens'), m('', 'melk', 'brood')], 1);
    expect(r).toEqual({ verplaatsen: [], open: [] });
  });

  it('de drempel is in te stellen', () => {
    expect(instellingen.drempel).toBe(3);
    expect(tel([m('a', 'melk', 'brood')], 1).verplaatsen).toHaveLength(1);
  });
});

describe('CSV van Google Spreadsheets', () => {
  it('leest koppen, aanhalingstekens en komma\'s in velden', () => {
    const csv = 'Tijdstempel,Apparaat,Product,Afdeling,Winkel,Soort\r\n"17-10-2026 12:00:00",x1,"melk, halfvol",zuivel,jumbo,melding\r\n17-10-2026 12:01:00,x2,"zeg ""kaas""",brood,jumbo,bevestiging\r\n';
    expect(leesCsv(csv)).toEqual([
      { tijdstempel: '17-10-2026 12:00:00', apparaat: 'x1', product: 'melk, halfvol', afdeling: 'zuivel', winkel: 'jumbo', soort: 'melding' },
      { tijdstempel: '17-10-2026 12:01:00', apparaat: 'x2', product: 'zeg "kaas"', afdeling: 'brood', winkel: 'jumbo', soort: 'bevestiging' },
    ]);
    expect(leesCsv('')).toEqual([]);
  });
});

describe('versturen naar het formulier', () => {
  it('zet elk veld onder zijn entry-nummer', () => {
    const ins = { formulier: 'https://docs.google.com/forms/d/e/abc/viewform', velden: { apparaat: 'entry.1', product: 'entry.2', afdeling: 'entry.3', winkel: '', soort: 'entry.5' } };
    expect(isIngesteld(ins)).toBe(true);
    const data = formulierVelden(ins, { apparaat: 'x', product: 'melk', afdeling: 'zuivel', winkel: 'jumbo', soort: 'melding' });
    expect(data.toString()).toBe('entry.1=x&entry.2=melk&entry.3=zuivel&entry.5=melding');
    expect(isIngesteld({ formulier: '', velden: {} })).toBe(false);
  });

  it('openstaande meldingen verwijzen naar bestaande producten en afdelingen', () => {
    const ids = new Set(producten.map((p) => p.id));
    const afdelingen = new Set(categorieen.map((c) => c.id));
    for (const o of open) {
      expect(ids.has(o.product), o.product).toBe(true);
      expect(afdelingen.has(o.naar), o.naar).toBe(true);
    }
  });
});
