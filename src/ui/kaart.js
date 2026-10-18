// Scherm "Kaart": interactieve plattegrond (zoomen, schuiven, draaien) met de route, zoals een navigatie-app.
// Inzoomen, schuiven en draaien gebeurt in kaart-gebaren.js; dit bestand tekent alleen.
import { esc, meters } from './html.js';
import { volgendeStop, vink } from './route-scherm.js';
import { alsViewBox, heleWinkel, middenVan, leesbaar, normaliseerHoek } from './kaart-beeld.js';

// Bij een gedraaide kaart blijven tekst en stopnummers rechtop; tekst langs een pad blijft
// langs dat pad lopen, maar staat nooit op z'n kop.
const rechtop = (hoek) => (hoek ? `rotate(${(-hoek).toFixed(1)})` : '');
const labelDraai = (l, hoek) => {
  const r = (l.draai ? leesbaar(l.draai + hoek) : 0) - hoek;
  return Math.abs(r) < 0.05 ? '' : `rotate(${r.toFixed(1)} ${l.x} ${l.y})`;
};
const kaartDraai = (winkel, hoek) => {
  const m = middenVan(winkel);
  return hoek ? `rotate(${hoek.toFixed(1)} ${m.x} ${m.y})` : '';
};

/** Draait een getekende kaart zonder alles opnieuw te tekenen (tijdens het draaien met je vingers). */
export function zetKaartHoek(svg, winkel, hoek) {
  svg.querySelector('.draaibaar')?.setAttribute('transform', kaartDraai(winkel, hoek));
  for (const el of svg.querySelectorAll('[data-rechtop]')) el.setAttribute('transform', rechtop(hoek));
  for (const el of svg.querySelectorAll('text.afdeling')) {
    el.setAttribute('transform', labelDraai({ x: el.getAttribute('x'), y: el.getAttribute('y'), draai: Number(el.dataset.draai) || 0 }, hoek));
  }
  const kompas = svg.parentElement?.querySelector('[data-actie=kaart-recht]');
  if (kompas) {
    kompas.hidden = Math.abs(normaliseerHoek(hoek)) < 0.5;
    kompas.querySelector('svg')?.style.setProperty('transform', `rotate(${hoek.toFixed(1)}deg)`);
  }
}

/** Punten om de ±4 meter langs een looppad, met de richting, voor de pijltjes. */
export function pijlpunten(lijn, afstand = 4) {
  const punten = [];
  let tegoed = afstand / 2;
  for (let i = 1; i < lijn.length; i++) {
    const a = lijn[i - 1];
    const b = lijn[i];
    const lengte = Math.hypot(b.x - a.x, b.y - a.y);
    const hoek = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    let pos = tegoed;
    while (pos < lengte) {
      punten.push({ x: a.x + ((b.x - a.x) * pos) / lengte, y: a.y + ((b.y - a.y) * pos) / lengte, hoek });
      pos += afstand;
    }
    tegoed = pos - lengte;
  }
  return punten;
}

const lijnPunten = (lijn) => lijn.map((p) => `${p.x},${p.y}`).join(' ');

/** Welke stop toont de kaart onderin: de gekozen stop, anders de volgende. */
export function getoondeStop(st) {
  const stops = st.routeInfo?.stops ?? [];
  const gekozen = st.kaart.gekozen;
  if (gekozen !== null && gekozen < stops.length) return gekozen;
  return volgendeStop(stops);
}

export function kaartScherm(st) {
  const { winkel, routeInfo } = st;
  const route = routeInfo?.route;
  const stops = routeInfo?.stops ?? [];
  const vanaf = routeInfo?.vanaf;
  const volgende = volgendeStop(stops);
  const getoond = getoondeStop(st);
  const hoek = st.kaart.hoek ?? 0;
  const beeld = st.kaart.beeld ?? heleWinkel(winkel, 0.75, hoek);

  const vloer = winkel.omtrek
    ? `<polygon class="vloer" points="${winkel.omtrek.map(([x, y]) => `${x},${y}`).join(' ')}" />`
    : `<rect class="vloer" x="0" y="0" width="${winkel.breedte}" height="${winkel.diepte}" />`;
  const schappen = (winkel.schappen ?? [])
    .map((s) => `<rect class="schap ${s.soort === 'kassa' ? 'kassa' : ''}" x="${s.x}" y="${s.y}" width="${s.breedte}" height="${s.hoogte}" rx="0.2" />`)
    .join('');
  const afdelingen = (winkel.labels ?? [])
    .map((l) => `<text class="afdeling" x="${l.x}" y="${l.y}" data-draai="${l.draai ?? 0}" transform="${labelDraai(l, hoek)}">${esc(l.tekst)}</text>`)
    .join('');
  const paden = winkel.looppaden.map((p) => `<line class="pad" x1="${p.van[0]}" y1="${p.van[1]}" x2="${p.naar[0]}" y2="${p.naar[1]}" />`).join('');

  // Route in stukken: gedaan (grijs), naar de volgende stop (dik), daarna (dunner).
  const stukken = route?.stukken ?? [];
  const actief = volgende === -1 ? stukken.length - 1 : volgende;
  const routeLijnen = stukken
    .map((stuk, i) => {
      const soort = i < actief ? 'gedaan' : i === actief ? 'actief' : 'later';
      return `<polyline class="route ${soort}" points="${lijnPunten(stuk)}" />${soort === 'actief' ? `<polyline class="route actief-stippel" points="${lijnPunten(stuk)}" />` : ''}`;
    })
    .join('');
  const pijlen = stukken
    .slice(Math.max(0, actief))
    .flatMap((stuk) => pijlpunten(stuk))
    .map((p) => `<g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.hoek.toFixed(0)})"><path class="pijl schaal" d="M-0.35 -0.45 L0.25 0 L-0.35 0.45" /></g>`)
    .join('');

  const stippen = stops
    .map((stop, i) => {
      const klaar = stop.regels.every((r) => r.afgevinkt);
      const status = [i === volgende ? 'volgende' : klaar ? 'klaar' : '', i === getoond ? 'gekozen' : ''].join(' ');
      return `
        <g class="stip ${status}" data-stop="${i}" transform="translate(${stop.sectie.x} ${stop.sectie.y})"><g data-rechtop transform="${rechtop(hoek)}">
          <g class="schaal"><circle class="ring" r="1.45" /><circle r="1" /><text>${i + 1}</text></g>
          <text class="stopnaam" dy="2.5em">${esc(stop.sectie.naam)}</text>
        </g></g>`;
    })
    .join('');

  const start = vanaf ?? winkel.ingang;
  const hier = `
    <g class="hier" transform="translate(${start.x} ${start.y})"><g data-rechtop transform="${rechtop(hoek)}">
      <g class="schaal"><circle class="puls" r="1.3" /><circle class="kern" r="0.55" /></g>
      <text class="stopnaam" dy="2.5em">${vanaf ? 'Je bent hier' : 'Ingang'}</text>
    </g></g>`;
  const kassas = winkel.kassas
    .map(
      (k) => `<g class="kassa-punt ${route?.kassa.naam === k.naam ? 'eind' : ''}" transform="translate(${k.x} ${k.y})"><g data-rechtop transform="${rechtop(hoek)}">
        <g class="schaal"><rect x="-0.7" y="-0.7" width="1.4" height="1.4" rx="0.3" /></g>
        <text class="stopnaam" dy="2.5em">${esc(k.naam)}</text></g></g>`,
    )
    .join('');

  return `
    <div class="kaart-vak">
      <svg id="kaart" viewBox="${alsViewBox(beeld)}" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="Plattegrond van ${esc(winkel.naam)}${route ? ` met route van ${meters(route.totaleAfstand)}` : ''}. Sleep om te schuiven, knijp of dubbeltik om te zoomen, draai met twee vingers.">
        <g class="draaibaar" transform="${kaartDraai(winkel, hoek)}">${vloer}${schappen}${afdelingen}${paden}${routeLijnen}${pijlen}${kassas}${hier}${stippen}</g>
      </svg>
      <div class="kaart-knoppen" role="group" aria-label="Kaart bedienen">
        <button data-actie="kaart-in" aria-label="Inzoomen">+</button>
        <button data-actie="kaart-uit" aria-label="Uitzoomen">−</button>
        <button data-actie="kaart-alles" aria-label="Hele winkel tonen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
        <button data-actie="kaart-draai" aria-label="Kaart een kwartslag draaien">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
        </button>
        <button data-actie="kaart-recht" aria-label="Kaart terugdraaien naar de plattegrond" ${Math.abs(normaliseerHoek(hoek)) < 0.5 ? 'hidden' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${hoek.toFixed(1)}deg)"><path class="kompas-noord" d="M12 3l4 9h-8z" /><path d="M8 12l4 9 4-9" /></svg>
        </button>
      </div>
      <button class="kaart-volg" data-actie="kaart-volg" ${st.kaart.volgen ? 'hidden' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg> Volgen
      </button>
    </div>
    ${stopKaart(st, getoond, volgende)}`;
}

/** Het kaartje onder de kaart: de stop met de producten om af te vinken. */
function stopKaart(st, index, volgende) {
  const { routeInfo } = st;
  const stops = routeInfo?.stops ?? [];
  if (st.lijst.length === 0) return `<p class="melding">Zet producten op je lijst om de route te zien.</p>`;
  if (index === -1) {
    const kassa = routeInfo?.route?.kassa;
    return `<section class="stopblad klaar"><strong>Alles gevonden.</strong> ${kassa ? `Loop naar ${esc(kassa.naam)}.` : ''}</section>`;
  }
  const stop = stops[index];
  const open = stop.regels.filter((r) => !r.afgevinkt).length;
  const label = index === volgende ? 'Volgende stop' : `Stop ${index + 1}`;
  return `
    <section class="stopblad" aria-live="polite">
      <div class="stopblad-kop">
        <button class="knop stil klein" data-actie="kaart-vorige" ${index === 0 ? 'disabled' : ''} aria-label="Vorige stop">‹</button>
        <div class="stopblad-titel">
          <span class="label">${label} · ${index + 1} van ${stops.length}</span>
          <strong>${esc(stop.sectie.naam)}</strong>
          <small class="zacht">${open} ${open === 1 ? 'product' : 'producten'} te pakken</small>
        </div>
        <button class="knop stil klein" data-actie="kaart-volgende" ${index === stops.length - 1 ? 'disabled' : ''} aria-label="Volgende stop">›</button>
      </div>
      ${stop.regels.map((r) => vink(r, st)).join('')}
    </section>`;
}
