// Scherm "Route": de stops in looproute-volgorde, met afvinken.
// De route wordt berekend vanaf de plek waar je het laatst iets afvinkte.
import { esc, meters, extraInhoud, productNaam } from './html.js';

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

  const { route, vanaf, stops, inKar, nietGevonden } = routeInfo;
  const totaal = st.lijst.length;
  const af = st.lijst.filter((r) => r.afgevinkt).length;
  const volgende = volgendeStop(stops);
  const open = stops.filter((s) => s.regels.some((r) => !r.afgevinkt)).length;

  return `
    <section class="samenvatting">
      <div><span class="label">Nog stops</span><strong>${open}</strong></div>
      <div><span class="label">Nog lopen</span><strong>± ${route ? meters(route.totaleAfstand) : '–'}</strong></div>
      <div><span class="label">Afgevinkt</span><strong class="cijfers">${af}/${totaal}</strong></div>
    </section>
    <div class="voortgang" role="progressbar" aria-valuemin="0" aria-valuemax="${totaal}" aria-valuenow="${af}">
      <span style="width:${totaal ? (100 * af) / totaal : 0}%"></span>
    </div>
    ${
      vanaf
        ? `<div class="vanaf"><span>Route berekend vanaf <strong>${esc(vanaf.naam)}</strong>, waar je het laatst iets afvinkte.</span>
           <button class="knop stil klein" data-actie="vanaf-ingang">Vanaf ingang</button></div>`
        : ''
    }

    <ol class="stops">
      ${stops.map((stop, i) => stopKaart(stop, i, volgende)).join('')}
      ${
        nietGevonden.length
          ? `<li class="stop"><div class="stopkop"><span class="nummer">?</span><span class="titel"><strong>Afdeling onbekend</strong><small>Kies de afdeling, dan komt het product in de route</small></span></div>
             ${nietGevonden.map((r) => vink(r) + afdelingKiezen(r, st)).join('')}</li>`
          : ''
      }
    </ol>
    ${
      route
        ? `<div class="kassa-eind"><span class="label">${volgende === -1 ? 'Klaar, loop naar' : 'Eindpunt'}</span><strong>${esc(route.kassa.naam)}</strong></div>`
        : ''
    }
    ${
      inKar.length
        ? `<details class="inkar">
             <summary><strong>In je kar</strong> <span class="zacht">(${inKar.length})</span></summary>
             ${inKar.map(vink).join('')}
           </details>`
        : ''
    }
    ${af > 0 ? `<div class="knoppen"><button class="knop stil" data-actie="opruimen">Klaar met boodschappen: afgevinkte producten van de lijst halen</button></div>` : ''}`;
}

function stopKaart(stop, i, volgende) {
  const klaar = stop.regels.every((r) => r.afgevinkt);
  const status = i === volgende ? 'volgende' : klaar ? 'klaar' : '';
  const open = stop.regels.filter((r) => !r.afgevinkt).length;
  return `
    <li class="stop ${status}">
      <div class="stopkop">
        <span class="nummer">${i + 1}</span>
        <span class="titel">
          <strong>${esc(stop.sectie.naam)}</strong>
          <small>${i === volgende ? 'Volgende stop · ' : ''}${open} ${open === 1 ? 'product' : 'producten'} te pakken</small>
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
      <span class="naam">${esc(productNaam(p))} <span class="zacht">${esc(extraInhoud(p))}</span>${p.aanbieding ? ' <span class="actie">Actie</span>' : ''}</span>
      ${r.aantal > 1 ? `<span class="aantal">${r.aantal}×</span>` : ''}
    </label>`;
}

function afdelingKiezen(r, st) {
  const opties = st.categorieen.map((c) => `<option value="${esc(c.id)}">${esc(c.naam)}</option>`).join('');
  return `
    <div class="afdeling-kiezen">
      <select data-actie="afdeling" data-id="${esc(r.product.id)}" aria-label="Afdeling voor ${esc(r.product.naam)}">
        <option value="">Kies de afdeling…</option>${opties}
      </select>
    </div>`;
}
