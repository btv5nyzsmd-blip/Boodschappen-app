// Rekenwerk voor het kaartbeeld: welk stuk van de winkel je ziet (de "viewBox"),
// inzoomen rond een punt, verschuiven en binnen de winkel blijven.
// Alles in meters; geen schermcode, zodat het makkelijk te testen is.

export const MIN_BREEDTE = 6; // verder inzoomen dan 6 meter breed heeft geen zin

/**
 * Beeld waarin al deze punten passen, met wat ruimte eromheen.
 * @param {{x:number,y:number}[]} punten
 * @param {number} verhouding  breedte / hoogte van het scherm-vak
 * @param {number} [marge]  meters ruimte rondom
 */
export function beeldVoorPunten(punten, verhouding, marge = 4) {
  const xs = punten.map((p) => p.x);
  const ys = punten.map((p) => p.y);
  let x = Math.min(...xs) - marge;
  let y = Math.min(...ys) - marge;
  let w = Math.max(...xs) + marge - x;
  let h = Math.max(...ys) + marge - y;
  // Vorm aanpassen aan het scherm, gecentreerd.
  if (w / h < verhouding) {
    const nieuw = h * verhouding;
    x -= (nieuw - w) / 2;
    w = nieuw;
  } else {
    const nieuw = w / verhouding;
    y -= (nieuw - h) / 2;
    h = nieuw;
  }
  if (w < MIN_BREEDTE) return zoomRond({ x, y, w, h }, x + w / 2, y + h / 2, w / MIN_BREEDTE);
  return { x, y, w, h };
}

/** De hele winkel in beeld. */
export function heleWinkel(winkel, verhouding) {
  return beeldVoorPunten(
    [
      { x: 0, y: 0 },
      { x: winkel.breedte, y: winkel.diepte },
    ],
    verhouding,
    1.5,
  );
}

/**
 * Zoom met factor `f` rond punt (px, py): f > 1 is inzoomen.
 * Het punt onder je vingers blijft op dezelfde plek staan, net als in Google Maps.
 */
export function zoomRond(beeld, px, py, f) {
  const w = beeld.w / f;
  const h = beeld.h / f;
  return { x: px - (px - beeld.x) / f, y: py - (py - beeld.y) / f, w, h };
}

export function verschuif(beeld, dx, dy) {
  return { ...beeld, x: beeld.x - dx, y: beeld.y - dy };
}

/** Houdt het beeld binnen redelijke grenzen: niet te ver in- of uitgezoomd, winkel blijft in zicht. */
export function begrens(beeld, winkel, verhouding) {
  const max = heleWinkel(winkel, verhouding);
  let { x, y, w, h } = beeld;
  if (w > max.w * 1.5) {
    const f = w / (max.w * 1.5);
    ({ x, y, w, h } = zoomRond({ x, y, w, h }, x + w / 2, y + h / 2, f));
  }
  if (w < MIN_BREEDTE) {
    const f = w / MIN_BREEDTE;
    ({ x, y, w, h } = zoomRond({ x, y, w, h }, x + w / 2, y + h / 2, f));
  }
  // Midden van het beeld moet binnen de winkel blijven.
  const mx = Math.min(Math.max(x + w / 2, 0), winkel.breedte);
  const my = Math.min(Math.max(y + h / 2, 0), winkel.diepte);
  return { x: mx - w / 2, y: my - h / 2, w, h };
}

/** Schermpositie (px binnen het vak) → kaartpositie (meters). */
export function naarKaart(beeld, rect, sx, sy) {
  return { x: beeld.x + (sx / rect.width) * beeld.w, y: beeld.y + (sy / rect.height) * beeld.h };
}

/** Vloeiend overgaan tussen twee beelden; t van 0 tot 1. */
export function tussen(a, b, t) {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // zacht starten en stoppen
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
}

export const alsViewBox = (b) => `${b.x.toFixed(2)} ${b.y.toFixed(2)} ${b.w.toFixed(2)} ${b.h.toFixed(2)}`;
