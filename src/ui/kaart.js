// Tekent de winkel als SVG-plattegrond met de route erin.
import { esc, meters } from './html.js';
import { volgendeStop } from './route-scherm.js';

export function kaartScherm(st) {
  const { winkel, routeInfo } = st;
  const route = routeInfo?.route;
  const stops = routeInfo?.stops ?? [];
  const volgende = volgendeStop(stops);
  const m = 1.5; // marge rond de winkel in meters

  const schappen = (winkel.schappen ?? [])
    .map((s) => `<rect class="schap ${s.soort === 'kassa' ? 'kassa' : ''}" x="${s.x}" y="${s.y}" width="${s.breedte}" height="${s.hoogte}" rx="0.3"><title>${esc(s.label ?? '')}</title></rect>`)
    .join('');

  const paden = winkel.looppaden
    .map((p) => `<line class="pad" x1="${p.van[0]}" y1="${p.van[1]}" x2="${p.naar[0]}" y2="${p.naar[1]}" />`)
    .join('');

  // Gangnummers onderaan elke gang.
  const gangLabels = winkel.looppaden
    .filter((p) => /^Gang \d+/.test(p.naam ?? ''))
    .map((p) => {
      const onder = Math.max(p.van[1], p.naar[1]);
      return `<text class="tekst" x="${p.van[0]}" y="${onder - 1}">${esc(p.naam.replace('Gang ', ''))}</text>`;
    })
    .join('');

  const lijn = route ? `<polyline class="route" points="${route.lijn.map((p) => `${p.x},${p.y}`).join(' ')}" />` : '';

  const stippen = stops
    .map((stop, i) => {
      const klaar = stop.regels.every((r) => r.afgevinkt);
      const status = i === volgende ? 'volgende' : klaar ? 'klaar' : '';
      return `<g class="stip ${status}"><circle cx="${stop.sectie.x}" cy="${stop.sectie.y}" r="1.15" /><text x="${stop.sectie.x}" y="${stop.sectie.y}">${i + 1}</text><title>${esc(stop.sectie.naam)}</title></g>`;
    })
    .join('');

  const ingang = `<text class="tekst groot" x="${winkel.ingang.x + 1}" y="${winkel.ingang.y + 0.35}" style="text-anchor:start">Ingang</text>`;
  const kassas = winkel.kassas
    // "Kassa 2" wordt "K2" zodat de labels naast elkaar passen.
    .map((k) => `<text class="tekst ${route?.kassa.naam === k.naam ? 'groot' : ''}" x="${k.x}" y="${k.y + 1.3}">${esc(k.naam.replace(/^Kassa\s*/, 'K'))}<title>${esc(k.naam)}</title></text>`)
    .join('');

  const volgendeTekst =
    volgende >= 0
      ? `<p class="melding"><strong>Volgende stop ${volgende + 1}:</strong> ${esc(stops[volgende].sectie.naam)} · ${esc(
          stops[volgende].regels.filter((r) => !r.afgevinkt).map((r) => r.product.naam).join(', '),
        )}</p>`
      : stops.length
        ? `<p class="melding"><strong>Alles gevonden.</strong> Loop naar ${esc(route.kassa.naam)}.</p>`
        : `<p class="melding">Zet producten op je lijst om de route te zien.</p>`;

  return `
    ${volgendeTekst}
    <div class="kaart">
      <svg viewBox="${-m} ${-m} ${winkel.breedte + 2 * m} ${winkel.diepte + 2 * m + 1}" role="img"
        aria-label="Plattegrond van ${esc(winkel.naam)}${route ? ` met route van ${meters(route.totaleAfstand)}` : ''}">
        <rect class="vloer" x="0" y="0" width="${winkel.breedte}" height="${winkel.diepte}" rx="0.5" />
        ${schappen}${paden}${gangLabels}${lijn}${stippen}${ingang}${kassas}
      </svg>
    </div>
    <div class="legenda">
      <span><i style="background:var(--volgende)"></i>Volgende stop</span>
      <span><i style="background:var(--accent)"></i>Nog te doen</span>
      <span><i style="background:var(--zacht)"></i>Klaar</span>
    </div>
    <p class="zacht" style="font-size:.85rem;margin:0">${esc(winkel.toelichting ?? '')}</p>`;
}
