// Startpunt van de app: laadt de gegevens, houdt de toestand bij en tekent het scherm.
import './stijl.css';
import catalogus from '../data/producten.json';
import categorieen from '../data/categorieen.json';
import recepten from '../data/recepten.json';
import bron from '../data/bron.json';
import { bouwNetwerk } from './route/looppaden.js';
import { zoekProducten, normaliseer, bereidZoekenVoor } from './lijst/zoeken.js';
import * as L from './lijst/lijst.js';
import * as opslag from './lijst/opslag.js';
import { lijstScherm, zoekResultaten } from './ui/lijst-scherm.js';
import { routeScherm } from './ui/route-scherm.js';
import { kaartScherm } from './ui/kaart.js';
import { menuScherm } from './ui/menu-scherm.js';
import { maakWeekmenu, vervangMaaltijd } from './planner/planner.js';
import { berekenKosten, gedeeldeVerseProducten } from './planner/kosten.js';
import { esc } from './ui/html.js';

// Alle winkels in data/winkels/ worden automatisch ingeladen.
const winkelBestanden = import.meta.glob('../data/winkels/*.json', { eager: true, import: 'default' });
const winkels = Object.entries(winkelBestanden).map(([pad, winkel]) => ({ bestand: pad.split('/').pop(), winkel }));

const VOORBEELDLIJST = [
  ['jumbo-verse-halfvolle-melk-1-l-498518pak', 2], ['jumbo-dole-bananen-5-stuks-532148zk', 1], ['jumbo-s-spaghetti-500-g-710328zk', 1],
  ['jumbo-rundergehakt-500-g-131278bak', 1], ['jumbo-pesto-alla-genovese-190-g-747995pot', 1], ['jumbo-boeren-tijger-volkoren-631885stk', 1],
  ['jumbo-geraspte-kaas-jong-belegen-48-175-g-395036zk', 1], ['coca-cola-zero-sugar-1,5-l-429181fls', 2], ['jumbo-scharreleieren-l-xl-10-stuks-610397stk', 1],
  ['page-puur-toiletpapier-4-rollen-507415zk', 1], ['jumbo-fijne-champignons-250-g-304662pak', 1], ['jumbo-pizza-margherita-3-x-300-g-211767pak', 1],
];

const datum = new Date(bron.bijgewerkt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

const st = {
  tab: ['#menu', '#route', '#kaart'].includes(location.hash) ? location.hash.slice(1) : 'lijst',
  zoek: '',
  zoekResultaten: [],
  bevestigLeeg: false,
  voorbeeldMelding: false,
  categorieen,
  categorieNamen: Object.fromEntries(categorieen.map((c) => [c.id, c.naam])),
  eigenProducten: opslag.leesEigenProducten(),
  afdelingen: opslag.leesAfdelingen(),
  bronTekst: `Prijzen van ${datum}, via de open data van Checkjebon.nl. Aanbiedingen zitten er nog niet in.`,
  lijst: opslag.leesLijst(),
  positie: opslag.leesPositie(),
  recepten,
  houdbaar: Object.fromEntries(categorieen.map((c) => [c.id, c.houdbaar])),
  planner: opslag.leesPlanner({
    instellingen: { budget: 50, personen: 2, aantal: 5, uitsluitingen: [], voorkeuren: [], nietLusten: '', seed: 1 },
    menu: [], // recept-ids
    vast: [], // recept-ids die blijven staan bij een nieuwe suggestie
    voorraad: [], // product-ids die je al in huis hebt
    toegevoegd: {}, // product-id → aantal dat vanuit het menu op de lijst is gezet
  }),
};

// Eerste keer openen: een voorbeeldlijst, zodat je meteen ziet wat de app doet.
try {
  if (localStorage.getItem('boodschappen.lijst.v1') === null) {
    st.lijst = VOORBEELDLIJST.reduce((lijst, [id, n]) => L.voegToe(lijst, id, n), []);
    st.voorbeeldMelding = true;
    opslag.bewaarLijst(st.lijst);
  }
} catch {
  /* geen opslag beschikbaar: begin met een lege lijst */
}

const gekozen = opslag.leesWinkelKeuze();
st.winkelIndex = Math.max(0, winkels.findIndex((w) => w.bestand === gekozen));

function huidigeWinkel() {
  return winkels[st.winkelIndex].winkel;
}

const netwerken = new Map();
function netwerk() {
  const w = huidigeWinkel();
  if (!netwerken.has(w)) netwerken.set(w, bouwNetwerk(w));
  return netwerken.get(w);
}

/** Catalogus + eigen producten, met de afdelingen die je zelf hebt gekozen. */
function alleProducten() {
  return st.alleProducten;
}

function bijwerken() {
  st.alleProducten = [...catalogus, ...st.eigenProducten].map((p) =>
    st.afdelingen[p.id] && st.afdelingen[p.id] !== p.categorie ? { ...p, categorie: st.afdelingen[p.id] } : p,
  );
  st.productenOpId = new Map(st.alleProducten.map((p) => [p.id, p]));
  try {
    // Pas als je iets hebt afgevinkt ben je "onderweg"; anders begint de route bij de ingang.
    const onderweg = st.lijst.some((r) => r.afgevinkt);
    st.routeInfo = L.routeVoorLijst(huidigeWinkel(), st.lijst, st.productenOpId, netwerk(), onderweg ? st.positie : null);
  } catch (fout) {
    st.routeInfo = { fout: fout.message, stops: [], nietGevonden: [] };
  }
  bijwerkenMenu();
}

// ---------- weekmenu ----------

function plannerCtx() {
  return { productenOpId: st.productenOpId, houdbaar: st.houdbaar, voorraad: new Set(st.planner.voorraad) };
}

/** Rekent het huidige menu (opnieuw) door, bijv. na "heb ik al" of een ander aantal personen. */
function bijwerkenMenu(melding = st.menu?.melding ?? null) {
  const maaltijden = st.planner.menu.map((id) => recepten.find((r) => r.id === id)).filter(Boolean);
  if (maaltijden.length === 0) {
    st.menu = null;
    return;
  }
  const kosten = berekenKosten(maaltijden, { personen: st.planner.instellingen.personen, ...plannerCtx() });
  st.menu = { maaltijden, kosten, melding, gedeeld: gedeeldeVerseProducten(maaltijden, st.productenOpId, st.houdbaar) };
}

function wijzigPlanner(wijziging, { opnieuwRekenen = false, melding } = {}) {
  st.planner = { ...st.planner, ...wijziging };
  opslag.bewaarPlanner(st.planner);
  if (opnieuwRekenen) bijwerkenMenu(melding);
  teken();
}

function maakMenu(seed) {
  const ins = { ...st.planner.instellingen, seed };
  const resultaat = maakWeekmenu(recepten, ins, plannerCtx(), { vast: st.planner.vast });
  wijzigPlanner({ instellingen: ins, menu: resultaat.maaltijden.map((r) => r.id), bericht: null }, { opnieuwRekenen: true, melding: resultaat.melding });
}

/** Zet het menu op de boodschappenlijst. Nog een keer drukken vervangt wat er eerder vanuit het menu op stond. */
function menuNaarLijst() {
  let lijst = st.lijst;
  for (const [id, n] of Object.entries(st.planner.toegevoegd)) lijst = L.wijzigAantal(lijst, id, -n);
  const toegevoegd = {};
  for (const r of st.menu.kosten.regels) {
    if (r.pakken > 0) {
      lijst = L.voegToe(lijst, r.product.id, r.pakken);
      toegevoegd[r.product.id] = r.pakken;
    }
  }
  st.planner = { ...st.planner, toegevoegd, bericht: `${Object.keys(toegevoegd).length} producten staan op je boodschappenlijst.` };
  opslag.bewaarPlanner(st.planner);
  wijzigLijst(lijst);
}

function zetPositie(sectieId) {
  st.positie = sectieId;
  opslag.bewaarPositie(sectieId);
}

function wijzigLijst(nieuw) {
  st.lijst = nieuw;
  st.voorbeeldMelding = false;
  opslag.bewaarLijst(st.lijst);
  bijwerken();
  teken();
}

// ---------- tekenen ----------

const app = document.getElementById('app');

const ICONEN = {
  lijst: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />',
  route: '<path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a4 4 0 0 1 4-4h2M18 9v6a4 4 0 0 1-4 4h-2" />',
  kaart: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" />',
  menu: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />',
};
const SCHERMEN = { menu: menuScherm, lijst: lijstScherm, route: routeScherm, kaart: (s) => kaartScherm({ ...s, winkel: huidigeWinkel() }) };

function teken() {
  const openTeVinken = st.lijst.filter((r) => !r.afgevinkt).length;
  const scherm = SCHERMEN[st.tab](st);

  const winkelKeuze =
    winkels.length > 1
      ? `<select id="winkel" aria-label="Winkel">${winkels.map((w, i) => `<option value="${i}" ${i === st.winkelIndex ? 'selected' : ''}>${esc(w.winkel.naam)}</option>`).join('')}</select>`
      : `<span>${esc(huidigeWinkel().naam)}</span>`;

  app.innerHTML = `
    <main class="app">
      <header class="kop"><h1>Boodschappenroute</h1><span class="winkel">${winkelKeuze}</span></header>
      ${scherm}
    </main>
    <nav class="nav" aria-label="Schermen">
      ${['menu', 'lijst', 'route', 'kaart']
        .map(
          (t) => `<button data-tab="${t}" ${st.tab === t ? 'aria-current="page"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONEN[t]}</svg>
            ${t[0].toUpperCase() + t.slice(1)}${t === 'route' && st.lijst.length ? ` <span class="teller">${openTeVinken} open</span>` : ''}
          </button>`,
        )
        .join('')}
    </nav>`;
}

function tekenZoekresultaten() {
  const vak = document.getElementById('zoekresultaten');
  if (vak) vak.innerHTML = zoekResultaten(st);
}

function naarTab(tab) {
  st.tab = tab;
  st.bevestigLeeg = false;
  history.replaceState(null, '', tab === 'lijst' ? location.pathname : `#${tab}`);
  teken();
  window.scrollTo(0, 0);
}

// ---------- gebeurtenissen ----------

app.addEventListener('input', (e) => {
  if (e.target.id === 'zoek') {
    st.zoek = e.target.value;
    st.zoekResultaten = zoekProducten(alleProducten(), st.zoek, st.categorieNamen);
    tekenZoekresultaten();
  } else if (e.target.id === 'budget' || e.target.id === 'niet-lusten') {
    // Alleen onthouden, niet opnieuw tekenen: dan blijft het toetsenbord open.
    const ins = { ...st.planner.instellingen };
    if (e.target.id === 'budget') ins.budget = Math.max(0, Number(e.target.value.replace(',', '.')) || 0);
    else ins.nietLusten = e.target.value;
    st.planner = { ...st.planner, instellingen: ins };
    opslag.bewaarPlanner(st.planner);
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'winkel') {
    st.winkelIndex = Number(e.target.value);
    opslag.bewaarWinkelKeuze(winkels[st.winkelIndex].bestand);
    bijwerken();
    teken();
  } else if (e.target.dataset.actie === 'afdeling' && e.target.value) {
    // Zelf gekozen afdeling onthouden; het product komt dan meteen in de route.
    st.afdelingen = { ...st.afdelingen, [e.target.dataset.id]: e.target.value };
    opslag.bewaarAfdelingen(st.afdelingen);
    bijwerken();
    teken();
  } else if (e.target.dataset.actie === 'menu-voorraad') {
    const id = e.target.dataset.id;
    const voorraad = e.target.checked ? [...st.planner.voorraad, id] : st.planner.voorraad.filter((v) => v !== id);
    wijzigPlanner({ voorraad }, { opnieuwRekenen: true });
  } else if (e.target.dataset.actie === 'vink') {
    const id = e.target.dataset.id;
    // Afvinken = je staat nu bij dit product. De rest van de route gaat vanaf hier.
    if (e.target.checked) zetPositie(L.sectieVanProduct(huidigeWinkel(), st.productenOpId.get(id)));
    wijzigLijst(L.wisselAfgevinkt(st.lijst, id));
  }
});

app.addEventListener('click', (e) => {
  const tabKnop = e.target.closest('[data-tab]');
  if (tabKnop) return naarTab(tabKnop.dataset.tab);

  const knop = e.target.closest('button[data-actie]');
  if (!knop) return;
  const id = knop.dataset.id;

  switch (knop.dataset.actie) {
    case 'toevoegen':
      // Zoekveld leegmaken en focus houden, zodat je meteen het volgende product typt.
      st.zoek = '';
      st.zoekResultaten = [];
      wijzigLijst(L.voegToe(st.lijst, id));
      focusZoek();
      break;
    case 'eigen-toevoegen': {
      const categorie = document.getElementById('eigen-categorie').value;
      const naam = st.zoek.trim();
      if (!categorie) {
        document.getElementById('eigen-categorie').focus();
        return;
      }
      const product = { id: `eigen-${normaliseer(naam).replace(/\s+/g, '-')}`, merk: '', naam, inhoud: '', categorie, eigen: true };
      if (!st.eigenProducten.some((p) => p.id === product.id)) {
        st.eigenProducten = [...st.eigenProducten, product];
        opslag.bewaarEigenProducten(st.eigenProducten);
      }
      st.zoek = '';
      st.zoekResultaten = [];
      wijzigLijst(L.voegToe(st.lijst, product.id));
      break;
    }
    case 'plus':
      wijzigLijst(L.wijzigAantal(st.lijst, id, 1));
      break;
    case 'min':
      wijzigLijst(L.wijzigAantal(st.lijst, id, -1));
      break;
    case 'leeg':
      st.bevestigLeeg = true;
      teken();
      break;
    case 'leeg-annuleer':
      st.bevestigLeeg = false;
      teken();
      break;
    case 'leeg-bevestigd':
      st.bevestigLeeg = false;
      zetPositie(null);
      wijzigLijst([]);
      break;
    case 'opruimen':
      zetPositie(null);
      wijzigLijst(L.verwijderAfgevinkt(st.lijst));
      break;
    case 'vanaf-ingang':
      zetPositie(null);
      bijwerken();
      teken();
      break;
    case 'naar-route':
      naarTab('route');
      break;
    case 'naar-lijst':
      naarTab('lijst');
      break;

    // Weekmenu
    case 'menu-stap': {
      const veld = knop.dataset.veld;
      const grenzen = { personen: [1, 8], aantal: [1, 7] }[veld];
      const waarde = Math.min(grenzen[1], Math.max(grenzen[0], st.planner.instellingen[veld] + Number(knop.dataset.stap)));
      wijzigPlanner({ instellingen: { ...st.planner.instellingen, [veld]: waarde } }, { opnieuwRekenen: veld === 'personen' });
      break;
    }
    case 'menu-chip': {
      const groep = knop.dataset.groep;
      const huidig = st.planner.instellingen[groep];
      const nieuw = huidig.includes(id) ? huidig.filter((x) => x !== id) : [...huidig, id];
      wijzigPlanner({ instellingen: { ...st.planner.instellingen, [groep]: nieuw } });
      break;
    }
    case 'menu-maak':
      maakMenu(st.planner.instellingen.seed);
      break;
    case 'menu-nieuw':
      maakMenu(st.planner.instellingen.seed + 1);
      break;
    case 'menu-vast': {
      const vast = st.planner.vast.includes(id) ? st.planner.vast.filter((x) => x !== id) : [...st.planner.vast, id];
      wijzigPlanner({ vast });
      break;
    }
    case 'menu-ander': {
      const ins = { ...st.planner.instellingen, seed: st.planner.instellingen.seed + 1 };
      const resultaat = vervangMaaltijd(recepten, st.menu.maaltijden, Number(knop.dataset.index), ins, plannerCtx());
      wijzigPlanner({ instellingen: ins, menu: resultaat.maaltijden.map((r) => r.id), bericht: null }, { opnieuwRekenen: true, melding: resultaat.melding });
      break;
    }
    case 'menu-naar-lijst':
      menuNaarLijst();
      break;
  }
});

function focusZoek() {
  const veld = document.getElementById('zoek');
  if (veld) {
    veld.focus();
    veld.setSelectionRange(veld.value.length, veld.value.length);
  }
}

bijwerken();
teken();
// Zoekindex opbouwen zodra de telefoon even niets te doen heeft.
(window.requestIdleCallback ?? ((f) => setTimeout(f, 300)))(() => bereidZoekenVoor(st.alleProducten, st.categorieNamen));
