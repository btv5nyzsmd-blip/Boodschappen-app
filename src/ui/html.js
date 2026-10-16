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

export function meters(m) {
  return `${Math.round(m)} m`;
}
