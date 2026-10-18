// Scherm "Lijst": producten zoeken en je boodschappenlijst beheren.
import { esc, euro, productNaam, productMeta } from './html.js';

export function lijstScherm(st) {
  const { lijst, productenOpId } = st;
  const regels = lijst.map((r) => ({ ...r, product: productenOpId.get(r.productId) })).filter((r) => r.product);
  const som = (rs) => rs.reduce((t, r) => t + (r.product.prijs ?? 0) * r.aantal, 0);
  const totaal = som(regels);
  // Wat vanuit het weekmenu op de lijst is gezet, apart van je eigen boodschappen.
  const vanMenu = st.planner.toegevoegd ?? {};
  const menuRegels = regels.filter((r) => vanMenu[r.productId]);
  const eigenRegels = regels.filter((r) => !vanMenu[r.productId]);
  const groep = (titel, rs, uitleg = '') => `
    <section class="lijstgroep">
      <div class="groepkop"><h3>${titel} <span class="zacht">(${rs.length})</span></h3><span class="zacht cijfers">± ${euro(som(rs))}</span></div>
      ${uitleg ? `<p class="zacht klein">${uitleg}</p>` : ''}
      <ul class="regels">${rs.map((r) => regel(r, st)).join('')}</ul>
    </section>`;

  return `
    <div class="zoekbalk">
      <label class="label" for="zoek">Product toevoegen</label>
      <input id="zoek" type="search" inputmode="search" autocomplete="off"
        placeholder="Zoek, bijv. cola zero of halfvolle melk" value="${esc(st.zoek)}" />
    </div>
    <div id="zoekresultaten">${zoekResultaten(st)}</div>

    ${st.lijst.some((r) => r.voorbeeld) ? `<p class="melding">Dit is een voorbeeldlijst om de app te proberen. Hij verdwijnt vanzelf zodra je zelf iets toevoegt of een weekmenu op je lijst zet.</p>` : ''}

    <section class="lijstkop">
      <h2>Mijn lijst</h2>
      <span class="zacht cijfers">${regels.length} ${regels.length === 1 ? 'product' : 'producten'}${totaal ? ` · ± ${euro(totaal)}` : ''}</span>
    </section>
    ${
      regels.length === 0
        ? `<p class="leeg">Je lijst is leeg. Zoek hierboven een product om te beginnen.</p>`
        : `${
            menuRegels.length
              ? groep('Voor je weekmenu', menuRegels, 'Hele verpakkingen, dus iets meer dan het menu zelf kost.') +
                (eigenRegels.length ? groep('Overige boodschappen', eigenRegels) : '')
              : `<ul class="regels">${regels.map((r) => regel(r, st)).join('')}</ul>`
          }
           <div class="knoppen">
             <button class="knop" data-actie="naar-route">Route berekenen</button>
             ${
               st.bevestigLeeg
                 ? `<button class="knop gevaar" data-actie="leeg-bevestigd">Ja, alles wissen</button>
                    <button class="knop stil" data-actie="leeg-annuleer">Annuleren</button>`
                 : `<button class="knop stil" data-actie="leeg">Lijst leegmaken</button>`
             }
           </div>
           ${prijsUitleg(st)}`
    }`;
}

function regel(r, st) {
  const p = r.product;
  return `
    <li class="regel">
      <span class="naam">${esc(productNaam(p))}${r.overgeslagen ? ' <span class="tag-niet">Niet gevonden</span>' : ''}</span>
      <span class="meta">${productMeta(p, st.categorieNamen)}</span>
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
          <span class="naam">${esc(productNaam(p))}</span>
          <span class="meta">${productMeta(p, st.categorieNamen)}</span>
          <span class="plus" aria-hidden="true">${al ? '✓' : '+'}</span>
        </button>`;
    })
    .join('');

  const opties = [...st.categorieen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).map((c) => `<option value="${esc(c.id)}">${esc(c.naam)}</option>`).join('');
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

/** Waar de prijzen vandaan komen, en waarom het bedrag in de winkel iets kan verschillen. */
export function prijsUitleg(st) {
  return `
    <details class="prijsuitleg zacht klein" data-uitklap="prijsuitleg" ${st.uitklap?.prijsuitleg ? 'open' : ''}>
      <summary>Kloppen deze prijzen in de winkel?</summary>
      <p>${esc(st.bronTekst)} Dat zijn de prijzen van de webwinkel. In de winkel zijn ze meestal hetzelfde, maar soms een paar cent anders, en versproducten (groente, vlees, kaas aan het stuk) kunnen per stuk of gewicht verschillen.</p>
      <p>Aanbiedingen uit de folder staan er alleen in als ze bij <strong>Acties</strong> zijn ingevoerd. Bedragen met ± zijn dus een goede schatting, geen kassabon.</p>
    </details>`;
}
