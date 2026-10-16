import { describe, it, expect } from 'vitest';
import { bepaalCategorie, leesInhoudUitNaam } from '../src/data/import.js';
import { leesInhoud } from '../src/planner/verpakking.js';
import regelsBestand from '../data/categorie-regels.json';

const { regels } = regelsBestand;

describe('inhoud uit de productnaam', () => {
  it.each([
    ['Coca-Cola Zero Sugar 1,5 L', '', '1,5 L'],
    ['Jumbo Halfvolle Melk 500ML', '', '500 ml'],
    ['Spa Reine 6 x 1,5 L', '', '6x1,5 L'],
    ['AXE Douchegel 250 ML x 6 stuks', '', '6x250 ml'],
    ['Jumbo Scharreleieren L-XL 10 Stuks', '', '10 stuks'],
    ['Page Puur Toiletpapier 4-rollen', '', '4 rollen'],
    ['Jumbo Gemengd Slagersgehakt Gekruid ca. 500 g', '', '500 g'],
    ['Tripel Karmeliet Bier Fles 750 ml', '75 ml', '750 ml'], // naam gaat voor op een fout formaat
    ['Jumbo Aardappelen Kruimig 3 kg', '', '3 kg'],
    ['Patak\'s Ginger Mango Chutney 340 gram', '', '340 g'],
    ['Jumbo Bloemkool', '', '1 stuk'],
    ['Jumbo Paprika', '2 stuks', '2 stuks'], // valt terug op het opgegeven formaat
  ])('%s → %s', (naam, formaat, verwacht) => {
    expect(leesInhoudUitNaam(naam, formaat)).toBe(verwacht);
  });

  it('geeft altijd iets wat de kostenberekening kan lezen', () => {
    for (const naam of ['Iets zonder maat', 'Pak 2 x 24 Stuks', 'Wijn 75cl', 'Bier 24x30cl']) {
      expect(leesInhoud(leesInhoudUitNaam(naam)), naam).not.toBeNull();
    }
  });
});

describe('afdeling bepalen', () => {
  it.each([
    ['Jumbo Bloemkool', 'groente'],
    ['Jumbo Verse Halfvolle Melk 1 L', 'zuivel'],
    ['Jumbo Chocolademelk 1 L', 'zuivel'],
    ["Tony's Chocolonely Melk Pecan Crunch 90g", 'snoep'],
    ['Calvé Pindakaas 350 g', 'broodbeleg'],
    ['Jumbo Kaas Jong Belegen 48+ Plakken 190 g', 'kaas'],
    ['Whiskas Kattenvoer met Kip 12x85g', 'huisdier'],
    ['Jumbo Kipfiletblokjes 600 g', 'kip'],
    ['Jumbo Kabeljauwfilet Naturel 2 Stuks', 'vis'],
    ['Jumbo Rucola 150 g', 'salades'],
    ['Coca-Cola Zero Sugar 1,5 L', 'frisdrank'],
    ['Jumbo Kokosmelk 18% Vet 400 ml', 'wereldkeuken'],
    ['Jumbo Friszoet & Sappig Elstar 1,5 kg', 'fruit'],
    ['Heineken Pils 6 x 330 ml', 'bier'],
    ['Jumbo Rundergehakt 500 g', 'vlees'],
  ])('%s → %s', (naam, categorie) => {
    expect(bepaalCategorie(naam, regels)).toBe(categorie);
  });

  it('geeft null als geen enkele regel past', () => {
    expect(bepaalCategorie('Xyzzy 12', regels)).toBeNull();
  });
});
