import { describe, it, expect } from 'vitest';
import { leesInhoud, toonHoeveelheid } from '../src/planner/verpakking.js';
import { berekenKosten, maakSnelleKosten, gedeeldeVerseProducten } from '../src/planner/kosten.js';
import { maakWeekmenu, vervangMaaltijd, toegestaneRecepten } from '../src/planner/planner.js';
import producten from '../data/producten.json';
import recepten from '../data/recepten.json';
import categorieen from '../data/categorieen.json';

const productenOpId = new Map(producten.map((p) => [p.id, p]));
const houdbaar = Object.fromEntries(categorieen.map((c) => [c.id, c.houdbaar]));
const ctx = { productenOpId, houdbaar, voorraad: new Set() };
const recept = (id) => recepten.find((r) => r.id === id);
const basis = { budget: 80, personen: 4, aantal: 5, uitsluitingen: [], voorkeuren: [], nietLusten: '', seed: 1 };

// Een mini-wereld met precies bekende prijzen, om sommen na te rekenen.
const mini = {
  productenOpId: new Map([
    ['bloemkool', { id: 'bloemkool', naam: 'Bloemkool', inhoud: '1 stuk', prijs: 2, categorie: 'groente' }],
    ['rijst', { id: 'rijst', naam: 'Rijst', inhoud: '1 kg', prijs: 3, categorie: 'rijst' }],
    ['room', { id: 'room', naam: 'Room', inhoud: '250 ml', prijs: 1, categorie: 'zuivel' }],
  ]),
  houdbaar: { groente: false, rijst: true, zuivel: false },
};
const curry = { id: 'curry', naam: 'Curry', personen: 4, ingredienten: [{ product: 'bloemkool', hoeveelheid: 0.5 }, { product: 'rijst', hoeveelheid: 300 }] };
const soep = { id: 'soep', naam: 'Soep', personen: 4, ingredienten: [{ product: 'bloemkool', hoeveelheid: 0.5 }, { product: 'room', hoeveelheid: 125 }] };

describe('verpakking lezen', () => {
  it.each([
    ['500 g', 500, 'g'],
    ['2,5 kg', 2500, 'g'],
    ['1,5 L', 1500, 'ml'],
    ['75 cl', 750, 'ml'],
    ['6x330 ml', 1980, 'ml'],
    ['2x125 g', 250, 'g'],
    ['10 stuks', 10, 'stuk'],
    ['3 bollen', 3, 'stuk'],
  ])('%s → %d %s', (inhoud, hoeveelheid, eenheid) => {
    expect(leesInhoud(inhoud)).toEqual({ hoeveelheid, eenheid });
  });

  it('kan de inhoud van elk product in de catalogus lezen', () => {
    const onleesbaar = producten.filter((p) => !leesInhoud(p.inhoud)).map((p) => `${p.id}: ${p.inhoud}`);
    expect(onleesbaar).toEqual([]);
  });

  it('schrijft hoeveelheden leesbaar op', () => {
    expect(toonHoeveelheid(1500, 'g')).toBe('1,5 kg');
    expect(toonHoeveelheid(0.5, 'stuk')).toBe('½');
    expect(toonHoeveelheid(2.25, 'stuk')).toBe('2¼');
    expect(toonHoeveelheid(250, 'ml')).toBe('250 ml');
  });
});

describe('kosten', () => {
  it('rekent met hele verpakkingen', () => {
    const k = berekenKosten([curry], { personen: 4, ...mini });
    // ½ bloemkool → 1 bloemkool (€2), 300 g rijst → 1 kg (€3)
    expect(k.teBetalen).toBeCloseTo(5);
    expect(k.regels.find((r) => r.product.id === 'bloemkool').pakken).toBe(1);
  });

  it('telt een vers restje als verspilling, een houdbaar restje niet', () => {
    const k = berekenKosten([curry], { personen: 4, ...mini });
    expect(k.verspilling).toBeCloseTo(1); // halve bloemkool; de 700 g rijst blijft voorraad
    expect(k.regels.find((r) => r.product.id === 'rijst').houdbaar).toBe(true);
  });

  it('gebruikt de halve bloemkool die overblijft in een tweede gerecht', () => {
    const k = berekenKosten([curry, soep], { personen: 4, ...mini });
    expect(k.regels.find((r) => r.product.id === 'bloemkool').pakken).toBe(1);
    expect(k.teBetalen).toBeCloseTo(2 + 3 + 1);
    // Alleen de halve room (€0,50) gaat nog verloren.
    expect(k.verspilling).toBeCloseTo(0.5);
    expect(gedeeldeVerseProducten([curry, soep], mini.productenOpId, mini.houdbaar).get('bloemkool')).toEqual(['Curry', 'Soep']);
  });

  it('rekent de kosten per maaltijd naar verbruik', () => {
    const k = berekenKosten([curry, soep], { personen: 4, ...mini });
    expect(k.perMaaltijd[0].kosten).toBeCloseTo(1 + 0.9); // ½ bloemkool + 300 g rijst
    expect(k.perMaaltijd[1].kosten).toBeCloseTo(1 + 0.5);
    expect(k.perMaaltijd[1].perPersoon).toBeCloseTo(1.5 / 4);
  });

  it('schaalt naar het aantal personen', () => {
    const k = berekenKosten([curry], { personen: 8, ...mini });
    expect(k.regels.find((r) => r.product.id === 'bloemkool').nodig).toBeCloseTo(1);
    expect(k.regels.find((r) => r.product.id === 'rijst').nodig).toBeCloseTo(600);
  });

  it('rekent niets voor wat je al in huis hebt', () => {
    const k = berekenKosten([curry], { personen: 4, ...mini, voorraad: new Set(['rijst']) });
    expect(k.teBetalen).toBeCloseTo(2);
    expect(k.regels.find((r) => r.product.id === 'rijst')).toMatchObject({ pakken: 0, inHuis: true });
  });

  it('snelle berekening geeft hetzelfde als de volledige', () => {
    const snel = maakSnelleKosten({ personen: 3, ...ctx, voorraad: new Set(['jumbo-uien-1-kg']) });
    for (let i = 0; i + 4 <= recepten.length; i += 3) {
      const set = recepten.slice(i, i + 4);
      const vol = berekenKosten(set, { personen: 3, ...ctx, voorraad: new Set(['jumbo-uien-1-kg']) });
      expect(snel(set).teBetalen).toBeCloseTo(vol.teBetalen);
      expect(snel(set).verspilling).toBeCloseTo(vol.verspilling);
    }
  });

  it('kan alle recepten doorrekenen (alle producten bestaan)', () => {
    for (const r of recepten) expect(() => berekenKosten([r], { personen: 2, ...ctx }), r.id).not.toThrow();
  });
});

describe('weekmenu', () => {
  it('blijft onder het budget', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const menu = maakWeekmenu(recepten, { ...basis, seed }, ctx);
      expect(menu.maaltijden).toHaveLength(5);
      expect(menu.binnenBudget).toBe(true);
      expect(menu.kosten.teBetalen).toBeLessThanOrEqual(basis.budget);
    }
  });

  it('kiest geen recept twee keer', () => {
    const menu = maakWeekmenu(recepten, { ...basis, aantal: 7 }, ctx);
    expect(new Set(menu.maaltijden.map((r) => r.id)).size).toBe(7);
  });

  it('meldt het als het budget te krap is, en geeft dan het goedkoopste menu', () => {
    const menu = maakWeekmenu(recepten, { ...basis, budget: 10 }, ctx);
    expect(menu.binnenBudget).toBe(false);
    expect(menu.melding).toMatch(/budget/);
    const ruim = maakWeekmenu(recepten, { ...basis, budget: 500 }, ctx);
    expect(menu.kosten.teBetalen).toBeLessThanOrEqual(ruim.kosten.teBetalen);
  });

  it('houdt rekening met uitsluitingen', () => {
    const menu = maakWeekmenu(recepten, { ...basis, uitsluitingen: ['vlees', 'vis'] }, ctx);
    for (const r of menu.maaltijden) expect(r.bevat, r.id).toEqual([]);
  });

  it('slaat recepten over met ingrediënten die je niet lust', () => {
    const toegestaan = toegestaneRecepten(recepten, { nietLusten: 'champignons, bloemkool' }, productenOpId);
    expect(toegestaan.map((r) => r.id)).not.toContain('risotto-champignons');
    expect(toegestaan.map((r) => r.id)).not.toContain('bloemkoolcurry');
    expect(toegestaan.length).toBeGreaterThan(20);
  });

  it('geeft dezelfde suggestie bij dezelfde seed en een andere bij een andere seed', () => {
    const a = maakWeekmenu(recepten, basis, ctx).maaltijden.map((r) => r.id);
    const b = maakWeekmenu(recepten, basis, ctx).maaltijden.map((r) => r.id);
    expect(a).toEqual(b);
    const anders = [2, 3, 4, 5, 6].some((seed) => maakWeekmenu(recepten, { ...basis, seed }, ctx).maaltijden.map((r) => r.id).sort().join() !== [...a].sort().join());
    expect(anders).toBe(true);
  });

  it('combineert verse ingrediënten: minder verspilling dan losse willekeurige keuzes', () => {
    const menu = maakWeekmenu(recepten, { ...basis, personen: 2 }, ctx);
    // Vergelijk met 20 willekeurige menu's van dezelfde grootte.
    let s = 3;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const willekeurig = Array.from({ length: 20 }, () => {
      const keuze = [...recepten].sort(() => rnd() - 0.5).slice(0, 5);
      return berekenKosten(keuze, { personen: 2, ...ctx }).verspilling;
    });
    const gemiddeld = willekeurig.reduce((a, b) => a + b) / willekeurig.length;
    expect(menu.kosten.verspilling).toBeLessThan(gemiddeld / 2);
  });

  it('geeft afwisseling: recepten van vorige weken komen minder snel terug', () => {
    let recent = [];
    const gezien = new Set();
    for (let week = 1; week <= 4; week++) {
      const menu = maakWeekmenu(recepten, { ...basis, seed: week }, ctx, { recent });
      const ids = menu.maaltijden.map((r) => r.id);
      const herhaald = ids.filter((id) => recent.includes(id));
      expect(herhaald.length, `week ${week}: ${herhaald}`).toBeLessThanOrEqual(1);
      ids.forEach((id) => gezien.add(id));
      recent = [...ids, ...recent].slice(0, 21);
    }
    expect(gezien.size).toBeGreaterThanOrEqual(17); // 4 weken × 5 maaltijden, bijna allemaal verschillend
  });

  it('vervangt één maaltijd en laat de rest staan', () => {
    const menu = maakWeekmenu(recepten, basis, ctx);
    const nieuw = vervangMaaltijd(recepten, menu.maaltijden, 2, basis, ctx);
    expect(nieuw.maaltijden).toHaveLength(5);
    expect(nieuw.maaltijden[2].id).not.toBe(menu.maaltijden[2].id);
    for (const i of [0, 1, 3, 4]) expect(nieuw.maaltijden[i].id).toBe(menu.maaltijden[i].id);
    expect(new Set(nieuw.maaltijden.map((r) => r.id)).size).toBe(5);
  });

  it('houdt vastgezette maaltijden in het menu', () => {
    const menu = maakWeekmenu(recepten, basis, ctx, { vast: ['hachee', 'lasagne'] });
    expect(menu.maaltijden.map((r) => r.id)).toEqual(expect.arrayContaining(['hachee', 'lasagne']));
  });

  it('meldt het als er te weinig recepten passen', () => {
    // Maar 3 recepten om uit te kiezen, terwijl er 5 maaltijden nodig zijn.
    const menu = maakWeekmenu(recepten.slice(0, 3), { ...basis, aantal: 5 }, ctx);
    expect(menu.melding).toMatch(/passen maar/);
  });
});

describe('recepten.json', () => {
  it('heeft unieke ids, bestaande producten en geldige velden', () => {
    expect(new Set(recepten.map((r) => r.id)).size).toBe(recepten.length);
    const bevatGeldig = new Set(['varken', 'rund', 'kip', 'vis']);
    for (const r of recepten) {
      expect(r.personen, r.id).toBeGreaterThan(0);
      expect(r.ingredienten.length, r.id).toBeGreaterThan(0);
      for (const b of r.bevat) expect(bevatGeldig.has(b), `${r.id}: ${b}`).toBe(true);
      for (const i of r.ingredienten) {
        expect(productenOpId.has(i.product), `${r.id}: ${i.product}`).toBe(true);
        expect(i.hoeveelheid, `${r.id}: ${i.product}`).toBeGreaterThan(0);
      }
    }
  });

  it('heeft vegetarische recepten zonder vlees of vis als ingrediënt', () => {
    const vleesCategorieen = new Set(['vlees', 'kip', 'vis', 'vleeswaren']);
    for (const r of recepten.filter((r) => r.bevat.length === 0)) {
      for (const i of r.ingredienten) expect(vleesCategorieen.has(productenOpId.get(i.product).categorie), `${r.id}: ${i.product}`).toBe(false);
    }
  });
});
