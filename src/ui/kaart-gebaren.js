// Vinger- en muisbediening van de kaart: slepen, knijpen om te zoomen, met twee vingers
// draaien, dubbeltikken, scrollwiel en tikken op een stop.
import { zoomRond, verschuif, begrens, naarKaart, tussen, alsViewBox, draaiRond, middenVan } from './kaart-beeld.js';

const TIK_MARGE = 8; // zo veel pixels mag een vinger bewegen en toch een "tik" zijn
const DRAAI_DREMPEL = 15; // pas na zoveel graden draaien met twee vingers draait de kaart mee (anders draait hij bij knijpen)
const KLIK_HOEK = 10; // binnen zoveel graden van recht klikt de kaart recht bij het loslaten

/**
 * @param {SVGSVGElement} svg
 * @param {object} opties
 * @param {object} opties.winkel
 * @param {() => object} opties.beeld  huidig beeld
 * @param {(beeld: object, doorGebruiker: boolean) => void} opties.zetBeeld
 * @param {(index: number) => void} opties.tikOpStop
 * @param {() => number} opties.hoek  hoe ver de kaart nu gedraaid is (graden)
 * @param {(hoek: number) => void} opties.zetHoek
 */
export function koppelGebaren(svg, { winkel, beeld, zetBeeld, tikOpStop, hoek, zetHoek }) {
  const vingers = new Map();
  let vorige = null; // vorige stand van één of twee vingers
  let bewogen = 0;
  let laatsteTik = 0;
  let gedraaid = 0; // graden gedraaid sinds de tweede vinger neerkwam
  let draaien = false; // draait de kaart mee met de vingers?
  const midden = middenVan(winkel);
  const rect = () => svg.getBoundingClientRect();
  const verhouding = () => rect().width / rect().height;
  const toon = (b, doorGebruiker = true) => {
    const begrensd = begrens(b, winkel, verhouding(), hoek());
    svg.setAttribute('viewBox', alsViewBox(begrensd));
    // Meters per schermpixel: zo blijven stippen, tekst en pijltjes op elk zoomniveau even groot.
    const m = begrensd.w / rect().width;
    svg.style.setProperty('--m', m.toFixed(4));
    svg.classList.toggle('dichtbij', m < 0.08); // ingezoomd: ook de namen van alle stops tonen
    zetBeeld(begrensd, doorGebruiker);
  };
  const lokaal = (e) => {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const stand = () => {
    const p = [...vingers.values()];
    if (p.length === 1) return { midden: p[0], afstand: 0, hoek: 0 };
    return {
      midden: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 },
      afstand: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
      hoek: (Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) * 180) / Math.PI,
    };
  };

  /** Kaart draaien met `punt` (beeldcoördinaten) als vast punt. */
  const draaiNaar = (b, nieuw, punt) => {
    const nb = draaiRond(b, punt.x, punt.y, hoek(), nieuw, midden);
    zetHoek(nieuw);
    return nb;
  };

  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    vingers.set(e.pointerId, lokaal(e));
    vorige = stand();
    if (vingers.size === 1) bewogen = 0;
    if (vingers.size === 2) (gedraaid = 0), (draaien = false);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!vingers.has(e.pointerId)) return;
    vingers.set(e.pointerId, lokaal(e));
    const nu = stand();
    const r = rect();
    let b = beeld();
    const schaal = b.w / r.width; // meters per pixel
    const dx = (nu.midden.x - vorige.midden.x) * schaal;
    const dy = (nu.midden.y - vorige.midden.y) * schaal;
    bewogen += Math.hypot(nu.midden.x - vorige.midden.x, nu.midden.y - vorige.midden.y);
    b = verschuif(b, dx, dy);
    if (vingers.size === 2 && vorige.afstand > 0 && nu.afstand > 0) {
      const punt = naarKaart(b, r, nu.midden.x, nu.midden.y);
      b = zoomRond(b, punt.x, punt.y, nu.afstand / vorige.afstand);
      bewogen += TIK_MARGE; // knijpen is nooit een tik
      // Draaien met twee vingers, zoals in Google Maps.
      let delta = nu.hoek - vorige.hoek;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      gedraaid += delta;
      if (!draaien && Math.abs(gedraaid) > DRAAI_DREMPEL) (draaien = true), (delta = gedraaid);
      if (draaien) b = draaiNaar(b, hoek() + delta, punt);
    }
    vorige = nu;
    toon(b);
  });

  const los = (e) => {
    if (!vingers.has(e.pointerId)) return;
    const wasEnkel = vingers.size === 1;
    vingers.delete(e.pointerId);
    vorige = vingers.size ? stand() : null;
    if (draaien && vingers.size < 2) {
      draaien = false;
      // Bijna recht? Dan precies recht zetten (0, 90, 180 of 270 graden).
      const recht = Math.round(hoek() / 90) * 90;
      if (recht !== hoek() && Math.abs(recht - hoek()) <= KLIK_HOEK) {
        const b = beeld();
        toon(draaiNaar(b, recht, { x: b.x + b.w / 2, y: b.y + b.h / 2 }));
      }
    }
    if (!wasEnkel || bewogen > TIK_MARGE || e.type === 'pointercancel') return;

    // Een tik: op een stop, of dubbeltik om in te zoomen.
    // Door setPointerCapture is e.target altijd de kaart zelf; kijk wat er écht onder de vinger zit.
    const stop = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-stop]');
    if (stop) return tikOpStop(Number(stop.dataset.stop));
    const nu = Date.now();
    if (nu - laatsteTik < 300) {
      const p = lokaal(e);
      const punt = naarKaart(beeld(), rect(), p.x, p.y);
      animeer(svg, beeld(), zoomRond(beeld(), punt.x, punt.y, 2), (b) => toon(b));
      laatsteTik = 0;
    } else laatsteTik = nu;
  };
  svg.addEventListener('pointerup', los);
  svg.addEventListener('pointercancel', los);

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = lokaal(e);
      const punt = naarKaart(beeld(), rect(), p.x, p.y);
      toon(zoomRond(beeld(), punt.x, punt.y, Math.exp(-e.deltaY * 0.002)));
    },
    { passive: false },
  );

  /** Vloeiend draaien naar een hoek (knoppen), met het midden van het beeld als vast punt. */
  const draaiAnimatie = (naar) => {
    const van = hoek();
    const minderBeweging = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const duur = minderBeweging ? 0 : 350;
    const stap = (tijd) => {
      const t = duur ? Math.min(1, (tijd - start) / duur) : 1;
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const b = beeld();
      toon(draaiNaar(b, van + (naar - van) * e, { x: b.x + b.w / 2, y: b.y + b.h / 2 }));
      if (t < 1 && svg.isConnected) requestAnimationFrame(stap);
    };
    requestAnimationFrame(stap);
  };

  return { toon, draaiAnimatie };
}

/** Vloeiend van beeld a naar beeld b (± 0,35 s); direct als je minder beweging wilt. */
export function animeer(svg, a, b, toon) {
  const minderBeweging = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (minderBeweging) return toon(b);
  const start = performance.now();
  const duur = 350;
  const stap = (nu) => {
    const t = Math.min(1, (nu - start) / duur);
    toon(tussen(a, b, t));
    if (t < 1 && svg.isConnected) requestAnimationFrame(stap);
  };
  requestAnimationFrame(stap);
}
