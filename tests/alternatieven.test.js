import { describe, it, expect } from 'vitest';
import { zoekAlternatieven } from '../src/lijst/alternatieven.js';
import { voegToe, vervangProduct } from '../src/lijst/lijst.js';
import producten from '../data/producten.json';

const opId = new Map(producten.map((p) => [p.id, p]));
const alt = (id) => zoekAlternatieven(opId.get(id), producten);

describe('alternatieven', () => {
  it('geeft hooguit twee vervangers uit dezelfde afdeling, niet het product zelf', () => {
    const melk = opId.get('jumbo-verse-halfvolle-melk-1-l-498518pak');
    const a = alt(melk.id);
    expect(a).toHaveLength(2);
    for (const p of a) {
      expect(p.id).not.toBe(melk.id);
      expect(p.categorie).toBe(melk.categorie);
      expect(p.naam).toMatch(/halfvolle melk/i);
    }
  });

  it('stelt hetzelfde soort product voor', () => {
    expect(alt('jumbo-paprika-rood-641085stk').every((p) => /paprika/i.test(p.naam))).toBe(true);
    expect(alt('jumbo-tofu-naturel-375g-680366stk').every((p) => /tofu/i.test(p.naam))).toBe(true);
    expect(alt('jumbo-rundergehakt-500-g-131278bak').every((p) => /gehakt/i.test(p.naam))).toBe(true);
  });

  it('kiest bij voorkeur een vergelijkbare verpakking', () => {
    const [eerste] = alt('jumbo-pesto-alla-genovese-190-g-747995pot');
    expect(eerste.naam).toMatch(/pesto/i);
  });

  it('geeft niets als er geen echte vervanger is', () => {
    const vreemd = { id: 'x', naam: 'Xyzzy Wonderproduct', inhoud: '1 stuk', prijs: 2, categorie: 'groente' };
    expect(zoekAlternatieven(vreemd, producten)).toEqual([]);
  });
});

describe('vervangen op de lijst', () => {
  it('neemt het aantal over en zet het alternatief terug in de route', () => {
    let lijst = voegToe([], 'a', 2);
    lijst = [{ ...lijst[0], overgeslagen: true }];
    expect(vervangProduct(lijst, 'a', 'b')).toEqual([{ productId: 'b', aantal: 2, afgevinkt: false }]);
  });

  it('telt op als het alternatief al op de lijst staat', () => {
    const lijst = voegToe(voegToe([], 'a', 2), 'b', 1);
    expect(vervangProduct(lijst, 'a', 'b')).toEqual([{ productId: 'b', aantal: 3, afgevinkt: false, overgeslagen: false }]);
  });
});
