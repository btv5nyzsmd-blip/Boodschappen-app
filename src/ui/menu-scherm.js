// Scherm "Menu": weekmenu samenstellen binnen je budget.
import { prijsUitleg } from './lijst-scherm.js';
import { esc, euro, productNaam } from './html.js';
import { UITSLUITINGEN, VOORKEUREN } from '../planner/planner.js';
import { toonHoeveelheid } from '../planner/verpakking.js';

/** Staat een inklapbaar blok open? Zelf open- of dichtgeklapt gaat voor de standaard. */
export function isOpen(st, sleutel, standaard) {
  return sleutel in st.uitklap ? st.uitklap[sleutel] : standaard;
}
const open = (st, sleutel, standaard = false) => (isOpen(st, sleutel, standaard) ? 'open' : '');

export function menuScherm(st) {
  const { planner, menu } = st;
  const ins = planner.instellingen;

  return `
    <details class="instellingen" data-uitklap="instellingen" ${open(st, 'instellingen', !menu)}>
      <summary><h2>Jouw week</h2><span class="zacht">${ins.personen} pers. · ${ins.aantal} maaltijden · ${euro(ins.budget)}</span></summary>
      <div class="instellingen-inhoud">
      <div class="velden">
        <label class="veld">
          <span class="label">Weekbudget</span>
          <span class="euro-invoer"><span aria-hidden="true">€</span>
            <input id="budget" type="text" inputmode="decimal" autocomplete="off" value="${String(ins.budget).replace('.', ',')}" aria-label="Weekbudget in euro" /></span>
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
    ${altijdInHuis(st)}
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
  const basis = new Set(planner.basis ?? []);
  const inBasis = kosten.regels.filter((r) => basis.has(r.product.id)).map((r) => naamInHuis(st, r.product.id));
  const bespaard = tekoop.reduce((som, r) => som + (r.product.aanbieding ? r.pakken * (r.product.normalePrijs - r.product.prijs) : 0), 0);

  return `
    <section class="budget ${binnen ? '' : 'over'}">
      <div class="budgetkop">
        <span><span class="label">Te betalen</span><strong class="cijfers">${euro(kosten.teBetalen)}</strong></span>
        <span class="zacht cijfers">van ${euro(budget)}${binnen ? ` · ${euro(budget - kosten.teBetalen)} over` : ''}</span>
      </div>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${budget}" aria-valuenow="${kosten.teBetalen.toFixed(2)}" aria-label="Deel van je budget"><span style="width:${deel}%"></span></div>
      <p class="zacht klein">${euro(maaltijdPrijs)} per persoon per maaltijd · ${verseRest.length ? `± ${euro(kosten.verspilling)} aan verse restjes` : 'geen verse restjes'}${bespaard > 0 ? ` · <strong class="bespaard">${euro(bespaard)} bespaard met aanbiedingen</strong>` : ''}</p>
      ${menu.melding ? `<p class="melding waarschuwing">${esc(menu.melding)}</p>` : ''}
      ${prijsUitleg(st)}
    </section>

    ${planner.bericht ? `<p class="melding">${esc(planner.bericht)} <button class="link" data-actie="naar-route">Naar je route</button></p>` : ''}

    <ol class="maaltijden">
      ${menu.maaltijden.map((r, i) => maaltijdKaart(st, r, i)).join('')}
    </ol>

    <details class="uitklap" data-uitklap="menu-boodschappen" ${open(st, 'menu-boodschappen')}>
      <summary><span><strong>Boodschappen voor dit menu</strong> <span class="zacht">(${tekoop.length})</span></span><span class="zacht cijfers">${euro(kosten.teBetalen)}</span></summary>
      <p class="zacht klein">Heb je iets deze week nog (bijv. rijst van vorige week)? Vink <em>Heb ik nog</em> aan, dan telt het niet mee.</p>
      <ul class="regels">${kosten.regels.filter((r) => !basis.has(r.product.id)).map((r) => boodschap(r)).join('')}</ul>
      ${
        inBasis.length
          ? `<p class="zacht klein">Altijd in huis, telt niet mee: ${esc(inBasis.join(', '))}. <button class="link" data-actie="basis-openen">Aanpassen</button></p>`
          : ''
      }
    </details>

    ${
      verseRest.length || voorraadRest.length
        ? `<details class="uitklap" data-uitklap="menu-rest" ${open(st, 'menu-rest')}>
             <summary><strong>Wat overblijft</strong><span class="zacht cijfers">${verseRest.length ? `± ${euro(kosten.verspilling)} vers` : 'alleen houdbaar'}</span></summary>
             ${verseRest.length ? `<p class="label">Vers, snel opmaken</p><ul class="rest">${verseRest.map(rest).join('')}</ul>` : ''}
             ${voorraadRest.length ? `<p class="label">Houdbaar, voor een volgende week</p><ul class="rest">${voorraadRest.map(rest).join('')}</ul>` : ''}
           </details>`
        : ''
    }

    <div class="actiebalk">
      <button class="knop stil" data-actie="menu-nieuw">Andere suggestie</button>
      <button class="knop" data-actie="menu-naar-lijst">Op mijn lijst (${tekoop.length})</button>
    </div>`;
}

function maaltijdKaart(st, recept, i) {
  const { menu, planner } = st;
  const per = menu.kosten.perMaaltijd[i];
  const vast = planner.vast.includes(recept.id);
  const factor = planner.instellingen.personen / recept.personen;
  // Welke verse producten deelt dit recept met andere maaltijden in het menu?
  const gedeeld = recept.ingredienten.filter((ing) => menu.gedeeld.has(ing.product));
  const namen = gedeeld.map((ing) => ingNaam(st, ing));
  const nummers = [...new Set(gedeeld.flatMap((ing) => menu.gedeeld.get(ing.product)))]
    .filter((n) => n !== recept.naam)
    .map((n) => menu.maaltijden.findIndex((r) => r.naam === n) + 1)
    .sort((a, b) => a - b);
  const deelt = gedeeld.length
    ? `Deelt ${opsomming(namen.length > 3 ? [...namen.slice(0, 3), `${namen.length - 3} meer`] : namen)} met maaltijd ${opsomming(nummers.map(String))}`
    : '';
  const acties = recept.ingredienten.filter((ing) => st.productenOpId.get(ing.product)?.aanbieding).map((ing) => ingNaam(st, ing));
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
      ${acties.length ? `<p class="in-actie"><span class="actie">Actie</span> ${esc(opsomming(acties))}</p>` : ''}
      <details class="recept" data-uitklap="recept-${esc(recept.id)}" ${open(st, `recept-${recept.id}`)}>
        <summary>Ingrediënten en bereiding</summary>
        <ul>${recept.ingredienten
          .map((ing) => {
            const p = st.productenOpId.get(ing.product);
            const r = menu.kosten.regels.find((x) => x.product.id === ing.product);
            return `<li><span class="cijfers">${toonHoeveelheid(ing.hoeveelheid * factor, r.eenheid)}</span> ${esc(ingNaam(st, ing))}${p.aanbieding ? ' <span class="actie">Actie</span>' : ''}</li>`;
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
      <span class="meta cijfers">${r.inHuis ? 'Heb je nog (deze week)' : `${r.pakken}× ${esc(p.inhoud)} · ${euro(r.prijs)}${p.aanbieding ? ' <span class="actie">Actie</span>' : ''}`} · nodig ${toonHoeveelheid(r.nodig, r.eenheid)}</span>
      <label class="inhuis-vink"><input type="checkbox" data-actie="menu-voorraad" data-id="${esc(p.id)}" ${r.inHuis ? 'checked' : ''} /> <span>Heb ik nog</span></label>
    </li>`;
}

function rest(r) {
  return `<li><span>${esc(r.product.naam)}</span> <span class="zacht cijfers">${toonHoeveelheid(r.over, r.eenheid)} · ± ${euro(r.restWaarde)}</span></li>`;
}

/** Korte naam uit "Altijd in huis" ("bloem"), anders de productnaam. */
function naamInHuis(st, productId) {
  return st.voorraadKandidaten.find((k) => k.productId === productId)?.naam ?? st.productenOpId.get(productId)?.naam ?? productId;
}

/** Blok "Altijd in huis": basisproducten die nooit meetellen in je boodschappen. */
function altijdInHuis(st) {
  const basis = new Set(st.planner.basis ?? []);
  const groepen = new Map();
  for (const k of st.voorraadKandidaten) {
    if (!groepen.has(k.categorie)) groepen.set(k.categorie, []);
    groepen.get(k.categorie).push(k);
  }
  return `
    <details class="uitklap" data-uitklap="basis" ${open(st, 'basis')}>
      <summary><span><strong>Altijd in huis</strong></span><span class="zacht">${basis.size} ${basis.size === 1 ? 'product telt' : 'producten tellen'} niet mee</span></summary>
      <p class="zacht klein">Tik aan wat je altijd in de kast hebt. Dat komt nooit op je boodschappenlijst en telt niet mee in je budget.</p>
      ${[...groepen]
        .map(
          ([cat, items]) => `
        <fieldset class="chips basis-groep"><legend class="label">${esc(st.categorieNamen[cat] ?? cat)}</legend>
          ${items.map((k) => `<button class="chip" data-actie="basis-wissel" data-id="${esc(k.productId)}" aria-pressed="${basis.has(k.productId)}">${esc(k.naam)}</button>`).join('')}
        </fieldset>`,
        )
        .join('')}
      <button class="knop stil klein" data-actie="basis-standaard">Standaard herstellen</button>
    </details>`;
}

/** Korte naam van een ingrediënt ("gehakt"), anders de productnaam. */
function ingNaam(st, ing) {
  return ing.naam ?? st.productenOpId.get(ing.product)?.naam ?? ing.product;
}

/** ['a', 'b', 'c'] → "a, b en c" */
function opsomming(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} en ${items.at(-1)}`;
}
