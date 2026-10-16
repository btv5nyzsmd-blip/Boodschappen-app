// Startpunt van de app: laadt de gegevens, houdt de toestand bij en tekent het scherm.
import './stijl.css';
import catalogus from '../data/producten.json';
import categorieen from '../data/categorieen.json';
import { bouwNetwerk } from './route/looppaden.js';
import { zoekProducten, normaliseer } from './lijst/zoeken.js';
import * as L from './lijst/lijst.js';
import * as opslag from './lijst/opslag.js';
import { lijstScherm, zoekResultaten } from './ui/lijst-scherm.js';
import { routeScherm } from './ui/route-scherm.js';
import { kaartScherm } from './ui/kaart.js';
import { esc } from './ui/html.js';

// Alle winkels in data/winkels/ worden automatisch ingeladen.
const winkelBestanden = import.meta.glob('../data/winkels/*.json', { eager: true, import: 'default' });
const winkels = Object.entries(winkelBestanden).map(([pad, winkel]) => ({ bestand: pad.split('/').pop(), winkel }));

const VOORBEELDLIJST = [
  ['jumbo-halfvolle-melk-1-l', 2], ['jumbo-bananen-5-stuks', 1], ['jumbo-spaghetti-500-g', 1],
  ['jumbo-rundergehakt-500-g', 1], ['jumbo-pastasaus-basilicum-500-g', 1], ['jumbo-volkoren-brood-heel-800-g', 1],
  ['jumbo-geraspte-kaas-jong-belegen-200-g', 1], ['coca-cola-zero-sugar-1-5-l', 2], ['jumbo-scharreleieren-10-stuks', 1],
  ['page-toiletpapier-12-rollen', 1], ['jumbo-champignons-250-g', 1], ['jumbo-pizza-margherita-1-stuk', 2],
];

const st = {
  tab: location.hash === '#route' || location.hash === '#kaart' ? location.hash.slice(1) : 'lijst',
  zoek: '',
  zoekResultaten: [],
  bevestigLeeg: false,
  voorbeeldMelding: false,
  categorieen,
  categorieNamen: Object.fromEntries(categorieen.map((c) => [c.id, c.naam])),
  eigenProducten: opslag.leesEigenProducten(),
  lijst: opslag.leesLijst(),
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

function alleProducten() {
  return [...catalogus, ...st.eigenProducten];
}

function bijwerken() {
  st.productenOpId = new Map(alleProducten().map((p) => [p.id, p]));
  try {
    st.routeInfo = L.routeVoorLijst(huidigeWinkel(), st.lijst, st.productenOpId, netwerk());
  } catch (fout) {
    st.routeInfo = { fout: fout.message, stops: [], nietGevonden: [] };
  }
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
};

function teken() {
  const openTeVinken = st.lijst.filter((r) => !r.afgevinkt).length;
  const scherm = st.tab === 'lijst' ? lijstScherm(st) : st.tab === 'route' ? routeScherm(st) : kaartScherm({ ...st, winkel: huidigeWinkel() });

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
      ${['lijst', 'route', 'kaart']
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
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'winkel') {
    st.winkelIndex = Number(e.target.value);
    opslag.bewaarWinkelKeuze(winkels[st.winkelIndex].bestand);
    bijwerken();
    teken();
  } else if (e.target.dataset.actie === 'vink') {
    wijzigLijst(L.wisselAfgevinkt(st.lijst, e.target.dataset.id));
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
      wijzigLijst([]);
      break;
    case 'opruimen':
      wijzigLijst(L.verwijderAfgevinkt(st.lijst));
      break;
    case 'naar-route':
      naarTab('route');
      break;
    case 'naar-lijst':
      naarTab('lijst');
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
