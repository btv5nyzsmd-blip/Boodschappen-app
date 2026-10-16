// Scherm "Menu": weekmenu samenstellen binnen je budget.
import { esc, euro, productNaam } from './html.js';
import { UITSLUITINGEN, VOORKEUREN } from '../planner/planner.js';
import { toonHoeveelheid } from '../planner/verpakking.js';

export function menuScherm(st) {
  const { planner, menu } = st;
  const ins = planner.instellingen;

  return `
    <details class="instellingen" ${menu ? '' : 'open'}>
      <summary><h2>Jouw week</h2><span class="zacht">${ins.personen} pers. · ${ins.aantal} maaltijden · ${euro(ins.budget)}</span></summary>
      <div class="instellingen-inhoud">
      <div class="velden">
        <label class="veld">
          <span class="label">Weekbudget</span>
          <span class="euro-invoer"><span aria-hidden="true">€</span>
            <input id="budget" type="number" inputmode="decimal" min="0" step="1" value="${ins.budget}" aria-label="Weekbudget in euro" /></span>
        </label>
        ${stapper('Personen', 'personen', ins.personen)}
        ${stapper('Maaltijden', 'aantal', ins.aantal)}
      </div>
      <fieldset class="chips"><legend class="label">Uitsluiten</legend>
        ${UITSLUITINGEN.map((u) => chip('uitsluitingen', u, ins.uitsluitingen.includes(u.id))).join('')}
      </fieldset>
      <fieldset class="chips"><legend class="label">Voorkeur</legend>
        ${VOORKEUREN.map((v) => chip('voorkeuren', v, ins.voorkeuren.includes(v.id))).join('')}
      </fieldset>
      <label class="veld breed">
        <span class="label">Lust ik niet</span>
        <input id="niet-lusten" type="text" autocomplete="off" placeholder="bijv. champignons, spinazie" value="${esc(ins.nietLusten)}" />
      </label>
      <button class="knop" data-actie="menu-maak">${menu ? 'Nieuw weekmenu maken' : 'Maak weekmenu'}</button>
      </div>
    </details>
    ${menu ? resultaat(st) : `<p class="leeg">Vul je wensen in en tik op <strong>Maak weekmenu</strong>.<br>De app kiest maaltijden uit ${st.recepten.length} recepten.</p>`}`;
}

function stapper(label, veld, waarde) {
  return `
    <div class="veld">
      <span class="label">${label}</span>
      <span class="stapper">
        <button data-actie="menu-stap" data-veld="${veld}" data-stap="-1" aria-label="${label} min één">−</button>
        <output aria-label="${label}">${waarde}</output>
        <button data-actie="menu-stap" data-veld="${veld}" data-stap="1" aria-label="${label} plus één">+</button>
      </span>
    </div>`;
}

function chip(groep, optie, aan) {
  return `<button class="chip" data-actie="menu-chip" data-groep="${groep}" data-id="${optie.id}" aria-pressed="${aan}">${esc(optie.naam)}</button>`;
}

function resultaat(st) {
  const { menu, planner } = st;
  const { kosten } = menu;
  const ins = planner.instellingen;
  const budget = ins.budget;
  const deel = budget > 0 ? Math.min(100, (100 * kosten.teBetalen) / budget) : 100;
  const binnen = kosten.teBetalen <= budget + 1e-9;
  const maaltijdPrijs = kosten.teBetalen / (ins.personen * menu.maaltijden.length);
  const verseRest = kosten.regels.filter((r) => !r.houdbaar && r.over > 1e-6);
  const voorraadRest = kosten.regels.filter((r) => r.houdbaar && r.over > 1e-6);
  const tekoop = kosten.regels.filter((r) => r.pakken > 0);

  return `
    <section class="budget ${binnen ? '' : 'over'}">
      <div class="budgetkop">
        <span><span class="label">Te betalen</span><strong class="cijfers">${euro(kosten.teBetalen)}</strong></span>
        <span class="zacht cijfers">van ${euro(budget)}${binnen ? ` · ${euro(budget - kosten.teBetalen)} over` : ''}</span>
      </div>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${budget}" aria-valuenow="${kosten.teBetalen.toFixed(2)}" aria-label="Deel van je budget"><span style="width:${deel}%"></span></div>
      <p class="zacht klein">${euro(maaltijdPrijs)} per persoon per maaltijd · ${verseRest.length ? `± ${euro(kosten.verspilling)} aan verse restjes` : 'geen verse restjes'}</p>
      ${menu.melding ? `<p class="melding waarschuwing">${esc(menu.melding)}</p>` : ''}
    </section>

    <div class="knoppen">
      <button class="knop stil" data-actie="menu-nieuw">Andere suggestie</button>
      <button class="knop" data-actie="menu-naar-lijst">Op boodschappenlijst (${tekoop.length})</button>
    </div>
    ${planner.bericht ? `<p class="melding">${esc(planner.bericht)} <button class="link" data-actie="naar-route">Naar je route</button></p>` : ''}

    <ol class="maaltijden">
      ${menu.maaltijden.map((r, i) => maaltijdKaart(st, r, i)).join('')}
    </ol>

    <section class="blok">
      <h2>Boodschappen voor dit menu</h2>
      <p class="zacht klein">Vink aan wat je al in huis hebt; dat telt dan niet mee.</p>
      <ul class="regels">${kosten.regels.map((r) => boodschap(r)).join('')}</ul>
    </section>

    ${
      verseRest.length || voorraadRest.length
        ? `<section class="blok">
             <h2>Wat overblijft</h2>
             ${verseRest.length ? `<p class="label">Vers, snel opmaken</p><ul class="rest">${verseRest.map(rest).join('')}</ul>` : ''}
             ${voorraadRest.length ? `<p class="label">Houdbaar, voor een volgende week</p><ul class="rest">${voorraadRest.map(rest).join('')}</ul>` : ''}
           </section>`
        : ''
    }`;
}

function maaltijdKaart(st, recept, i) {
  const { menu, planner } = st;
  const per = menu.kosten.perMaaltijd[i];
  const vast = planner.vast.includes(recept.id);
  const factor = planner.instellingen.personen / recept.personen;
  // Welke verse producten deelt dit recept met andere maaltijden in het menu?
  const gedeeld = recept.ingredienten.filter((ing) => menu.gedeeld.has(ing.product));
  const namen = gedeeld.map((ing) => st.productenOpId.get(ing.product).naam.toLowerCase());
  const nummers = [...new Set(gedeeld.flatMap((ing) => menu.gedeeld.get(ing.product)))]
    .filter((n) => n !== recept.naam)
    .map((n) => menu.maaltijden.findIndex((r) => r.naam === n) + 1)
    .sort((a, b) => a - b);
  const deelt = gedeeld.length
    ? `Deelt ${opsomming(namen.length > 3 ? [...namen.slice(0, 3), `${namen.length - 3} meer`] : namen)} met maaltijd ${opsomming(nummers.map(String))}`
    : '';
  const labels = [
    recept.bevat.length === 0 ? 'Vega' : null,
    recept.bevat.includes('vis') ? 'Vis' : null,
    recept.tijd <= 30 ? 'Snel' : null,
  ].filter(Boolean);

  return `
    <li class="maaltijd ${vast ? 'vast' : ''}">
      <div class="maaltijdkop">
        <span class="nummer">${i + 1}</span>
        <span class="titel">
          <strong>${esc(recept.naam)}</strong>
          <small class="cijfers">${recept.tijd} min · ${euro(per.kosten)} · ${euro(per.perPersoon)} p.p.</small>
        </span>
      </div>
      ${labels.length ? `<div class="labels">${labels.map((l) => `<span class="tag">${l}</span>`).join('')}</div>` : ''}
      ${deelt ? `<p class="deelt">${esc(deelt)}</p>` : ''}
      <details class="recept">
        <summary>Ingrediënten en bereiding</summary>
        <ul>${recept.ingredienten
          .map((ing) => {
            const p = st.productenOpId.get(ing.product);
            const r = menu.kosten.regels.find((x) => x.product.id === ing.product);
            return `<li><span class="cijfers">${toonHoeveelheid(ing.hoeveelheid * factor, r.eenheid)}</span> ${esc(p.naam.toLowerCase())}</li>`;
          })
          .join('')}</ul>
        <p>${esc(recept.bereiding)}</p>
      </details>
      <div class="knoppen">
        <button class="knop stil klein" data-actie="menu-vast" data-id="${esc(recept.id)}" aria-pressed="${vast}">${vast ? 'Vastgezet' : 'Vastzetten'}</button>
        <button class="knop stil klein" data-actie="menu-ander" data-index="${i}" ${vast ? 'disabled' : ''}>Ander recept</button>
      </div>
    </li>`;
}

function boodschap(r) {
  const p = r.product;
  return `
    <li class="regel boodschap ${r.inHuis ? 'inhuis' : ''}">
      <span class="naam">${esc(productNaam(p))}</span>
      <span class="meta cijfers">${r.inHuis ? 'Heb je al' : `${r.pakken}× ${esc(p.inhoud)} · ${euro(r.prijs)}`} · nodig ${toonHoeveelheid(r.nodig, r.eenheid)}</span>
      <label class="inhuis-vink"><input type="checkbox" data-actie="menu-voorraad" data-id="${esc(p.id)}" ${r.inHuis ? 'checked' : ''} /> <span>Heb ik</span></label>
    </li>`;
}

function rest(r) {
  return `<li><span>${esc(r.product.naam)}</span> <span class="zacht cijfers">${toonHoeveelheid(r.over, r.eenheid)} · ± ${euro(r.restWaarde)}</span></li>`;
}

/** ['a', 'b', 'c'] → "a, b en c" */
function opsomming(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} en ${items.at(-1)}`;
}
