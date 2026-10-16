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

export function meters(m) {
  return `${Math.round(m)} m`;
}
