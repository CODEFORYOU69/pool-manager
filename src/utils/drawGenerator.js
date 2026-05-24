/**
 * Utilitaires pour le tirage aléatoire du mode "Poule Unique + Finales"
 * Génère un graphe K-régulier aléatoire et organise les combats en tours.
 */

/**
 * Valide la compatibilité N × K.
 * @param {number} n - nombre de combattants
 * @param {number} k - combats par personne (2, 3 ou 4)
 * @returns {{ valid: boolean, totalFights?: number, alternatives?: number[] }}
 */
export const validateFightsChoice = (n, k) => {
  if (k >= n) {
    return { valid: false, reason: "Pas assez de combattants pour ce nombre de combats" };
  }
  if ((n * k) % 2 !== 0) {
    return { valid: false, alternatives: [2, 4], reason: "Combinaison impossible (N×K doit être pair)" };
  }
  return { valid: true, totalFights: (n * k) / 2 };
};

/**
 * Mélange un tableau en place (Fisher-Yates).
 * @param {Array} array
 * @returns {Array} le même tableau mélangé
 */
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Tente une fois un tirage K-régulier aléatoire.
 * Retourne les paires si valide, sinon null.
 */
const attemptKRegularDraw = (fighterIds, k) => {
  const stubs = [];
  for (const id of fighterIds) {
    for (let i = 0; i < k; i++) stubs.push(id);
  }
  shuffle(stubs);

  const pairs = [];
  const edgeSet = new Set();

  for (let i = 0; i < stubs.length; i += 2) {
    const a = stubs[i];
    const b = stubs[i + 1];
    if (a === b) return null;
    const edgeKey = [a, b].sort().join("|");
    if (edgeSet.has(edgeKey)) return null;
    edgeSet.add(edgeKey);
    pairs.push({ fighterA: a, fighterB: b });
  }
  return pairs;
};

/**
 * Score un tirage selon la règle :
 *   coût = (combats même CLUB) × 100 + (combats même LIGUE) × 1
 * Plus c'est bas, mieux c'est.
 */
const scoreDraw = (pairs, participantsMap) => {
  let clubCollisions = 0;
  let ligueCollisions = 0;
  for (const { fighterA, fighterB } of pairs) {
    const a = participantsMap?.[fighterA] || {};
    const b = participantsMap?.[fighterB] || {};
    if (a.club && b.club && a.club === b.club) clubCollisions++;
    else if (a.ligue && b.ligue && a.ligue === b.ligue) ligueCollisions++;
  }
  return { score: clubCollisions * 100 + ligueCollisions, clubCollisions, ligueCollisions };
};

/**
 * Génère un graphe K-régulier aléatoire en minimisant les combats
 * "même club" puis "même ligue". Tente N fois et retient le meilleur.
 *
 * @param {string[]} fighterIds - IDs des combattants
 * @param {number} k - combats par personne
 * @param {Object} [participantsMap] - Map id → { club, ligue } pour scoring
 * @returns {Array<{fighterA: string, fighterB: string}>} Liste de paires (combats)
 */
export const generateKRegularDraw = (fighterIds, k, participantsMap = null) => {
  const n = fighterIds.length;
  const validation = validateFightsChoice(n, k);
  if (!validation.valid) {
    throw new Error(validation.reason || "Combinaison N×K invalide");
  }

  const maxAttempts = participantsMap ? 200 : 100;
  let bestPairs = null;
  let bestScore = Infinity;
  let bestStats = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pairs = attemptKRegularDraw(fighterIds, k);
    if (!pairs) continue;

    if (!participantsMap) {
      // Pas de scoring : on garde le premier valide (ancien comportement)
      return pairs;
    }

    const { score, clubCollisions, ligueCollisions } = scoreDraw(pairs, participantsMap);
    if (score < bestScore) {
      bestScore = score;
      bestPairs = pairs;
      bestStats = { clubCollisions, ligueCollisions };
      // Tirage parfait, on s'arrête
      if (score === 0) break;
    }
  }

  if (bestPairs) {
    if (bestStats && (bestStats.clubCollisions > 0 || bestStats.ligueCollisions > 0)) {
      console.log(
        `[Tirage] meilleur trouvé : ${bestStats.clubCollisions} combats même club, ${bestStats.ligueCollisions} combats même ligue (forcés)`
      );
    }
    return bestPairs;
  }

  throw new Error(`Impossible de générer un tirage valide après ${maxAttempts} tentatives`);
};

/**
 * Organise les combats en tours (matching maximum par tour).
 * Chaque combattant ne combat qu'une fois par tour.
 *
 * @param {Array<{fighterA: string, fighterB: string}>} fights - Paires de combats
 * @returns {Array<Array<{fighterA: string, fighterB: string}>>} Combats groupés par tour
 */
export const organizeFightsIntoTours = (fights) => {
  const remaining = [...fights];
  const tours = [];

  while (remaining.length > 0) {
    const currentTour = [];
    const busy = new Set();
    const toRemove = [];

    for (let i = 0; i < remaining.length; i++) {
      const fight = remaining[i];
      if (!busy.has(fight.fighterA) && !busy.has(fight.fighterB)) {
        currentTour.push(fight);
        busy.add(fight.fighterA);
        busy.add(fight.fighterB);
        toRemove.push(i);
      }
    }

    // Retirer les combats placés (en commençant par la fin pour préserver les indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      remaining.splice(toRemove[i], 1);
    }

    tours.push(currentTour);
  }

  return tours;
};

/**
 * Résumé du tirage : pour chaque combattant, liste ses adversaires.
 * @param {Array<{fighterA: string, fighterB: string}>} fights
 * @param {Object} participantsMap - Map id → participant object
 * @returns {Array<{fighter: object, opponents: object[]}>}
 */
export const summarizeDraw = (fights, participantsMap) => {
  const adjacency = {};

  fights.forEach(({ fighterA, fighterB }) => {
    if (!adjacency[fighterA]) adjacency[fighterA] = [];
    if (!adjacency[fighterB]) adjacency[fighterB] = [];
    adjacency[fighterA].push(fighterB);
    adjacency[fighterB].push(fighterA);
  });

  return Object.entries(adjacency).map(([id, opponentIds]) => ({
    fighter: participantsMap[id] || { id },
    opponents: opponentIds.map((oid) => participantsMap[oid] || { id: oid }),
  }));
};
