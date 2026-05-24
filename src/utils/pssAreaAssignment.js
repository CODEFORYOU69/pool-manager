import { findPssInfo } from "./categories";

// Ordre naturel des tailles PSS
const PSS_ORDER = ["# 0", "# 1", "# 2", "# 3", "# 4", "# 4/5", "# 5"];

/**
 * Retourne la taille PSS d'un groupe via findPssInfo.
 * @param {Object} group - Un groupe avec gender, ageCategoryName, weightCategoryName
 * @returns {string|null} ex: "# 2" ou null si inconnu
 */
export const getPssForGroup = (group) => {
  if (!group) return null;

  const ageCategory = group.ageCategoryName || group.ageCategory?.name || "";
  const gender = group.gender || "";
  const weightCategory =
    group.weightCategoryName || group.weightCategory?.name || "";

  if (!ageCategory || !gender || !weightCategory) return null;

  const pssInfo = findPssInfo(ageCategory, gender, weightCategory);
  return pssInfo ? pssInfo.pss : null;
};

/**
 * Regroupe les groupes par taille PSS.
 * @param {Array} groups - Liste des groupes
 * @returns {Map<string, Array>} Map PSS -> groupes
 */
export const groupByPss = (groups) => {
  const map = new Map();

  groups.forEach((group) => {
    const pss = getPssForGroup(group);
    const key = pss || "unknown";
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(group);
  });

  return map;
};

/**
 * Estime le nombre de combats pour un groupe.
 * Formule : n * k / 2 (ou au minimum 1 si le groupe a des participants)
 * @param {Object} group - Groupe avec pools/participants
 * @param {number} defaultK - Nombre de combats par personne (defaut 3)
 * @returns {number}
 */
export const estimateMatchCount = (group, defaultK = 3) => {
  let n = 0;

  // Essayer d'obtenir le nombre de participants depuis les pools
  if (group.pools && group.pools.length > 0) {
    const pool = group.pools[0];
    if (pool.poolParticipants) {
      n = pool.poolParticipants.length;
    }
  }

  // Fallback sur les participants du groupe
  if (n === 0 && group.participants) {
    n = Array.isArray(group.participants) ? group.participants.length : 0;
  }

  if (n < 2) return 0;
  return Math.floor((n * defaultK) / 2);
};

/**
 * Algorithme principal : assigne les aires de combat par taille PSS.
 *
 * 1. Grouper les categories par taille PSS
 * 2. Trier par ordre naturel (#0 < #1 < #2 < #3 < #4 < #4/5)
 * 3. Si plus de tailles PSS que d'aires : fusionner les tailles adjacentes
 * 4. Distribuer les aires proportionnellement au nombre de combats estimes
 * 5. Retourner { pssSummary, groupAreaMap }
 *
 * @param {Array} groups - Liste des groupes
 * @param {number} numAreas - Nombre d'aires disponibles
 * @param {number} defaultK - Combats par personne (defaut 3)
 * @returns {{ pssSummary: Array, groupAreaMap: Object }}
 */
export const computePssAreaAssignment = (groups, numAreas, defaultK = 3) => {
  if (!groups || groups.length === 0 || numAreas < 1) {
    return { pssSummary: [], groupAreaMap: {} };
  }

  // 1. Grouper par PSS
  const pssMap = groupByPss(groups);

  // 2. Creer les slots tries par ordre naturel
  const slots = [];
  const knownPss = [];
  const unknownGroups = pssMap.get("unknown") || [];

  pssMap.forEach((grps, pssKey) => {
    if (pssKey !== "unknown") {
      knownPss.push({ pss: pssKey, groups: grps });
    }
  });

  // Trier par ordre PSS naturel
  knownPss.sort(
    (a, b) => PSS_ORDER.indexOf(a.pss) - PSS_ORDER.indexOf(b.pss)
  );

  knownPss.forEach((entry) => {
    slots.push({
      pssLabels: [entry.pss],
      groups: [...entry.groups],
      matchEstimate: entry.groups.reduce(
        (sum, g) => sum + estimateMatchCount(g, defaultK),
        0
      ),
    });
  });

  // 3a. Fusionner si plus de slots que d'aires (max 2 tailles par aire)
  while (slots.length > numAreas && slots.length > 1) {
    let minCombined = Infinity;
    let mergeIdx = 0;

    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i].pssLabels.length + slots[i + 1].pssLabels.length > 2) {
        continue;
      }
      const combined = slots[i].matchEstimate + slots[i + 1].matchEstimate;
      if (combined < minCombined) {
        minCombined = combined;
        mergeIdx = i;
      }
    }

    if (minCombined === Infinity) {
      mergeIdx = 0;
    }

    const merged = {
      pssLabels: [
        ...slots[mergeIdx].pssLabels,
        ...slots[mergeIdx + 1].pssLabels,
      ],
      groups: [...slots[mergeIdx].groups, ...slots[mergeIdx + 1].groups],
      matchEstimate:
        slots[mergeIdx].matchEstimate + slots[mergeIdx + 1].matchEstimate,
    };
    slots.splice(mergeIdx, 2, merged);
  }

  // 3b. Fusionner proactivement les petits slots adjacents pour equilibrer la charge
  //     Meme quand slots < aires, fusionner 2 petits slots adjacents peut
  //     liberer des aires pour un meilleur equilibrage (max 2 tailles par slot).
  const computeBalance = (slotsToCheck, totalAreas) => {
    if (slotsToCheck.length === 0) return 0;
    const total = slotsToCheck.reduce((s, sl) => s + sl.matchEstimate, 0);
    if (total === 0) return 0;
    // Simuler la distribution proportionnelle
    const alloc = slotsToCheck.map(() => 1);
    let rem = totalAreas - slotsToCheck.length;
    if (rem > 0) {
      const weights = slotsToCheck.map((s) => s.matchEstimate / total);
      const ideal = weights.map((w) => w * rem);
      const fl = ideal.map((a) => Math.floor(a));
      let allocated = fl.reduce((s, a) => s + a, 0);
      const remainders = ideal.map((a, i) => ({ idx: i, r: a - fl[i] }));
      remainders.sort((a, b) => b.r - a.r);
      let left = rem - allocated;
      for (let i = 0; i < left; i++) fl[remainders[i].idx]++;
      fl.forEach((extra, i) => { alloc[i] += extra; });
    }
    const perArea = slotsToCheck.map((s, i) =>
      alloc[i] > 0 ? s.matchEstimate / alloc[i] : 0
    );
    const max = Math.max(...perArea);
    const min = Math.min(...perArea.filter((v) => v > 0));
    return min > 0 ? max / min : Infinity;
  };

  let improved = true;
  while (improved && slots.length > 1) {
    improved = false;
    const currentRatio = computeBalance(slots, numAreas);
    // Pas besoin d'optimiser si deja bien equilibre (ratio < 1.4)
    // Un seuil de 1.4 evite de fusionner inutilement des slots deja corrects
    if (currentRatio < 1.4) break;

    let bestRatio = currentRatio;
    let bestMergeIdx = -1;

    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i].pssLabels.length + slots[i + 1].pssLabels.length > 2) {
        continue;
      }
      // Simuler la fusion
      const simSlots = [
        ...slots.slice(0, i),
        {
          pssLabels: [...slots[i].pssLabels, ...slots[i + 1].pssLabels],
          matchEstimate: slots[i].matchEstimate + slots[i + 1].matchEstimate,
        },
        ...slots.slice(i + 2),
      ];
      const ratio = computeBalance(simSlots, numAreas);
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestMergeIdx = i;
      }
    }

    if (bestMergeIdx >= 0) {
      const i = bestMergeIdx;
      const merged = {
        pssLabels: [...slots[i].pssLabels, ...slots[i + 1].pssLabels],
        groups: [...slots[i].groups, ...slots[i + 1].groups],
        matchEstimate: slots[i].matchEstimate + slots[i + 1].matchEstimate,
      };
      slots.splice(i, 2, merged);
      improved = true;
    }
  }

  // Ajouter les groupes inconnus au slot le moins charge
  if (unknownGroups.length > 0) {
    if (slots.length > 0) {
      const leastLoaded = slots.reduce((min, s) =>
        s.matchEstimate < min.matchEstimate ? s : min
      );
      leastLoaded.groups.push(...unknownGroups);
      leastLoaded.matchEstimate += unknownGroups.reduce(
        (sum, g) => sum + estimateMatchCount(g, defaultK),
        0
      );
    } else {
      // Pas de slots connus, creer un slot pour les inconnus
      slots.push({
        pssLabels: ["?"],
        groups: unknownGroups,
        matchEstimate: unknownGroups.reduce(
          (sum, g) => sum + estimateMatchCount(g, defaultK),
          0
        ),
      });
    }
  }

  // 4. Distribuer les aires proportionnellement
  const totalMatches = slots.reduce((sum, s) => sum + s.matchEstimate, 0);

  // Chaque slot recoit au moins 1 aire
  const areaAllocation = slots.map(() => 1);
  let remainingAreas = numAreas - slots.length;

  if (remainingAreas > 0 && totalMatches > 0) {
    // Distribuer les aires restantes proportionnellement aux combats
    const weights = slots.map((s) => s.matchEstimate / totalMatches);
    const idealAreas = weights.map((w) => w * remainingAreas);

    // Arrondi par plus grande fraction restante
    const floored = idealAreas.map((a) => Math.floor(a));
    let allocated = floored.reduce((sum, a) => sum + a, 0);
    const remainders = idealAreas.map((a, i) => ({
      idx: i,
      remainder: a - floored[i],
    }));
    remainders.sort((a, b) => b.remainder - a.remainder);

    let leftover = remainingAreas - allocated;
    for (let i = 0; i < leftover; i++) {
      floored[remainders[i].idx]++;
    }

    floored.forEach((extra, i) => {
      areaAllocation[i] += extra;
    });
  } else if (remainingAreas > 0) {
    // Si aucun combat estime, distribuer equitablement
    let i = 0;
    while (remainingAreas > 0) {
      areaAllocation[i % slots.length]++;
      remainingAreas--;
      i++;
    }
  }

  // 4b. Passe de reequilibrage : transferer une aire d'un slot moins charge
  //     vers le slot le plus surcharge tant que ca reduit la charge max.
  //     Resout les cas type [10 aires/530 combats, 2 aires/37 combats] qui
  //     devraient etre [11 aires/530, 1 aire/37] pour minimiser max(perArea).
  if (slots.length > 1) {
    let rebalancing = true;
    while (rebalancing) {
      rebalancing = false;
      const perArea = slots.map((s, i) =>
        areaAllocation[i] > 0 ? s.matchEstimate / areaAllocation[i] : 0
      );
      const maxIdx = perArea.indexOf(Math.max(...perArea));

      for (let donor = 0; donor < slots.length; donor++) {
        if (donor === maxIdx || areaAllocation[donor] <= 1) continue;
        const newMaxRecipient =
          slots[maxIdx].matchEstimate / (areaAllocation[maxIdx] + 1);
        const newMaxDonor =
          slots[donor].matchEstimate / (areaAllocation[donor] - 1);
        const otherMax = Math.max(
          ...perArea.filter((_, i) => i !== maxIdx && i !== donor)
        );
        const newGlobalMax = Math.max(
          newMaxRecipient,
          newMaxDonor,
          otherMax || 0
        );
        if (newGlobalMax < perArea[maxIdx] - 1e-9) {
          areaAllocation[donor]--;
          areaAllocation[maxIdx]++;
          rebalancing = true;
          break;
        }
      }
    }
  }

  // 5. Assigner les numeros d'aires
  let areaCounter = 1;
  const pssSummary = [];
  const groupAreaMap = {};

  slots.forEach((slot, slotIdx) => {
    const numAreasForSlot = areaAllocation[slotIdx];
    const areaNumbers = [];
    for (let i = 0; i < numAreasForSlot; i++) {
      areaNumbers.push(areaCounter++);
    }

    const matchesPerArea =
      numAreasForSlot > 0
        ? Math.round(slot.matchEstimate / numAreasForSlot)
        : 0;

    pssSummary.push({
      pssLabels: slot.pssLabels,
      areaNumbers,
      groups: slot.groups.map((g) => ({
        id: g.id,
        name: `${g.gender === "male" ? "H" : "F"} ${
          g.ageCategoryName || g.ageCategory?.name || ""
        } ${g.weightCategoryName || g.weightCategory?.name || ""}`.trim(),
      })),
      matchEstimate: slot.matchEstimate,
      matchesPerArea,
    });

    // Mapper chaque groupe a ses aires
    slot.groups.forEach((g) => {
      groupAreaMap[g.id] = areaNumbers;
    });
  });

  return { pssSummary, groupAreaMap };
};
