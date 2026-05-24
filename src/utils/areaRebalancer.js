/**
 * Calcule les déplacements de poules pour rééquilibrer la charge GLOBALE
 * entre toutes les aires, sans contrainte de slot PSS.
 *
 * Garde-fou : aucun déplacement n'est accepté s'il dégrade le max global.
 *
 * Entrée : pools[] avec { id, group, currentAreaNumber, matchCount }
 *
 * Sortie : { moves, summary }
 *  - moves : [{ poolId, fromAreaNumber, toAreaNumber, matchCount }]
 *  - summary : { before: {min, max, total}, after: {min, max, total} }
 *
 * @param {Array} pools
 * @param {number} threshold - tolérance d'écart max-min en nb de combats (def 8)
 */
export const computeRebalanceMoves = (pools, threshold = 8) => {
  // Copie de travail (sans muter l'entrée)
  const work = pools.map((p) => ({
    id: p.id,
    currentAreaNumber: p.currentAreaNumber,
    matchCount: p.matchCount,
  }));

  const moves = [];
  const summary = { before: stats(work) };

  let safety = 200;
  while (safety-- > 0) {
    const loadByArea = computeLoads(work);
    const sorted = Array.from(loadByArea.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    if (sorted.length < 2) break;

    const [donorArea, donorLoad] = sorted[0];
    const [recipientArea, recipientLoad] = sorted[sorted.length - 1];

    if (donorLoad - recipientLoad <= threshold) break;

    // Plus petite poule de donor dont la taille ≤ (donor - recipient) / 2
    // pour ne pas inverser le déséquilibre.
    const maxMovable = Math.floor((donorLoad - recipientLoad) / 2);
    const eligible = work
      .filter(
        (p) =>
          p.currentAreaNumber === donorArea &&
          p.matchCount > 0 &&
          p.matchCount <= maxMovable
      )
      .sort((a, b) => a.matchCount - b.matchCount);

    if (eligible.length === 0) break;

    const toMove = eligible[0];

    // Simulation : refuser si ça n'améliore pas le max global
    const simulatedLoads = new Map(loadByArea);
    simulatedLoads.set(donorArea, donorLoad - toMove.matchCount);
    simulatedLoads.set(recipientArea, recipientLoad + toMove.matchCount);
    const simMax = Math.max(...simulatedLoads.values());
    if (simMax >= donorLoad) break; // pas d'amélioration

    moves.push({
      poolId: toMove.id,
      fromAreaNumber: donorArea,
      toAreaNumber: recipientArea,
      matchCount: toMove.matchCount,
    });
    toMove.currentAreaNumber = recipientArea;
  }

  summary.after = stats(work);
  return { moves, summary };
};

const computeLoads = (work) => {
  const m = new Map();
  for (const p of work) {
    m.set(p.currentAreaNumber, (m.get(p.currentAreaNumber) || 0) + p.matchCount);
  }
  return m;
};

const stats = (work) => {
  const loads = Array.from(computeLoads(work).values());
  if (loads.length === 0) return { min: 0, max: 0, total: 0 };
  return {
    min: Math.min(...loads),
    max: Math.max(...loads),
    total: loads.reduce((s, l) => s + l, 0),
  };
};
