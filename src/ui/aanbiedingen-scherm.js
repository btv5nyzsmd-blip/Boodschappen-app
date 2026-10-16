// Scherm "Acties": aanbiedingen bekijken en zelf invoeren.
import { esc, euro, productNaam, extraInhoud } from './html.js';
import { isActueel, vandaag } from '../aanbiedingen/index.js';

/** De eerstvolgende dinsdag (Jumbo-acties lopen meestal van woensdag t/m dinsdag). */
export function volgendeDinsdag(datum = new Date()) {
  const d = new Date(datum);
  d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7));
  return vandaag(d);
}

function datumTekst(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function aanbiedingenScherm(st) {
  const dag = vandaag();
  const alle = st.aanbiedingen;
  const lopend = alle.filter((a) => isActueel(a, dag));
  const komend = alle.filter((a) => a.geldigVanaf && a.geldigVanaf > dag && a.geldigTot >= dag);
  const verlopen = alle.filter((a) => a.geldigTot < dag && a.bron === 'Zelf ingevoerd');

  return `
    <section class="blok">
      <h2>Aanbiedingen</h2>
      <p class="zacht klein">Vul de aanbiedingen uit de folder in. In je lijst, je budget en het weekmenu telt dan de actieprijs, en maaltijden met deze producten krijgen voorrang.</p>
    </section>

    ${invoer(st)}

    <section class="blok">
      <h2>Loopt nu <span class="zacht">(${lopend.length})</span></h2>
      ${lopend.length ? `<ul class="regels">${lopend.map((a) => regel(st, a)).join('')}</ul>` : '<p class="leeg">Nog geen aanbiedingen ingevoerd.</p>'}
    </section>
    ${komend.length ? `<section class="blok"><h2>Komt nog</h2><ul class="regels">${komend.map((a) => regel(st, a)).join('')}</ul></section>` : ''}
    ${
      verlopen.length
        ? `<section class="blok"><h2>Verlopen</h2><ul class="regels verlopen">${verlopen.map((a) => regel(st, a)).join('')}</ul>
           <div class="knoppen"><button class="knop stil" data-actie="actie-opruimen">Verlopen aanbiedingen verwijderen</button></div></section>`
        : ''
    }`;
}

function invoer(st) {
  const keuze = st.actieKeuze && st.productenOpId.get(st.actieKeuze);
  if (keuze) {
    const normaal = keuze.normalePrijs ?? keuze.prijs;
    return `
      <section class="actie-invoer">
        <p class="label">Nieuwe aanbieding</p>
        <strong>${esc(productNaam(keuze))}</strong>
        <div class="velden">
          <label class="veld"><span class="label">Normale prijs</span>
            <span class="euro-invoer"><span aria-hidden="true">€</span><input id="actie-normaal" type="text" inputmode="decimal" autocomplete="off" value="${normaal.toFixed(2).replace('.', ',')}" /></span></label>
          <label class="veld"><span class="label">Actieprijs</span>
            <span class="euro-invoer"><span aria-hidden="true">€</span><input id="actie-prijs" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" /></span></label>
          <label class="veld"><span class="label">Geldig t/m</span>
            <input id="actie-tot" type="date" value="${volgendeDinsdag()}" min="${vandaag()}" /></label>
        </div>
        <label class="veld breed"><span class="label">Omschrijving (mag leeg)</span>
          <input id="actie-omschrijving" type="text" autocomplete="off" placeholder="bijv. 1+1 gratis of 2e halve prijs" /></label>
        <p class="zacht klein">Bij "1+1 gratis" vul je de prijs per stuk in die je dan betaalt: de helft van de normale prijs.</p>
        ${st.actieFout ? `<p class="melding waarschuwing">${esc(st.actieFout)}</p>` : ''}
        <div class="knoppen">
          <button class="knop" data-actie="actie-opslaan">Opslaan</button>
          <button class="knop stil" data-actie="actie-annuleer">Annuleren</button>
        </div>
      </section>`;
  }
  return `
    <section class="actie-invoer">
      <label class="label" for="actie-zoek">Aanbieding toevoegen</label>
      <input id="actie-zoek" class="zoekveld" type="search" autocomplete="off" placeholder="Zoek het product uit de folder" value="${esc(st.actieZoek)}" />
      <div id="actie-resultaten">${actieResultaten(st)}</div>
    </section>`;
}

export function actieResultaten(st) {
  if (!st.actieZoek.trim()) return '';
  if (st.actieResultaten.length === 0) return '<p class="zacht klein">Geen product gevonden.</p>';
  return `<div class="resultaten">${st.actieResultaten
    .map(
      (p) => `
      <button class="resultaat" data-actie="actie-kies" data-id="${esc(p.id)}">
        <span class="naam">${esc(productNaam(p))}</span>
        <span class="meta">${esc([extraInhoud(p), euro(p.normalePrijs ?? p.prijs)].filter(Boolean).join(' · '))}</span>
        <span class="plus" aria-hidden="true">+</span>
      </button>`,
    )
    .join('')}</div>`;
}

function regel(st, a) {
  const p = st.productenOpId.get(a.productId);
  const naam = p ? productNaam(p) : `Onbekend product (${a.productId})`;
  const procent = a.normalePrijs > 0 ? Math.round((100 * (a.normalePrijs - a.actiePrijs)) / a.normalePrijs) : 0;
  const eigen = a.bron === 'Zelf ingevoerd';
  return `
    <li class="regel">
      <span class="naam">${esc(naam)}</span>
      <span class="meta cijfers">${a.omschrijving ? `${esc(a.omschrijving)} · ` : ''}<s>${euro(a.normalePrijs)}</s> ${euro(a.actiePrijs)}${procent > 0 ? ` (−${procent}%)` : ''} · t/m ${datumTekst(a.geldigTot)}${eigen ? '' : ' · gedeelde lijst'}</span>
      ${eigen ? `<button class="knop stil klein verwijder" data-actie="actie-verwijder" data-id="${esc(a.id)}" aria-label="Aanbieding ${esc(naam)} verwijderen">Verwijder</button>` : ''}
    </li>`;
}
