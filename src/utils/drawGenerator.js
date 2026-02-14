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
 * Génère un graphe K-régulier aléatoire.
 * Chaque combattant a exactement K adversaires différents.
 *
 * @param {string[]} fighterIds - IDs des combattants
 * @param {number} k - combats par personne
 * @returns {Array<{fighterA: string, fighterB: string}>} Liste de paires (combats)
 */
export const generateKRegularDraw = (fighterIds, k) => {
  const n = fighterIds.length;
  const validation = validateFightsChoice(n, k);
  if (!validation.valid) {
    throw new Error(validation.reason || "Combinaison N×K invalide");
  }

  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 1. Créer une liste de stubs : chaque combattant apparaît K fois
    const stubs = [];
    for (const id of fighterIds) {
      for (let i = 0; i < k; i++) {
        stubs.push(id);
      }
    }

    // 2. Mélanger aléatoirement
    shuffle(stubs);

    // 3. Former des paires consécutives
    const pairs = [];
    let valid = true;
    const edgeSet = new Set();

    for (let i = 0; i < stubs.length; i += 2) {
      const a = stubs[i];
      const b = stubs[i + 1];

      // 4. Valider : pas de self-loop
      if (a === b) {
        valid = false;
        break;
      }

      // Pas de multi-edge (A vs B apparaît 2 fois)
      const edgeKey = [a, b].sort().join("|");
      if (edgeSet.has(edgeKey)) {
        valid = false;
        break;
      }

      edgeSet.add(edgeKey);
      pairs.push({ fighterA: a, fighterB: b });
    }

    if (valid) {
      return pairs;
    }
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
