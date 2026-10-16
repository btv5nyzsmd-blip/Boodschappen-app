// Bouwt een netwerk van looppaden uit de winkelplattegrond.
//
// Een looppad is een rechte lijn waarover je kunt lopen ("van" → "naar").
// Waar looppaden elkaar kruisen ontstaat een knooppunt. Ingang, kassa's en
// secties worden op het dichtstbijzijnde looppad "geprikt", zodat de afstand
// altijd langs de paden wordt gemeten en nooit dwars door een schap.

const AFRONDING = 100; // knooppunten binnen 1 cm van elkaar zijn hetzelfde punt

function sleutel(x, y) {
  return `${Math.round(x * AFRONDING) / AFRONDING},${Math.round(y * AFRONDING) / AFRONDING}`;
}

function afstand(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Dichtstbijzijnde punt op lijnstuk p→q vanaf punt a. Geeft {x, y, t, d}. */
export function projecteer(a, p, q) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const lengte2 = dx * dx + dy * dy;
  let t = lengte2 === 0 ? 0 : ((a.x - p.x) * dx + (a.y - p.y) * dy) / lengte2;
  t = Math.max(0, Math.min(1, t));
  const x = p.x + t * dx;
  const y = p.y + t * dy;
  return { x, y, t, d: Math.hypot(a.x - x, a.y - y) };
}

/** Snijpunt van twee lijnstukken, of null. */
function snijpunt(p1, q1, p2, q2) {
  const r = { x: q1.x - p1.x, y: q1.y - p1.y };
  const s = { x: q2.x - p2.x, y: q2.y - p2.y };
  const noemer = r.x * s.y - r.y * s.x;
  if (Math.abs(noemer) < 1e-9) return null; // evenwijdig
  const t = ((p2.x - p1.x) * s.y - (p2.y - p1.y) * s.x) / noemer;
  const u = ((p2.x - p1.x) * r.y - (p2.y - p1.y) * r.x) / noemer;
  const marge = 1e-9;
  if (t < -marge || t > 1 + marge || u < -marge || u > 1 + marge) return null;
  return { x: p1.x + t * r.x, y: p1.y + t * r.y, t, u };
}

function naarPunt([x, y]) {
  return { x, y };
}

/**
 * Alle punten die de route moet kunnen bezoeken: ingang, kassa's en secties.
 * Elk punt krijgt een id: "ingang", "kassa:<naam>" of de sectie-id.
 */
export function routePunten(winkel) {
  const punten = [{ id: 'ingang', x: winkel.ingang.x, y: winkel.ingang.y, looppad: winkel.ingang.looppad }];
  for (const kassa of winkel.kassas) {
    punten.push({ id: `kassa:${kassa.naam}`, x: kassa.x, y: kassa.y, looppad: kassa.looppad });
  }
  for (const sectie of winkel.secties) {
    punten.push({ id: sectie.id, x: sectie.x, y: sectie.y, looppad: sectie.looppad });
  }
  return punten;
}

/**
 * Maakt het looppadennetwerk.
 * @returns {{ knopen: Map<string,{x:number,y:number}>, buren: Map<string,{naar:string,d:number}[]>, puntKnoop: Map<string,string> }}
 */
export function bouwNetwerk(winkel) {
  const paden = winkel.looppaden.map((p) => ({ id: p.id, van: naarPunt(p.van), naar: naarPunt(p.naar) }));
  if (paden.length === 0) throw new Error('De winkel heeft geen looppaden.');

  // Per looppad: de punten die erop liggen, met hun positie t (0 = begin, 1 = eind).
  const opPad = paden.map((p) => [
    { x: p.van.x, y: p.van.y, t: 0 },
    { x: p.naar.x, y: p.naar.y, t: 1 },
  ]);

  // Kruisingen tussen looppaden.
  for (let i = 0; i < paden.length; i++) {
    for (let j = i + 1; j < paden.length; j++) {
      const s = snijpunt(paden[i].van, paden[i].naar, paden[j].van, paden[j].naar);
      if (s) {
        opPad[i].push({ x: s.x, y: s.y, t: s.t });
        opPad[j].push({ x: s.x, y: s.y, t: s.u });
      }
    }
  }

  // Ingang, kassa's en secties op het (opgegeven of dichtstbijzijnde) looppad prikken.
  const puntKnoop = new Map();
  for (const punt of routePunten(winkel)) {
    let beste = null;
    paden.forEach((pad, index) => {
      if (punt.looppad && punt.looppad !== pad.id) return;
      const proj = projecteer(punt, pad.van, pad.naar);
      if (!beste || proj.d < beste.proj.d) beste = { index, proj };
    });
    if (!beste) throw new Error(`Looppad "${punt.looppad}" van punt "${punt.id}" bestaat niet.`);
    const { x, y, t } = beste.proj;
    opPad[beste.index].push({ x, y, t });
    puntKnoop.set(punt.id, sleutel(x, y));
  }

  // Knopen en verbindingen: opeenvolgende punten op hetzelfde looppad.
  const knopen = new Map();
  const buren = new Map();
  const voegKnoopToe = (p) => {
    const k = sleutel(p.x, p.y);
    if (!knopen.has(k)) {
      knopen.set(k, { x: p.x, y: p.y });
      buren.set(k, []);
    }
    return k;
  };
  for (const punten of opPad) {
    punten.sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < punten.length; i++) {
      const a = voegKnoopToe(punten[i]);
      const b = voegKnoopToe(punten[i + 1]);
      if (a === b) continue;
      const d = afstand(punten[i], punten[i + 1]);
      buren.get(a).push({ naar: b, d });
      buren.get(b).push({ naar: a, d });
    }
  }

  return { knopen, buren, puntKnoop };
}
