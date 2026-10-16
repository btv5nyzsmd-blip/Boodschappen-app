import { describe, it, expect } from 'vitest';
import { isGeldig, isActueel, laadAanbiedingen, actueleAanbiedingen, pasToe, korting, vandaag } from '../src/aanbiedingen/index.js';
import { volgendeDinsdag } from '../src/ui/aanbiedingen-scherm.js';
import { maakWeekmenu, aanbiedingsVoordeel } from '../src/planner/planner.js';
import { berekenKosten } from '../src/planner/kosten.js';
import gedeeld from '../data/aanbiedingen.json';
import producten from '../data/producten.json';

const gehakt = { productId: 'gehakt', normalePrijs: 5, actiePrijs: 3.5, geldigTot: '2026-10-20' };

describe('geldigheid', () => {
  it('controleert de verplichte velden', () => {
    expect(isGeldig(gehakt)).toBe(true);
    expect(isGeldig({ ...gehakt, actiePrijs: 0 })).toBe(false);
    expect(isGeldig({ ...gehakt, geldigTot: '20-10-2026' })).toBe(false);
    expect(isGeldig({ ...gehakt, productId: undefined })).toBe(false);
  });

  it('telt begin- en einddatum allebei mee', () => {
    const a = { ...gehakt, geldigVanaf: '2026-10-14' };
    expect(isActueel(a, '2026-10-13')).toBe(false);
    expect(isActueel(a, '2026-10-14')).toBe(true);
    expect(isActueel(a, '2026-10-20')).toBe(true);
    expect(isActueel(a, '2026-10-21')).toBe(false);
  });

  it('schrijft vandaag als JJJJ-MM-DD', () => {
    expect(vandaag(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('kiest als einddatum de eerstvolgende dinsdag', () => {
    expect(volgendeDinsdag(new Date(2026, 9, 16))).toBe('2026-10-20'); // vrijdag → dinsdag
    expect(volgendeDinsdag(new Date(2026, 9, 20))).toBe('2026-10-20'); // dinsdag zelf
    expect(volgendeDinsdag(new Date(2026, 9, 21))).toBe('2026-10-27'); // woensdag → volgende week
  });
});

describe('bronnen', () => {
  it('combineert bronnen en slaat ongeldige regels over', async () => {
    const { aanbiedingen, fouten } = await laadAanbiedingen([
      { naam: 'A', laad: () => [gehakt, { productId: 'kapot' }] },
      { naam: 'B', laad: async () => [{ ...gehakt, productId: 'melk' }] },
    ]);
    expect(aanbiedingen.map((a) => [a.productId, a.bron])).toEqual([['gehakt', 'A'], ['melk', 'B']]);
    expect(fouten).toEqual([]);
  });

  it('gaat door als één bron niet werkt', async () => {
    const { aanbiedingen, fouten } = await laadAanbiedingen([
      { naam: 'Kapot', laad: () => { throw new Error('geen internet'); } },
      { naam: 'Goed', laad: () => [gehakt] },
    ]);
    expect(aanbiedingen).toHaveLength(1);
    expect(fouten).toEqual(['Kapot: geen internet']);
  });

  it('kiest per product de goedkoopste lopende aanbieding', () => {
    const actueel = actueleAanbiedingen(
      [gehakt, { ...gehakt, actiePrijs: 3 }, { ...gehakt, actiePrijs: 1, geldigTot: '2026-10-01' }],
      '2026-10-16',
    );
    expect(actueel.get('gehakt').actiePrijs).toBe(3);
  });

  it('data/aanbiedingen.json bevat alleen geldige aanbiedingen van bestaande producten', () => {
    const ids = new Set(producten.map((p) => p.id));
    for (const a of gedeeld.aanbiedingen) {
      expect(isGeldig(a), JSON.stringify(a)).toBe(true);
      expect(ids.has(a.productId), a.productId).toBe(true);
    }
  });
});

describe('actieprijs toepassen', () => {
  const lijst = [
    { id: 'gehakt', naam: 'Gehakt', inhoud: '500 g', prijs: 5, categorie: 'vlees' },
    { id: 'melk', naam: 'Melk', inhoud: '1 L', prijs: 1, categorie: 'zuivel' },
  ];

  it('zet de actieprijs en bewaart de normale prijs', () => {
    const [g, m] = pasToe(lijst, actueleAanbiedingen([gehakt], '2026-10-16'));
    expect(g).toMatchObject({ prijs: 3.5, normalePrijs: 5 });
    expect(korting(g)).toBeCloseTo(1.5);
    expect(m).toBe(lijst[1]); // ongewijzigd
  });

  it('negeert een "aanbieding" die niet goedkoper is', () => {
    const [g] = pasToe(lijst, actueleAanbiedingen([{ ...gehakt, actiePrijs: 6 }], '2026-10-16'));
    expect(g.aanbieding).toBeUndefined();
  });
});

describe('weekmenu met aanbiedingen', () => {
  // Twee recepten die precies even duur en even goed zijn; alleen de aanbieding verschilt.
  const basis = [
    { id: 'kip', naam: 'Kip', inhoud: '500 g', prijs: 5, categorie: 'kip' },
    { id: 'vis', naam: 'Vis', inhoud: '500 g', prijs: 5, categorie: 'vis' },
  ];
  const recepten = [
    { id: 'r-kip', naam: 'Kipgerecht', personen: 4, tijd: 30, soort: 'kip', bevat: ['kip'], ingredienten: [{ product: 'kip', hoeveelheid: 500 }] },
    { id: 'r-vis', naam: 'Visgerecht', personen: 4, tijd: 30, soort: 'vis', bevat: ['vis'], ingredienten: [{ product: 'vis', hoeveelheid: 500 }] },
  ];
  const ins = { budget: 100, personen: 4, aantal: 1, uitsluitingen: [], voorkeuren: [], nietLusten: '' };
  const houdbaar = { kip: false, vis: false };

  function kies(aanbiedingen, seed) {
    const producten = pasToe(basis, actueleAanbiedingen(aanbiedingen, vandaag()));
    const ctx = { productenOpId: new Map(producten.map((p) => [p.id, p])), houdbaar, voorraad: new Set() };
    return maakWeekmenu(recepten, { ...ins, seed }, ctx).maaltijden[0].id;
  }

  it('geeft voorrang aan het recept met een ingrediënt in de aanbieding', () => {
    const totDatum = '2099-12-31';
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      expect(kies([{ productId: 'vis', normalePrijs: 5, actiePrijs: 4.5, geldigTot: totDatum }], seed)).toBe('r-vis');
      expect(kies([{ productId: 'kip', normalePrijs: 5, actiePrijs: 4.5, geldigTot: totDatum }], seed)).toBe('r-kip');
    }
  });

  it('rekent in de kosten met de actieprijs', () => {
    const p = pasToe(basis, actueleAanbiedingen([{ productId: 'kip', normalePrijs: 5, actiePrijs: 3, geldigTot: '2099-12-31' }], vandaag()));
    const k = berekenKosten([recepten[0]], { personen: 4, productenOpId: new Map(p.map((x) => [x.id, x])), houdbaar });
    expect(k.teBetalen).toBeCloseTo(3);
  });

  it('beperkt het voordeel, zodat één dure aanbieding het menu niet overneemt', () => {
    const p = pasToe(basis, actueleAanbiedingen([{ productId: 'kip', normalePrijs: 5, actiePrijs: 0.01, geldigTot: '2099-12-31' }], vandaag()));
    expect(aanbiedingsVoordeel(recepten[0], new Map(p.map((x) => [x.id, x])))).toBe(6);
  });
});
