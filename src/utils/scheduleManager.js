import { v4 as uuidv4 } from "uuid";

/**
 * Crée le planning des combats sur les différentes aires
 * @param {Array} matches - Liste des combats
 * @param {Object} config - Configuration du tournoi
 * @returns {Object} - Planning des combats et statistiques
 */
const createSchedule = (matches, config) => {
  if (!matches || !config) {
    throw new Error("Combats ou configuration manquants");
  }

  console.log("Début de la création du planning des combats");

  // Configurer les paramètres
  const numAreas = config.numAreas || config.numberOfAreas || 1;
  console.log(`Nombre d'aires de combat: ${numAreas}`);

  // Paramètres temporels
  const roundDurationSeconds = config.roundDuration || 120; // Durée d'un round
  const breakBetweenRoundsSeconds = 30; // 30 secondes entre les rounds
  const matchDurationSeconds =
    roundDurationSeconds * 3 + breakBetweenRoundsSeconds * 2 + 60; // Ajout d'une minute pour l'installation/changement
  const breakBetweenMatchesSeconds = 60; // 1 minute entre les combats
  const breakDurationSeconds = config.breakDuration || 300; // Durée des pauses
  const breakFrequency = config.breakFrequency || 10; // Fréquence des pauses

  // Durée moyenne d'un combat (8 minutes par défaut comme recommandé)
  const averageMatchDurationMinutes = 8;

  // Heure de début (commune à toutes les aires)
  const startTime = config.startTime || new Date();

  // Regrouper les matchs par poule
  const poolsWithMatches = groupMatchesByGroupAndPool(matches);
  console.log(`Nombre de poules trouvées: ${poolsWithMatches.length}`);

  // Analyser les poules pour identifier la taille de chaque poule
  const poolSizes = analyzePoolSizes(poolsWithMatches);
  console.log("Tailles des poules identifiées:", poolSizes);

  // Distribuer les poules entre les aires
  const poolsPerArea = distributePoolsWithSmartAssignment(
    poolsWithMatches,
    numAreas,
    poolSizes
  );

  // Vérifier la répartition des poules par aire
  poolsPerArea.forEach((pools, index) => {
    console.log(
      `Aire ${index + 1}: ${pools.length} poules, ${calculateTotalMatches(
        pools
      )} matchs`
    );
  });

  // Créer le planning pour chaque aire
  const schedule = [];
  const updatedMatches = []; // Liste des matchs avec leurs numéros et aires attribués

  // Pour chaque aire
  for (let areaIndex = 0; areaIndex < numAreas; areaIndex++) {
    const areaNumber = areaIndex + 1;
    const poolsForThisArea = poolsPerArea[areaIndex] || [];

    // Si aucune poule n'est attribuée à cette aire, passer à la suivante
    if (poolsForThisArea.length === 0) {
      console.log(
        `Aucune poule attribuée à l'aire ${areaNumber}, passage à la suivante`
      );
      continue;
    }

    // Pour cette aire, on commence avec le numéro de match selon l'aire
    // Par exemple: Aire 1 = 101, Aire 2 = 201, etc.
    let matchNumberCounter = 1;
    let currentMatchTime = new Date(startTime);
    let matchCount = 0;

    // Ensemble pour suivre les combattants récents et éviter les combats consécutifs
    const recentFighters = new Set();

    // Organisez intelligemment les matchs pour éviter que le même combattant combat deux fois de suite
    const allMatches = organizePoolMatchesWithSpacing(
      poolsForThisArea,
      poolSizes
    );

    // Planifier chaque match
    for (const match of allMatches) {
      const matchNumber = areaNumber * 100 + matchNumberCounter;

      // Extraire les IDs des combattants pour les ajouter à la liste des récents
      const fighterIds = [];
      if (match.participants && match.participants.length >= 2) {
        fighterIds.push(match.participants[0].id);
        fighterIds.push(match.participants[1].id);
      }

      // Calculer l'heure de fin du match
      const matchEndTime = new Date(currentMatchTime);
      matchEndTime.setSeconds(matchEndTime.getSeconds() + matchDurationSeconds);

      // Créer l'objet de planification
      const scheduleItem = {
        id: uuidv4(),
        type: "match",
        matchId: match.id,
        areaNumber: areaNumber,
        startTime: currentMatchTime.toISOString(),
        endTime: matchEndTime.toISOString(),
        matchNumber: matchNumber,
      };

      // Ajouter au planning global
      schedule.push(scheduleItem);

      // Ajouter le match mis à jour à la liste
      updatedMatches.push({
        ...match,
        matchNumber,
        startTime: currentMatchTime.toISOString(),
        areaNumber,
      });

      // Incrémenter le compteur de match
      matchNumberCounter++;

      // Mettre à jour l'heure pour le prochain match
      currentMatchTime = new Date(matchEndTime);
      currentMatchTime.setSeconds(
        currentMatchTime.getSeconds() + breakBetweenMatchesSeconds
      );

      // Ajouter une pause après un certain nombre de combats
      matchCount++;
      if (matchCount % breakFrequency === 0) {
        const breakEndTime = new Date(currentMatchTime);
        breakEndTime.setSeconds(
          breakEndTime.getSeconds() + breakDurationSeconds
        );

        // Créer l'objet de planification de la pause
        const breakItem = {
          id: uuidv4(),
          type: "break",
          areaNumber: areaNumber,
          startTime: currentMatchTime.toISOString(),
          endTime: breakEndTime.toISOString(),
        };

        schedule.push(breakItem);

        // Mettre à jour l'heure après la pause
        currentMatchTime = new Date(breakEndTime);
      }
    }
  }

  // Trier le planning global par aire puis par heure de début
  schedule.sort((a, b) => {
    if (a.areaNumber !== b.areaNumber) {
      return a.areaNumber - b.areaNumber;
    }
    return new Date(a.startTime) - new Date(b.startTime);
  });

  // Calculer la durée estimée de la compétition
  // On prend l'aire avec le plus de combats pour déterminer la durée totale
  const matchesPerArea = {};
  updatedMatches.forEach((match) => {
    if (!matchesPerArea[match.areaNumber]) {
      matchesPerArea[match.areaNumber] = 0;
    }
    matchesPerArea[match.areaNumber]++;
  });

  // Trouver l'aire avec le plus de combats
  let maxMatches = 0;
  let maxMatchesArea = 0;

  for (const [area, count] of Object.entries(matchesPerArea)) {
    if (count > maxMatches) {
      maxMatches = count;
      maxMatchesArea = parseInt(area);
    }
  }

  // Calculer le temps total estimé en minutes
  const pauseTime =
    Math.floor(maxMatches / breakFrequency) * (breakDurationSeconds / 60);
  const totalDuration = maxMatches * averageMatchDurationMinutes + pauseTime;

  // Calculer l'heure de fin estimée
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + totalDuration);

  const stats = {
    totalMatches: updatedMatches.length,
    totalAreas: numAreas,
    totalDuration: totalDuration,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  console.log(
    `Planning créé avec succès: ${updatedMatches.length} matchs planifiés`
  );
  console.log(`Durée estimée: ${totalDuration} minutes`);
  console.log(`Heure de fin estimée: ${endTime.toLocaleTimeString()}`);

  return { schedule, updatedMatches, stats };
};

/**
 * Analyse les tailles des poules
 * @param {Array} pools - Liste des poules avec leurs matchs
 * @returns {Object} - Mapping entre ID de poule et taille de la poule
 */
const analyzePoolSizes = (pools) => {
  const poolSizes = {};

  pools.forEach((pool) => {
    const poolId = `${pool.groupId}-${pool.poolIndex}`;

    // Compter les participants uniques dans cette poule
    const uniqueParticipants = new Set();

    pool.matches.forEach((match) => {
      if (match.participants && match.participants.length >= 2) {
        uniqueParticipants.add(match.participants[0].id);
        uniqueParticipants.add(match.participants[1].id);
      }
    });

    poolSizes[poolId] = uniqueParticipants.size;
  });

  return poolSizes;
};

/**
 * Distribue les poules entre les aires de façon intelligente
 * en regroupant les poules de taille 3 avec d'autres poules
 * @param {Array} poolsWithMatches - Poules groupées avec leurs matchs
 * @param {number} numAreas - Nombre d'aires
 * @param {Object} poolSizes - Tailles des poules
 * @returns {Array} - Distribution des poules par aire
 */
const distributePoolsWithSmartAssignment = (
  poolsWithMatches,
  numAreas,
  poolSizes
) => {
  // Séparer les poules de taille 3 des autres poules
  const poolsOfSize3 = [];
  const otherPools = [];

  poolsWithMatches.forEach((pool) => {
    const poolId = `${pool.groupId}-${pool.poolIndex}`;
    if (poolSizes[poolId] === 3) {
      poolsOfSize3.push(pool);
    } else {
      otherPools.push(pool);
    }
  });

  // Trier les poules par nombre de matchs (décroissant)
  const sortedOtherPools = [...otherPools].sort(
    (a, b) => b.matches.length - a.matches.length
  );

  // Initialiser les aires
  const areas = Array(numAreas)
    .fill()
    .map(() => []);

  // D'abord, distribuer les poules normales
  sortedOtherPools.forEach((pool) => {
    // Trouver l'aire avec le moins de combats
    let minArea = 0;
    let minMatches = calculateTotalMatches(areas[0]);

    for (let i = 1; i < numAreas; i++) {
      const totalMatches = calculateTotalMatches(areas[i]);
      if (totalMatches < minMatches) {
        minArea = i;
        minMatches = totalMatches;
      }
    }

    // Ajouter la poule à cette aire
    areas[minArea].push(pool);
  });

  // Ensuite, distribuer les poules de taille 3
  // en s'assurant qu'elles sont réparties entre plusieurs aires
  poolsOfSize3.forEach((pool) => {
    // Trouver l'aire avec le moins de poules de taille 3
    let minArea = 0;
    let minPoolsOfSize3 = countPoolsOfSize3(areas[0], poolSizes);

    for (let i = 1; i < numAreas; i++) {
      const countSize3 = countPoolsOfSize3(areas[i], poolSizes);
      if (countSize3 < minPoolsOfSize3) {
        minArea = i;
        minPoolsOfSize3 = countSize3;
      }
    }

    // Ajouter la poule à cette aire
    areas[minArea].push(pool);
  });

  return areas;
};

/**
 * Compte le nombre de poules de taille 3 dans une aire
 * @param {Array} poolsInArea - Poules dans une aire
 * @param {Object} poolSizes - Tailles des poules
 * @returns {number} - Nombre de poules de taille 3
 */
const countPoolsOfSize3 = (poolsInArea, poolSizes) => {
  return poolsInArea.filter((pool) => {
    const poolId = `${pool.groupId}-${pool.poolIndex}`;
    return poolSizes[poolId] === 3;
  }).length;
};

/**
 * Organise les matchs des poules avec espacement entre les matchs des mêmes combattants
 * avec traitement spécial pour les poules de taille 3
 * @param {Array} pools - Poules affectées à une aire
 * @param {Object} poolSizes - Tailles des poules
 * @returns {Array} - Liste organisée de matchs
 */
const organizePoolMatchesWithSpacing = (pools, poolSizes) => {
  // Séparer les poules par taille
  const poolsBySize = {
    size3: [],
    others: [],
  };

  pools.forEach((pool) => {
    const poolId = `${pool.groupId}-${pool.poolIndex}`;
    if (poolSizes[poolId] === 3) {
      poolsBySize.size3.push(pool);
    } else {
      poolsBySize.others.push(pool);
    }
  });

  // Organiser les matchs des poules de taille ≠ 3
  const organizedOtherMatches = organizeStandardPools(poolsBySize.others);

  // Organiser les matchs des poules de taille 3 avec un traitement spécial
  const organizedSize3Matches = organizePoolsOfSize3(poolsBySize.size3);

  // Combiner les deux listes en alternant entre elles pour un meilleur équilibre
  return interleaveLists(organizedOtherMatches, organizedSize3Matches);
};

/**
 * Entrelace deux listes
 * @param {Array} list1 - Première liste
 * @param {Array} list2 - Deuxième liste
 * @returns {Array} - Liste entrelacée
 */
const interleaveLists = (list1, list2) => {
  const result = [];
  const maxLength = Math.max(list1.length, list2.length);

  for (let i = 0; i < maxLength; i++) {
    if (i < list1.length) {
      result.push(list1[i]);
    }
    if (i < list2.length) {
      result.push(list2[i]);
    }
  }

  return result;
};

/**
 * Organise les poules standard (taille ≠ 3)
 * @param {Array} pools - Poules à organiser
 * @returns {Array} - Matchs organisés
 */
const organizeStandardPools = (pools) => {
  if (pools.length === 0) return [];

  // Analyser les poules et organiser les matchs en rounds
  const poolRounds = [];

  pools.forEach((pool) => {
    // Trouver tous les combattants uniques
    const fighterIds = new Set();
    pool.matches.forEach((match) => {
      if (match.participants && match.participants.length >= 2) {
        fighterIds.add(match.participants[0].id);
        fighterIds.add(match.participants[1].id);
      }
    });

    // Diviser les matchs en rounds
    const rounds = [];
    const unassignedMatches = [...pool.matches];

    while (unassignedMatches.length > 0) {
      const currentRound = [];
      const usedFighters = new Set();

      // Trouver les matchs pour ce round
      for (let i = 0; i < unassignedMatches.length; i++) {
        const match = unassignedMatches[i];
        const fighter1Id = match.participants[0].id;
        const fighter2Id = match.participants[1].id;

        // Si aucun des deux combattants n'est déjà utilisé dans ce round
        if (!usedFighters.has(fighter1Id) && !usedFighters.has(fighter2Id)) {
          currentRound.push(match);
          usedFighters.add(fighter1Id);
          usedFighters.add(fighter2Id);

          // Retirer le match des non assignés
          unassignedMatches.splice(i, 1);
          i--; // Ajuster l'index
        }
      }

      // Ajouter ce round s'il contient des matchs
      if (currentRound.length > 0) {
        rounds.push(currentRound);
      } else {
        // Si on ne peut pas créer un round valide mais qu'il reste des matchs
        // prendre le premier et créer un round avec lui
        if (unassignedMatches.length > 0) {
          rounds.push([unassignedMatches.shift()]);
        }
      }
    }

    poolRounds.push({
      poolId: `${pool.groupId}-${pool.poolIndex}`,
      rounds,
    });
  });

  // Alterner les rounds entre les poules
  const interleavedMatches = [];
  let maxRounds = 0;

  // Trouver le nombre maximum de rounds
  poolRounds.forEach((pool) => {
    maxRounds = Math.max(maxRounds, pool.rounds.length);
  });

  // Pour chaque round
  for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
    // Pour chaque poule
    for (const pool of poolRounds) {
      // Si cette poule a ce round
      if (roundIndex < pool.rounds.length) {
        // Ajouter tous les matchs de ce round
        interleavedMatches.push(...pool.rounds[roundIndex]);
      }
    }
  }

  return interleavedMatches;
};

/**
 * Traitement spécial pour les poules de taille 3
 * @param {Array} poolsOfSize3 - Poules de taille 3
 * @returns {Array} - Matchs organisés
 */
const organizePoolsOfSize3 = (poolsOfSize3) => {
  if (poolsOfSize3.length === 0) return [];

  // Pour les poules de taille 3, nous avons besoin d'un traitement spécial
  // car il y a seulement 3 matchs par poule (A vs B, A vs C, B vs C)
  const organizedSize3Matches = [];

  // Préparer les matchs de chaque poule
  const poolMatches = [];

  poolsOfSize3.forEach((pool) => {
    // Identifier les 3 combattants
    const fighters = new Set();
    pool.matches.forEach((match) => {
      if (match.participants && match.participants.length >= 2) {
        fighters.add(match.participants[0].id);
        fighters.add(match.participants[1].id);
      }
    });

    const fighterIds = Array.from(fighters);

    // S'assurer qu'il y a bien 3 combattants
    if (fighterIds.length !== 3) {
      console.warn(
        `Poule de taille 3 inattendue: ${fighterIds.length} combattants trouvés`
      );
    }

    // Trouver les matchs correspondants
    const matches = [];
    const matchMap = {};

    pool.matches.forEach((match) => {
      if (match.participants && match.participants.length >= 2) {
        const fighter1Id = match.participants[0].id;
        const fighter2Id = match.participants[1].id;

        // Créer une clé unique pour ce match
        const key = [fighter1Id, fighter2Id].sort().join("-");
        matchMap[key] = match;
        matches.push(match);
      }
    });

    // Ajouter cette poule aux poules à traiter
    poolMatches.push({
      poolId: `${pool.groupId}-${pool.poolIndex}`,
      matches,
      fighterIds,
    });
  });

  // Si nous avons plusieurs poules de taille 3, les intercaler intelligemment
  if (poolMatches.length > 1) {
    // Organiser de façon à alterner entre les poules
    // Pour les poules de taille 3, l'ordre optimal est:
    // Poule 1: A vs B, Poule 2: A vs B, Poule 1: A vs C, Poule 2: A vs C, etc.

    for (let matchIndex = 0; matchIndex < 3; matchIndex++) {
      // 3 matchs par poule de taille 3
      for (const pool of poolMatches) {
        if (matchIndex < pool.matches.length) {
          organizedSize3Matches.push(pool.matches[matchIndex]);
        }
      }
    }
  } else if (poolMatches.length === 1) {
    // S'il n'y a qu'une seule poule de taille 3, l'ordre n'a pas d'importance
    organizedSize3Matches.push(...poolMatches[0].matches);
  }

  return organizedSize3Matches;
};

/**
 * Groupe les combats par groupe et par poule
 * @param {Array} matches - Liste des combats
 * @returns {Array} - Liste des poules avec leurs combats
 */
const groupMatchesByGroupAndPool = (matches) => {
  const groups = {};

  // Créer des groupes par groupId et poolIndex
  matches.forEach((match) => {
    const key = `${match.groupId}-${match.poolIndex}`;

    if (!groups[key]) {
      groups[key] = {
        groupId: match.groupId,
        poolIndex: match.poolIndex,
        matches: [],
      };
    }

    groups[key].matches.push(match);
  });

  // Convertir l'objet en tableau
  return Object.values(groups);
};

/**
 * Calcule le nombre total de combats dans une aire
 * @param {Array} pools - Poules attribuées à une aire
 * @returns {number} - Nombre total de combats
 */
const calculateTotalMatches = (pools) => {
  return pools.reduce((total, pool) => total + pool.matches.length, 0);
};

// Exporter la fonction nommée pour compatibilité rétroactive
export { createSchedule };

// Exporter comme export par défaut pour être compatible avec les imports existants
export default createSchedule;
