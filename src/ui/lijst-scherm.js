// Scherm "Lijst": producten zoeken en je boodschappenlijst beheren.
import { esc, euro } from './html.js';

export function lijstScherm(st) {
  const { lijst, productenOpId } = st;
  const regels = lijst.map((r) => ({ ...r, product: productenOpId.get(r.productId) })).filter((r) => r.product);
  const totaal = regels.reduce((som, r) => som + (r.product.prijs ?? 0) * r.aantal, 0);

  return `
    <div class="zoekbalk">
      <label class="label" for="zoek">Product toevoegen</label>
      <input id="zoek" type="search" inputmode="search" autocomplete="off"
        placeholder="Zoek, bijv. cola zero of halfvolle melk" value="${esc(st.zoek)}" />
    </div>
    <div id="zoekresultaten">${zoekResultaten(st)}</div>

    ${st.voorbeeldMelding ? `<p class="melding">Dit is een voorbeeldlijst om de app te proberen. Pas hem aan of maak hem leeg.</p>` : ''}

    <section class="lijstkop">
      <h2>Mijn lijst</h2>
      <span class="zacht cijfers">${regels.length} ${regels.length === 1 ? 'product' : 'producten'}${totaal ? ` · ± ${euro(totaal)}` : ''}</span>
    </section>
    ${
      regels.length === 0
        ? `<p class="leeg">Je lijst is leeg. Zoek hierboven een product om te beginnen.</p>`
        : `<ul class="regels">${regels.map(regel).join('')}</ul>
           <div class="knoppen">
             <button class="knop" data-actie="naar-route">Route berekenen</button>
             ${
               st.bevestigLeeg
                 ? `<button class="knop gevaar" data-actie="leeg-bevestigd">Ja, alles wissen</button>
                    <button class="knop stil" data-actie="leeg-annuleer">Annuleren</button>`
                 : `<button class="knop stil" data-actie="leeg">Lijst leegmaken</button>`
             }
           </div>
           <p class="zacht" style="font-size:.85rem;margin:0">Prijzen zijn indicaties, geen actuele Jumbo-prijzen.</p>`
    }`;
}

function regel(r) {
  const p = r.product;
  return `
    <li class="regel">
      <span class="naam">${esc(p.naam)}</span>
      <span class="meta">${esc([p.merk, p.inhoud].filter(Boolean).join(' · '))}${p.prijs ? ` · ${euro(p.prijs)}` : ''}</span>
      <span class="stapper">
        <button data-actie="min" data-id="${esc(p.id)}" aria-label="Eén minder ${esc(p.naam)}">−</button>
        <output aria-label="Aantal">${r.aantal}</output>
        <button data-actie="plus" data-id="${esc(p.id)}" aria-label="Eén meer ${esc(p.naam)}">+</button>
      </span>
    </li>`;
}

export function zoekResultaten(st) {
  const tekst = st.zoek.trim();
  if (!tekst) return '';
  const opLijst = new Set(st.lijst.map((r) => r.productId));
  const treffers = st.zoekResultaten;

  const items = treffers
    .map((p) => {
      const al = opLijst.has(p.id);
      return `
        <button class="resultaat ${al ? 'toegevoegd' : ''}" data-actie="toevoegen" data-id="${esc(p.id)}">
          <span class="naam">${esc(p.merk ? `${p.merk} ${p.naam}` : p.naam)}</span>
          <span class="meta">${esc(p.inhoud ?? '')}${p.prijs ? ` · ${euro(p.prijs)}` : ''} · ${esc(st.categorieNamen[p.categorie] ?? p.categorie)}</span>
          <span class="plus" aria-hidden="true">${al ? '✓' : '+'}</span>
        </button>`;
    })
    .join('');

  const opties = st.categorieen.map((c) => `<option value="${esc(c.id)}">${esc(c.naam)}</option>`).join('');
  const eigen = `
    <div class="eigen">
      <span>${treffers.length ? 'Staat het er niet tussen?' : 'Niet gevonden.'} Voeg <strong>${esc(tekst)}</strong> toe als eigen product:</span>
      <div class="rij">
        <select id="eigen-categorie" aria-label="Afdeling in de winkel">
          <option value="">Kies de afdeling…</option>${opties}
        </select>
        <button class="knop" data-actie="eigen-toevoegen">Toevoegen</button>
      </div>
    </div>`;

  return `<div class="resultaten">${items}${eigen}</div>`;
}
