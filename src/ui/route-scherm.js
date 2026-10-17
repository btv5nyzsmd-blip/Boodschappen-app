// Scherm "Route": de stops in looproute-volgorde, met afvinken.
// De route wordt berekend vanaf de plek waar je het laatst iets afvinkte.
import { esc, euro, meters, extraInhoud, productNaam } from './html.js';

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

  const { route, vanaf, stops, inKar, nietGevonden, overgeslagen = [] } = routeInfo;
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
      ${stops.map((stop, i) => stopKaart(st, stop, i, volgende)).join('')}
      ${
        nietGevonden.length
          ? `<li class="stop"><div class="stopkop"><span class="nummer">?</span><span class="titel"><strong>Afdeling onbekend</strong><small>Kies de afdeling, dan komt het product in de route</small></span></div>
             ${nietGevonden.map((r) => vink(r, st) + afdelingKiezen(r, st)).join('')}</li>`
          : ''
      }
    </ol>
    ${
      route
        ? `<div class="kassa-eind"><span class="label">${volgende === -1 ? 'Klaar, loop naar' : 'Eindpunt'}</span><strong>${esc(route.kassa.naam)}</strong></div>`
        : ''
    }
    ${nietGevondenBlok(overgeslagen)}
    ${
      inKar.length
        ? `<details class="inkar">
             <summary><strong>In je kar</strong> <span class="zacht">(${inKar.length})</span></summary>
             ${inKar.map((r) => vink(r, st)).join('')}
           </details>`
        : ''
    }
    ${af > 0 ? `<div class="knoppen"><button class="knop stil" data-actie="opruimen">Klaar met boodschappen: afgevinkte producten van de lijst halen</button></div>` : ''}`;
}

function stopKaart(st, stop, i, volgende) {
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
      ${stop.regels.map((r) => vink(r, st)).join('')}
    </li>`;
}

/** Eén product om af te vinken, met een knop "Ligt er niet" zolang je het nog niet hebt. */
export function vink(r, st) {
  const p = r.product;
  return `
    <div class="vink-rij">
      <label class="vink ${r.afgevinkt ? 'af' : ''}">
        <input type="checkbox" data-actie="vink" data-id="${esc(p.id)}" ${r.afgevinkt ? 'checked' : ''} />
        <span class="naam">${esc(productNaam(p))} <span class="zacht">${esc(extraInhoud(p))}</span>${p.aanbieding ? ' <span class="actie">Actie</span>' : ''}</span>
        ${r.aantal > 1 ? `<span class="aantal">${r.aantal}×</span>` : ''}
      </label>
      ${r.afgevinkt ? '' : `<button class="overslaan" data-actie="overslaan" data-id="${esc(p.id)}" aria-label="${esc(p.naam)} niet gevonden">Ligt er niet</button>`}
    </div>
    ${st?.vervang?.productId === p.id ? alternatievenKeuze(p, st.vervang, st) : ''}`;
}

/** Na afvinken: andere klanten meldden een andere plek. Klopt dat? (Zweeft onderaan het scherm.) */
export function plekVraag(st) {
  const product = st.productenOpId.get(st.vraag.productId);
  if (!product) return '';
  const naam = (id) => esc(st.categorieNamen[id] ?? id);
  return `
    <div class="alternatieven plekvraag" role="dialog" aria-live="polite" aria-label="Waar lag ${esc(product.naam)}?">
      <p><strong>${esc(productNaam(product))}</strong>: andere klanten melden dat dit bij <strong>${naam(st.vraag.naar)}</strong> ligt. Waar vond jij het?</p>
      <div class="knoppen">
        <button class="knop klein" data-actie="plek-ja" data-id="${esc(product.id)}">Bij ${naam(st.vraag.naar)}</button>
        <button class="knop stil klein" data-actie="plek-nee" data-id="${esc(product.id)}">Bij ${naam(product.categorie)}</button>
        <button class="link" data-actie="plek-sluit">Weet ik niet</button>
      </div>
    </div>`;
}

/** Na "Ligt er niet": kies een van twee alternatieven, meld een andere plek, of sla het product over. */
function alternatievenKeuze(product, { opties, elders }, st) {
  const verschil = (alt) => {
    const d = alt.prijs - product.prijs;
    if (Math.abs(d) < 0.005) return 'zelfde prijs';
    return `${euro(Math.abs(d))} ${d > 0 ? 'duurder' : 'goedkoper'}`;
  };
  if (elders) {
    return `
    <div class="alternatieven" role="group" aria-label="Waar ligt ${esc(product.naam)}?">
      <p><strong>Waar lag het?</strong> Dan klopt je route meteen weer. Je melding gaat anoniem naar de app; als meer klanten hetzelfde zien, past de app het voor iedereen aan.</p>
      ${afdelingKeuze(product, st, product.categorie)}
      <div class="knoppen"><button class="link" data-actie="elders-terug">Terug</button></div>
    </div>`;
  }
  return `
    <div class="alternatieven" role="group" aria-label="Alternatieven voor ${esc(product.naam)}">
      ${
        opties.length
          ? `<p><strong>Ligt er niet?</strong> Neem in plaats daarvan, op dezelfde plek:</p>`
          : `<p><strong>Ligt er niet?</strong> Er is geen vergelijkbaar product gevonden.</p>`
      }
      ${opties
        .map(
          (alt) => `
        <button class="alt" data-actie="vervang-kies" data-id="${esc(alt.id)}">
          <span class="naam">${esc(productNaam(alt))}</span>
          <span class="meta cijfers">${euro(alt.prijs)} · ${verschil(alt)}${alt.aanbieding ? ' · <span class="actie">Actie</span>' : ''}</span>
        </button>`,
        )
        .join('')}
      <button class="alt elders" data-actie="elders">
        <span class="naam">Ligt het ergens anders?</span>
        <span class="meta">Kies de afdeling waar je het zag</span>
      </button>
      <div class="knoppen">
        <button class="knop stil klein" data-actie="vervang-overslaan">Nee, overslaan</button>
        <button class="link" data-actie="vervang-annuleer">Toch gevonden</button>
      </div>
    </div>`;
}

function nietGevondenBlok(overgeslagen) {
  if (!overgeslagen.length) return '';
  return `
    <section class="stop overgeslagen-blok">
      <div class="stopkop"><span class="nummer">✕</span><span class="titel"><strong>Niet gevonden</strong>
        <small>Blijft op je lijst voor de volgende keer</small></span></div>
      ${overgeslagen
        .map(
          (r) => `
        <div class="vink-rij">
          <span class="vink"><span class="naam">${esc(productNaam(r.product))}</span></span>
          <button class="overslaan terug" data-actie="overslaan" data-id="${esc(r.product.id)}">Toch zoeken</button>
        </div>`,
        )
        .join('')}
    </section>`;
}

function afdelingKiezen(r, st) {
  return `<div class="afdeling-kiezen">${afdelingKeuze(r.product, st)}</div>`;
}

/** Keuzelijst met alle afdelingen; kiezen = onthouden (en melden, zie main.js). */
function afdelingKeuze(product, st, zonder = null) {
  const opties = st.categorieen
    .filter((c) => c.id !== zonder)
    .map((c) => `<option value="${esc(c.id)}">${esc(c.naam)}</option>`)
    .join('');
  return `
      <select data-actie="afdeling" data-id="${esc(product.id)}" aria-label="Afdeling voor ${esc(product.naam)}">
        <option value="">Kies de afdeling…</option>${opties}
      </select>`;
}
