import { describe, it, expect } from 'vitest';
import { leesDatum, leesCenten, telAanbiedingen } from '../src/aanbiedingen/tellen.js';
import { isGeldig } from '../src/aanbiedingen/index.js';
import gedeeld from '../data/aanbiedingen-gedeeld.json';

const prijzen = new Map([['gehakt', 5.4], ['kaas', 4.0]]);
const opties = { prijzen, beheerders: new Set(['baas']), minimum: 2, vandaag: '2026-10-21' };
const rij = (apparaat, product, prijs, tot = '2026-10-27', extra = {}) => ({ soort: 'aanbieding', apparaat, product, prijs, tot, ...extra });

describe('gedeelde aanbiedingen', () => {
  it('leest datums en prijzen zoals Google ze teruggeeft', () => {
    expect(leesDatum('2026-10-27')).toBe('2026-10-27');
    expect(leesDatum('27-10-2026')).toBe('2026-10-27');
    expect(leesDatum('7/1/2027')).toBe('2027-01-07');
    expect(leesDatum('morgen')).toBeNull();
    expect(leesCenten('399')).toBe(3.99);
    expect(leesCenten('3,99')).toBeNull();
    expect(leesCenten('0')).toBeNull();
  });

  it('een klant-aanbieding geldt pas bij twee verschillende telefoons', () => {
    const een = telAanbiedingen([rij('a', 'gehakt', '399'), rij('a', 'gehakt', '399')], opties);
    expect(een.aanbiedingen).toEqual([]);
    expect(een.open).toHaveLength(1);
    expect(een.open[0]).toMatchObject({ productId: 'gehakt', actiePrijs: 3.99, normalePrijs: 5.4, telefoons: 1 });

    const twee = telAanbiedingen([rij('a', 'gehakt', '399'), rij('b', 'gehakt', '399')], opties);
    expect(twee.aanbiedingen).toEqual([expect.objectContaining({ productId: 'gehakt', actiePrijs: 3.99, door: 'klanten', telefoons: 2 })]);
    expect(twee.open).toEqual([]);
    expect(isGeldig(twee.aanbiedingen[0])).toBe(true);
  });

  it('andere prijs of einddatum telt als een andere aanbieding', () => {
    const r = telAanbiedingen([rij('a', 'gehakt', '399'), rij('b', 'gehakt', '349')], opties);
    expect(r.aanbiedingen).toEqual([]);
    expect(r.open).toHaveLength(2);
  });

  it('de beheerder gaat voor: geldt meteen en wint van klanten', () => {
    const r = telAanbiedingen(
      [rij('a', 'gehakt', '399'), rij('b', 'gehakt', '399'), rij('baas', 'gehakt', '375', '2026-10-27', { omschrijving: '30% korting' }), rij('c', 'kaas', '299')],
      opties,
    );
    expect(r.aanbiedingen).toEqual([expect.objectContaining({ productId: 'gehakt', actiePrijs: 3.75, door: 'beheerder', omschrijving: '30% korting' })]);
    expect(r.open.map((o) => o.productId)).toEqual(['kaas']);
  });

  it('negeert verlopen, onbekende en onzinnige aanbiedingen', () => {
    const r = telAanbiedingen(
      [
        rij('baas', 'gehakt', '399', '2026-10-20'), // verlopen
        rij('baas', 'onbekend', '100'),
        rij('baas', 'kaas', '450'), // duurder dan normaal
        rij('baas', 'kaas', '299', '2026-10-27', { vanaf: '2026-10-30' }), // begint na het einde
        { soort: 'melding', apparaat: 'baas', product: 'kaas', afdeling: 'kaas' },
      ],
      opties,
    );
    expect(r).toEqual({ aanbiedingen: [], open: [] });
  });

  it('neemt een begindatum mee (aanbieding vanaf woensdag)', () => {
    const r = telAanbiedingen([rij('baas', 'kaas', '299', '2026-11-03', { vanaf: '28-10-2026' })], opties);
    expect(r.aanbiedingen[0]).toMatchObject({ geldigVanaf: '2026-10-28', geldigTot: '2026-11-03' });
  });

  it('het gedeelde bestand bevat alleen geldige aanbiedingen', () => {
    for (const a of gedeeld.aanbiedingen) expect(isGeldig(a), a.productId).toBe(true);
  });
});
