// Scherm "Route": de stops in looproute-volgorde, met afvinken.
import { esc, meters } from './html.js';

/** Index van de eerste stop waar nog iets af te vinken is (of -1). */
export function volgendeStop(stops) {
  return stops.findIndex((s) => s.regels.some((r) => !r.afgevinkt));
}

export function routeScherm(st) {
  const { routeInfo } = st;
  if (st.lijst.length === 0) {
    return `<p class="leeg">Nog niets op je lijst.<br><button class="knop" data-actie="naar-lijst" style="margin-top:12px">Producten toevoegen</button></p>`;
  }
  if (routeInfo.fout) return `<p class="melding">De route kon niet worden berekend: ${esc(routeInfo.fout)}</p>`;

  const { route, stops, nietGevonden } = routeInfo;
  const alle = [...stops.flatMap((s) => s.regels), ...nietGevonden];
  const af = alle.filter((r) => r.afgevinkt).length;
  const volgende = volgendeStop(stops);

  return `
    <section class="samenvatting">
      <div><span class="label">Stops</span><strong>${stops.length}</strong></div>
      <div><span class="label">Afstand</span><strong>± ${route ? meters(route.totaleAfstand) : '–'}</strong></div>
      <div><span class="label">Afgevinkt</span><strong class="cijfers">${af}/${alle.length}</strong></div>
    </section>
    <div class="voortgang" role="progressbar" aria-valuemin="0" aria-valuemax="${alle.length}" aria-valuenow="${af}">
      <span style="width:${alle.length ? (100 * af) / alle.length : 0}%"></span>
    </div>

    <ol class="stops">
      ${stops.map((stop, i) => stopKaart(stop, i, volgende)).join('')}
      ${
        nietGevonden.length
          ? `<li class="stop"><div class="stopkop"><span class="nummer">?</span><span class="titel"><strong>Niet op de plattegrond</strong><small>Deze afdeling staat niet in de winkel-indeling</small></span></div>
             ${nietGevonden.map(vink).join('')}</li>`
          : ''
      }
    </ol>
    ${route ? `<div class="kassa-eind"><span class="label">Eindpunt</span><strong>${esc(route.kassa.naam)}</strong></div>` : ''}
    ${af > 0 ? `<div class="knoppen"><button class="knop stil" data-actie="opruimen">Afgevinkte producten van de lijst halen</button></div>` : ''}`;
}

function stopKaart(stop, i, volgende) {
  const klaar = stop.regels.every((r) => r.afgevinkt);
  const status = i === volgende ? 'volgende' : klaar ? 'klaar' : '';
  return `
    <li class="stop ${status}">
      <div class="stopkop">
        <span class="nummer">${i + 1}</span>
        <span class="titel">
          <strong>${esc(stop.sectie.naam)}</strong>
          <small>${i === volgende ? 'Volgende stop · ' : ''}${stop.regels.length} ${stop.regels.length === 1 ? 'product' : 'producten'}</small>
        </span>
      </div>
      ${stop.regels.map(vink).join('')}
    </li>`;
}

function vink(r) {
  const p = r.product;
  return `
    <label class="vink ${r.afgevinkt ? 'af' : ''}">
      <input type="checkbox" data-actie="vink" data-id="${esc(p.id)}" ${r.afgevinkt ? 'checked' : ''} />
      <span class="naam">${esc(p.merk && p.merk !== 'Jumbo' ? `${p.merk} ${p.naam}` : p.naam)} <span class="zacht">${esc(p.inhoud ?? '')}</span></span>
      ${r.aantal > 1 ? `<span class="aantal">${r.aantal}×</span>` : ''}
    </label>`;
}
