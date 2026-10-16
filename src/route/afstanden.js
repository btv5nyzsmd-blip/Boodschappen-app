// Kortste loopafstanden in het looppadennetwerk (algoritme van Dijkstra).

/** Kortste afstanden vanaf één knoop naar alle andere. */
export function dijkstra(netwerk, start) {
  const afstand = new Map([[start, 0]]);
  const vorige = new Map();
  const klaar = new Set();
  // Het netwerk heeft hooguit een paar honderd knopen, dus een simpele
  // lijst als wachtrij is snel genoeg en makkelijk te lezen.
  const open = new Set([start]);

  while (open.size > 0) {
    let huidige = null;
    for (const k of open) {
      if (huidige === null || afstand.get(k) < afstand.get(huidige)) huidige = k;
    }
    open.delete(huidige);
    klaar.add(huidige);

    for (const { naar, d } of netwerk.buren.get(huidige)) {
      if (klaar.has(naar)) continue;
      const nieuw = afstand.get(huidige) + d;
      if (!afstand.has(naar) || nieuw < afstand.get(naar)) {
        afstand.set(naar, nieuw);
        vorige.set(naar, huidige);
        open.add(naar);
      }
    }
  }
  return { afstand, vorige };
}

/** Het looppad (lijst van knopen) van start naar doel, uit een dijkstra-resultaat. */
export function padNaar(resultaat, start, doel) {
  const pad = [doel];
  let k = doel;
  while (k !== start) {
    k = resultaat.vorige.get(k);
    if (k === undefined) return null; // onbereikbaar
    pad.push(k);
  }
  return pad.reverse();
}

/**
 * Afstandstabel tussen een lijst routepunten (ids zoals "ingang" of een sectie-id).
 * @returns {{ ids: string[], d: number[][], pad: (i:number, j:number) => {x:number,y:number}[] }}
 */
export function afstandenTabel(netwerk, ids) {
  const knopen = ids.map((id) => {
    const k = netwerk.puntKnoop.get(id);
    if (!k) throw new Error(`Onbekend routepunt: ${id}`);
    return k;
  });
  const resultaten = knopen.map((k) => dijkstra(netwerk, k));
  const d = knopen.map((_, i) =>
    knopen.map((doel) => {
      const waarde = resultaten[i].afstand.get(doel);
      if (waarde === undefined) throw new Error(`"${ids[i]}" kan "${ids[knopen.indexOf(doel)]}" niet bereiken. Sluiten alle looppaden op elkaar aan?`);
      return waarde;
    }),
  );
  const pad = (i, j) => padNaar(resultaten[i], knopen[i], knopen[j]).map((k) => netwerk.knopen.get(k));
  return { ids, d, pad };
}
