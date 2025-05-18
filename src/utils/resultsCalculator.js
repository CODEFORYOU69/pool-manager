/**
 * Calcule les résultats et classements pour tous les groupes et poules
 * @param {Array} participants - Liste des participants
 * @param {Array} groups - Liste des groupes
 * @param {Array} matches - Liste des combats
 * @param {Object} matchResults - Résultats des combats
 * @returns {Object} - Résultats calculés
 */
export const calculateResults = (
  participants,
  groups,
  matches,
  matchResults
) => {
  console.log("Début calculateResults avec:", {
    participants: participants?.length || 0,
    groups: groups?.length || 0,
    matches: matches?.length || 0,
    matchResults: Object.keys(matchResults || {}).length,
  });

  if (
    !participants ||
    !Array.isArray(participants) ||
    participants.length === 0
  ) {
    console.error("Participants invalides:", participants);
    throw new Error("Liste de participants invalide");
  }

  if (!groups || !Array.isArray(groups) || groups.length === 0) {
    console.error("Groupes invalides:", groups);
    throw new Error("Liste de groupes invalide");
  }

  if (!matches || !Array.isArray(matches)) {
    console.error("Matches invalides:", matches);
    throw new Error("Liste de matches invalide");
  }

  if (!matchResults || typeof matchResults !== "object") {
    console.error("Résultats de matches invalides:", matchResults);
    throw new Error("Résultats de matches invalides");
  }

  // Création d'une map pour accéder rapidement aux données des participants
  const participantsMap = {};
  try {
    participants.forEach((participant) => {
      if (participant && participant.id) {
        participantsMap[participant.id] = participant;
      }
    });
    console.log(
      `Map des participants créée avec ${
        Object.keys(participantsMap).length
      } entrées`
    );
  } catch (error) {
    console.error(
      "Erreur lors de la création de la map des participants:",
      error
    );
    throw new Error("Erreur lors de la création de la map des participants");
  }

  const poolResults = [];

  // Pour chaque groupe
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    console.log(`Traitement du groupe ${i + 1}/${groups.length}: ${group.id}`);

    if (!group) {
      console.warn(`Groupe ${i} est invalide, on l'ignore`);
      continue;
    }

    // Ajouter le nom du groupe pour l'affichage
    let groupName = "Groupe sans nom";
    try {
      groupName = `${group.gender === "male" ? "M" : "F"} ${
        group.ageCategoryName || ""
      } ${group.weightCategoryName || ""}`;
    } catch (error) {
      console.warn(
        `Erreur lors de la création du nom du groupe ${group.id}:`,
        error
      );
    }

    // Vérifier si le groupe a des poules
    if (!group.pools || !Array.isArray(group.pools)) {
      console.warn(`Le groupe ${group.id} n'a pas de poules valides`);
      continue;
    }

    console.log(`Le groupe ${group.id} a ${group.pools.length} poules`);

    // Pour chaque poule dans le groupe
    for (let j = 0; j < group.pools.length; j++) {
      const pool = group.pools[j];
      const poolIndex = j;

      console.log(
        `Traitement de la poule ${j + 1}/${group.pools.length} du groupe ${
          group.id
        }`
      );

      // S'assurer que pool est bien un objet
      if (!pool) {
        console.warn(
          `Pool invalide trouvée à l'index ${poolIndex} du groupe ${group.id}`
        );
        continue; // Ignorer cette poule et passer à la suivante
      }

      // Récupérer les matchs de cette poule
      const poolMatches = matches.filter(
        (match) =>
          match && match.groupId === group.id && match.poolIndex === poolIndex
      );

      console.log(
        `${poolMatches.length} matchs trouvés pour la poule ${poolIndex} du groupe ${group.id}`
      );

      if (poolMatches.length === 0) {
        console.warn(
          `Aucun match trouvé pour la poule ${poolIndex} du groupe ${group.id}`
        );
        continue; // Ignorer cette poule sans matchs
      }

      try {
        // Compiler les statistiques par participant
        const participantStats = compileParticipantStats(
          pool,
          poolMatches,
          matchResults,
          participantsMap
        );

        // Vérifier que nous avons des statistiques
        if (!participantStats || Object.keys(participantStats).length === 0) {
          console.warn(
            `Aucune statistique calculée pour la poule ${poolIndex} du groupe ${group.id}`
          );
          continue; // Ignorer cette poule sans statistiques
        }

        // Calculer le classement
        const rankings = calculateRankings(
          participantStats,
          poolMatches,
          matchResults
        );

        if (!rankings || !Array.isArray(rankings) || rankings.length === 0) {
          console.warn(
            `Aucun classement calculé pour la poule ${poolIndex} du groupe ${group.id}`
          );
          continue;
        }

        console.log(
          `${rankings.length} participants classés pour la poule ${poolIndex} du groupe ${group.id}`
        );

        // Ajouter les résultats de cette poule
        poolResults.push({
          groupId: group.id,
          groupName: groupName,
          poolIndex: poolIndex,
          poolId: pool.id,
          participants: rankings,
          matches: poolMatches.map((match) => ({
            ...match,
            result: matchResults[match.id],
          })),
        });
      } catch (error) {
        console.error(
          `Erreur lors du calcul pour la poule ${poolIndex} du groupe ${group.id}:`,
          error
        );
      }
    }
  }

  console.log(
    `Calcul des résultats terminé, ${poolResults.length} poules traitées`
  );
  return poolResults;
};

/**
 * Compile les statistiques pour chaque participant d'une poule
 * @param {Array} pool - Liste des participants dans la poule
 * @param {Array} matches - Liste des combats de la poule
 * @param {Object} matchResults - Résultats des combats
 * @param {Object} participantsMap - Map des participants pour accès rapide
 * @returns {Object} - Statistiques par participant
 */
const compileParticipantStats = (
  pool,
  matches,
  matchResults,
  participantsMap
) => {
  console.log(
    "Début compileParticipantStats avec:",
    "pool=",
    typeof pool,
    Array.isArray(pool),
    "matches=",
    matches?.length || 0
  );

  const stats = {};

  // Vérification plus stricte de la structure de pool
  if (!pool) {
    console.error("La poule est null ou undefined");
    return stats;
  }

  // Afficher plus d'informations sur l'objet pool pour diagnostiquer le problème
  console.log(
    "Structure de pool:",
    JSON.stringify(pool, null, 2).substring(0, 500)
  ); // Limiter pour éviter des logs trop grands

  // Vérifier que pool est un objet valide
  if (typeof pool !== "object") {
    console.error("La poule n'est pas un objet:", pool);
    return stats;
  }

  // Trouver comment extraire les participants en fonction de la structure de pool
  let participants = [];

  try {
    // Cas 1: La poule est elle-même un tableau d'IDs de participants
    if (Array.isArray(pool)) {
      console.log("Pool est un tableau de longueur", pool.length);
      participants = pool.filter((id) => id && typeof id === "string");
    }
    // Cas 2: La poule contient une propriété poolParticipants
    else if (pool.poolParticipants && Array.isArray(pool.poolParticipants)) {
      console.log(
        "Pool contient poolParticipants de longueur",
        pool.poolParticipants.length
      );
      participants = pool.poolParticipants
        .filter((pp) => pp && (pp.participant || pp.participantId))
        .map((pp) => (pp.participant ? pp.participant.id : pp.participantId));
    }
    // Cas 3: La poule est un objet avec une propriété participants
    else if (pool.participants && Array.isArray(pool.participants)) {
      console.log(
        "Pool contient participants de longueur",
        pool.participants.length
      );
      participants = pool.participants
        .filter((p) => p != null)
        .map((p) => (typeof p === "string" ? p : p.id || p.participantId))
        .filter((id) => id);
    }
    // Cas 4: La poule est sous un autre format
    else {
      // Essayer d'extraire une liste de participants de toute autre manière
      console.warn(
        "Structure de pool non standard, tentative de récupération alternative..."
      );

      // Si pool a un ID, chercher les matchs pour ce poolId et extraire les participants
      if (pool.id && matches && matches.length > 0) {
        const participantIds = new Set();
        matches.forEach((match) => {
          if (match.matchParticipants) {
            match.matchParticipants.forEach((mp) => {
              if (mp.participant && mp.participant.id) {
                participantIds.add(mp.participant.id);
              }
            });
          }
        });
        participants = Array.from(participantIds);
        console.log("Participants extraits des matchs:", participants.length);
      }
    }
  } catch (error) {
    console.error("Erreur lors de l'extraction des participants:", error);
    participants = []; // S'assurer que participants est un tableau même en cas d'erreur
  }

  console.log(
    "Participants extraits:",
    participants?.length || 0,
    participants
  );

  // Protection supplémentaire - s'assurer que participants est un tableau
  if (!Array.isArray(participants)) {
    console.error(
      "La variable participants n'est pas un tableau valide, on la remplace par un tableau vide"
    );
    participants = []; // Créer un tableau vide pour éviter l'erreur e.forEach
  }

  // S'assurer que le tableau n'est pas vide
  if (participants.length === 0) {
    console.warn("Aucun participant trouvé dans la poule");
    return stats;
  }

  // Initialiser les statistiques pour chaque participant valide
  try {
    participants.forEach((participantId) => {
      if (!participantId) {
        console.warn("ID de participant invalide trouvé:", participantId);
        return; // Continuer avec le prochain participant
      }

      if (!participantsMap[participantId]) {
        console.warn("Participant non trouvé dans la map:", participantId);
        return; // Continuer avec le prochain participant
      }

      const participant = participantsMap[participantId];
      stats[participantId] = {
        id: participantId,
        nom: participant.nom || "",
        prenom: participant.prenom || "",
        ligue: participant.ligue || "",
        club: participant.club || "",
        points: 0, // 3 points par victoire
        matchesWon: 0,
        matchesLost: 0,
        matchesTied: 0,
        roundsWon: 0,
        roundsLost: 0,
        scoreTotal: 0,
        pointsGained: 0, // Ajout pour le tableau de résultats
        pointsLost: 0, // Ajout pour le tableau de résultats
        pointsDiff: 0, // Ajout pour le tableau de résultats
        wins: 0, // Pour compatibilité avec le composant Results
        matches: 0, // Pour compatibilité avec le composant Results
        rank: 0, // Sera défini plus tard
      };
    });
  } catch (error) {
    console.error("Erreur lors de l'initialisation des statistiques:", error);
    // Continuer avec les statistiques que nous avons pu générer
  }

  // Compiler les résultats des matchs
  matches.forEach((match) => {
    const result = matchResults[match.id];
    if (!result || !result.completed) return; // Ignorer les matchs non terminés

    // Trouver les participants du match
    const participantA = findParticipantInMatch(match, "A");
    const participantB = findParticipantInMatch(match, "B");

    if (!participantA || !participantB) return; // Participants invalides

    const participantAId = participantA.id;
    const participantBId = participantB.id;

    // S'assurer que les deux participants sont dans les statistiques
    if (!stats[participantAId] || !stats[participantBId]) return;

    // Déterminer le vainqueur du match
    let winnerA = false;
    let winnerB = false;
    let tie = false;

    if (match.winner === participantAId) {
      winnerA = true;
    } else if (match.winner === participantBId) {
      winnerB = true;
    } else {
      tie = true;
    }

    // Mettre à jour les statistiques de victoires/défaites
    if (winnerA) {
      stats[participantAId].matchesWon++;
      stats[participantBId].matchesLost++;
      stats[participantAId].points += 3; // 3 points par victoire
    } else if (winnerB) {
      stats[participantBId].matchesWon++;
      stats[participantAId].matchesLost++;
      stats[participantBId].points += 3; // 3 points par victoire
    } else if (tie) {
      stats[participantAId].matchesTied++;
      stats[participantBId].matchesTied++;
      stats[participantAId].points += 1; // 1 point par match nul
      stats[participantBId].points += 1; // 1 point par match nul
    }

    // Compiler les statistiques des rounds
    if (match.rounds) {
      match.rounds.forEach((round) => {
        const scoreA = round.scoreA || 0;
        const scoreB = round.scoreB || 0;
        let roundWinnerA = false;
        let roundWinnerB = false;

        if (
          round.winner === participantAId ||
          round.winnerPosition === "A" ||
          (scoreA > scoreB && (round.winner === null || round.winner === ""))
        ) {
          roundWinnerA = true;
        } else if (
          round.winner === participantBId ||
          round.winnerPosition === "B" ||
          (scoreB > scoreA && (round.winner === null || round.winner === ""))
        ) {
          roundWinnerB = true;
        }

        // Mettre à jour les statistiques des rounds
        if (roundWinnerA) {
          stats[participantAId].roundsWon++;
          stats[participantBId].roundsLost++;
        } else if (roundWinnerB) {
          stats[participantBId].roundsWon++;
          stats[participantAId].roundsLost++;
        }

        // Ajouter les scores et les points concédés
        stats[participantAId].scoreTotal += scoreA;
        stats[participantBId].scoreTotal += scoreB;

        // Points concédés (ce que l'adversaire a marqué contre vous)
        stats[participantAId].pointsLost += scoreB;
        stats[participantBId].pointsLost += scoreA;
      });
    }
  });

  // Calculer le différentiel de points pour chaque participant
  Object.keys(stats).forEach((participantId) => {
    const participant = stats[participantId];

    // Mettre à jour les statistiques pour l'affichage
    participant.pointsGained = participant.scoreTotal;
    participant.pointsDiff = participant.pointsGained - participant.pointsLost;
    participant.wins = participant.matchesWon; // Pour compatibilité
    participant.matches =
      participant.matchesWon +
      participant.matchesLost +
      participant.matchesTied;
  });

  return stats;
};

/**
 * Trouver un participant dans un match par sa position
 * @param {Object} match - Le match à examiner
 * @param {string} position - La position (A ou B)
 * @returns {Object|null} - Le participant trouvé ou null
 */
const findParticipantInMatch = (match, position) => {
  if (!match) {
    console.warn("Match invalide pour trouver un participant");
    return null;
  }

  if (!position || (position !== "A" && position !== "B")) {
    console.warn(`Position invalide: ${position}`);
    return null;
  }

  try {
    // Vérifier d'abord dans matchParticipants (structure de BD)
    if (match.matchParticipants && Array.isArray(match.matchParticipants)) {
      const matchParticipant = match.matchParticipants.find(
        (mp) => mp && mp.position === position
      );
      if (matchParticipant && matchParticipant.participant) {
        return matchParticipant.participant;
      }
    }

    // Ensuite vérifier dans la structure participants (générée localement)
    if (
      match.participants &&
      Array.isArray(match.participants) &&
      match.participants.length > 0
    ) {
      const index = position === "A" ? 0 : position === "B" ? 1 : -1;
      if (index >= 0 && index < match.participants.length) {
        return match.participants[index];
      }
    }

    // Vérifier si le match a des propriétés participantA/B
    if (position === "A" && match.participantA) {
      return match.participantA;
    } else if (position === "B" && match.participantB) {
      return match.participantB;
    }

    // Vérifier si le match a des propriétés fighter1/fighter2
    if (position === "A" && match.fighter1) {
      return match.fighter1;
    } else if (position === "B" && match.fighter2) {
      return match.fighter2;
    }

    console.warn(
      `Aucun participant trouvé à la position ${position} pour le match ${
        match.id || "inconnu"
      }`
    );
    return null;
  } catch (error) {
    console.error(
      "Erreur lors de la recherche d'un participant dans un match:",
      error
    );
    return null;
  }
};

/**
 * Trouver le match direct entre deux participants
 * @param {string} participant1Id - ID du premier participant
 * @param {string} participant2Id - ID du deuxième participant
 * @param {Array} matches - Liste des matchs
 * @returns {Object|null} - Le match trouvé ou null
 */
const findDirectMatch = (participant1Id, participant2Id, matches) => {
  if (!participant1Id || !participant2Id) {
    console.warn("IDs de participants invalides pour trouver un match direct");
    return null;
  }

  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    console.warn("Liste de matchs invalide pour trouver un match direct");
    return null;
  }

  try {
    return matches.find((match) => {
      if (!match) return false;

      // Vérifier dans matchParticipants (structure de BD)
      if (
        match.matchParticipants &&
        Array.isArray(match.matchParticipants) &&
        match.matchParticipants.length >= 2
      ) {
        const participantIds = match.matchParticipants
          .filter((mp) => mp && mp.participant)
          .map((mp) => mp.participant.id);

        return (
          participantIds.includes(participant1Id) &&
          participantIds.includes(participant2Id)
        );
      }

      // Vérifier dans participants (structure locale)
      if (
        match.participants &&
        Array.isArray(match.participants) &&
        match.participants.length >= 2
      ) {
        const participantIds = match.participants
          .filter((p) => p && (p.id || p.participantId))
          .map((p) => p.id || p.participantId);

        return (
          participantIds.includes(participant1Id) &&
          participantIds.includes(participant2Id)
        );
      }

      // Vérifier les propriétés spécifiques du match
      if (
        match.participantAId === participant1Id &&
        match.participantBId === participant2Id
      ) {
        return true;
      }

      if (
        match.participantAId === participant2Id &&
        match.participantBId === participant1Id
      ) {
        return true;
      }

      return false;
    });
  } catch (error) {
    console.error("Erreur lors de la recherche d'un match direct:", error);
    return null;
  }
};

/**
 * Calcule le classement des participants dans une poule
 * @param {Object} participantStats - Statistiques des participants
 * @param {Array} matches - Liste des combats de la poule
 * @param {Object} matchResults - Résultats des combats
 * @returns {Array} - Liste des participants classés
 */
const calculateRankings = (participantStats, matches, matchResults) => {
  console.log("Calcul des classements avec:", {
    stats: Object.keys(participantStats || {}).length,
    matches: matches?.length || 0,
    results: Object.keys(matchResults || {}).length,
  });

  if (!participantStats || typeof participantStats !== "object") {
    console.error("Stats de participants invalides:", participantStats);
    return [];
  }

  // Convertir l'objet en tableau pour le tri
  const participants = Object.values(participantStats);

  if (
    !participants ||
    !Array.isArray(participants) ||
    participants.length === 0
  ) {
    console.error("Pas de participants valides à classer");
    return [];
  }

  console.log(`${participants.length} participants à classer`);

  // Créer une fonction pour vérifier la confrontation directe entre deux participants
  const getDirectMatchWinner = (participantA, participantB) => {
    try {
      if (
        !participantA ||
        !participantB ||
        !participantA.id ||
        !participantB.id
      ) {
        return null;
      }

      const directMatch = findDirectMatch(
        participantA.id,
        participantB.id,
        matches
      );

      if (!directMatch) {
        return null;
      }

      if (
        directMatch &&
        (directMatch.status === "completed" || directMatch.completed) &&
        directMatch.winner
      ) {
        // Le winner contient maintenant l'ID du participant vainqueur
        return directMatch.winner === participantA.id
          ? participantA.id
          : directMatch.winner === participantB.id
          ? participantB.id
          : null;
      }
      return null;
    } catch (error) {
      console.error(
        "Erreur lors de la détermination du vainqueur direct:",
        error
      );
      return null;
    }
  };

  // Préparer les données et normaliser les propriétés pour le tableau de résultats
  participants.forEach((participant) => {
    try {
      if (participant) {
        // Les propriétés suivantes sont déjà normalisées dans compileParticipantStats
        // Elles sont donc déjà préparées pour l'affichage
        // - participant.wins (= participant.matchesWon)
        // - participant.matches (= matchesWon + matchesLost + matchesTied)
        // - participant.pointsGained (= participant.scoreTotal)
        // - participant.pointsLost (points marqués par l'adversaire)
        // - participant.pointsDiff (= pointsGained - pointsLost)
        // Rien à faire ici, tout est déjà correctement initialisé
      }
    } catch (error) {
      console.error(
        "Erreur lors de la normalisation des données du participant:",
        error
      );
    }
  });

  // Trier les participants par points, puis par différentiel de rounds, puis par différentiel de points
  participants.sort((a, b) => {
    // 1. Nombre de points (3 pour victoire, 1 pour match nul)
    if (a.points !== b.points) return b.points - a.points;

    // 2. Confrontation directe en cas d'égalité
    const directWinner = getDirectMatchWinner(a, b);
    if (directWinner === a.id) return -1;
    if (directWinner === b.id) return 1;

    // 3. Nombre de rounds gagnés
    if (a.roundsWon !== b.roundsWon) return b.roundsWon - a.roundsWon;

    // 4. Différentiel de points (points marqués - points encaissés)
    if (a.pointsDiff !== b.pointsDiff) return b.pointsDiff - a.pointsDiff;

    // 5. Si tout est égal, pas de changement d'ordre
    return 0;
  });

  // Attribuer les rangs après le tri
  participants.forEach((p, i) => {
    p.rank = i + 1;
  });

  console.log("Classement terminé");
  return participants;
};
