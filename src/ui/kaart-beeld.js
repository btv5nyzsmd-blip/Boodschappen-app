// Rekenwerk voor het kaartbeeld: welk stuk van de winkel je ziet (de "viewBox"),
// inzoomen rond een punt, verschuiven, draaien en binnen de winkel blijven.
// Alles in meters; geen schermcode, zodat het makkelijk te testen is.
//
// Draaien: de hele plattegrond draait rond het midden van de winkel. Het beeld (viewBox)
// ligt in die gedraaide ruimte; met `draai` reken je een winkelpunt om naar die ruimte.

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

export const middenVan = (winkel) => ({ x: winkel.breedte / 2, y: winkel.diepte / 2 });

/** Winkelpunt p zoals het op de kaart staat als die `hoek` graden (met de klok mee) is gedraaid. */
export function draai(p, hoek, midden) {
  if (!hoek) return { x: p.x, y: p.y };
  const r = (hoek * Math.PI) / 180;
  const dx = p.x - midden.x;
  const dy = p.y - midden.y;
  return { x: midden.x + dx * Math.cos(r) - dy * Math.sin(r), y: midden.y + dx * Math.sin(r) + dy * Math.cos(r) };
}

/** De vier hoeken van de winkel op de gedraaide kaart. */
function hoekpunten(winkel, hoek) {
  const m = middenVan(winkel);
  return [
    { x: 0, y: 0 },
    { x: winkel.breedte, y: 0 },
    { x: 0, y: winkel.diepte },
    { x: winkel.breedte, y: winkel.diepte },
  ].map((p) => draai(p, hoek, m));
}

/** De hele winkel in beeld. */
export function heleWinkel(winkel, verhouding, hoek = 0) {
  return beeldVoorPunten(hoekpunten(winkel, hoek), verhouding, 1.5);
}

/**
 * Draai de kaart van hoek `oud` naar `nieuw`, waarbij punt (px, py) van het beeld
 * op dezelfde plek op het scherm blijft (het punt tussen je vingers, of het midden).
 */
export function draaiRond(beeld, px, py, oud, nieuw, midden) {
  const winkelpunt = draai({ x: px, y: py }, -oud, midden);
  const p = draai(winkelpunt, nieuw, midden);
  return { ...beeld, x: beeld.x + p.x - px, y: beeld.y + p.y - py };
}

/** Hoek tussen -180 en 180 graden. */
export const normaliseerHoek = (h) => ((((h + 180) % 360) + 360) % 360) - 180;

/** Hoek voor tekst langs een pad, zo dat die nooit op z'n kop staat. */
export function leesbaar(hoek) {
  const h = normaliseerHoek(hoek);
  if (h > 90) return h - 180;
  if (h <= -90) return h + 180;
  return h;
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
export function begrens(beeld, winkel, verhouding, hoek = 0) {
  const max = heleWinkel(winkel, verhouding, hoek);
  let { x, y, w, h } = beeld;
  if (w > max.w * 1.5) {
    const f = w / (max.w * 1.5);
    ({ x, y, w, h } = zoomRond({ x, y, w, h }, x + w / 2, y + h / 2, f));
  }
  if (w < MIN_BREEDTE) {
    const f = w / MIN_BREEDTE;
    ({ x, y, w, h } = zoomRond({ x, y, w, h }, x + w / 2, y + h / 2, f));
  }
  // Midden van het beeld moet binnen de (gedraaide) winkel blijven.
  const hoeken = hoekpunten(winkel, hoek);
  const xs = hoeken.map((p) => p.x);
  const ys = hoeken.map((p) => p.y);
  const mx = Math.min(Math.max(x + w / 2, Math.min(...xs)), Math.max(...xs));
  const my = Math.min(Math.max(y + h / 2, Math.min(...ys)), Math.max(...ys));
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
