// Kleine hulpjes om veilig HTML op te bouwen.

/** Maakt tekst veilig om in HTML te zetten (geen <script> via een productnaam). */
export function esc(waarde) {
  return String(waarde)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function euro(bedrag) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(bedrag);
}

/** "500 g" niet tonen als de naam al "… 500 g" bevat. */
export function extraInhoud(product) {
  const inhoud = product.inhoud ?? '';
  const getal = inhoud.match(/[\d,]+/)?.[0];
  return !inhoud || (getal && product.naam.includes(getal)) ? '' : inhoud;
}

/** Productnaam met merk ervoor als het merk nog niet in de naam staat. */
export function productNaam(product) {
  return product.merk && !product.naam.startsWith(product.merk) ? `${product.merk} ${product.naam}` : product.naam;
}

/** Prijs als HTML; bij een aanbieding met label en doorgestreepte oude prijs. */
export function prijsHtml(product) {
  if (!product.prijs) return '';
  if (!product.aanbieding) return euro(product.prijs);
  const extra = product.aanbieding.omschrijving ? ` ${esc(product.aanbieding.omschrijving)}` : '';
  return `<span class="actie">Actie${extra}</span> <s>${euro(product.normalePrijs)}</s> <strong>${euro(product.prijs)}</strong>`;
}

/** Regel onder een productnaam: inhoud · prijs · afdeling. */
export function productMeta(product, categorieNamen) {
  const delen = [esc(extraInhoud(product)), prijsHtml(product), esc(categorieNamen[product.categorie] ?? 'Afdeling onbekend')];
  return delen.filter(Boolean).join(' · ');
}

export function meters(m) {
  return `${Math.round(m)} m`;
}
