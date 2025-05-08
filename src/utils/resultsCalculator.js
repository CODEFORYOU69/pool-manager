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
  if (!participants || !groups || !matches || !matchResults) {
    throw new Error("Données manquantes pour le calcul des résultats");
  }

  const poolResults = [];

  // Pour chaque groupe
  groups.forEach((group) => {
    // Pour chaque poule dans le groupe
    group.pools.forEach((pool, poolIndex) => {
      // Récupérer tous les matchs de cette poule
      const poolMatches = matches.filter(
        (match) => match.groupId === group.id && match.poolIndex === poolIndex
      );

      // Récupérer les détails des participants de cette poule
      const poolParticipants = pool
        .map((participantId) => {
          return participants.find((p) => p.id === participantId);
        })
        .filter(Boolean); // Filtrer les éventuels participants non trouvés

      // Initialiser les statistiques pour chaque participant
      const participantStats = initializeParticipantStats(poolParticipants);

      // Traiter chaque match pour mettre à jour les statistiques
      poolMatches.forEach((match) => {
        const result = matchResults[match.id];

        // Si le match a été complété
        if (result && result.completed && result.winner) {
          // Identifier les participants
          const winnerIndex = result.winner === "A" ? 0 : 1;
          const loserIndex = result.winner === "A" ? 1 : 0;

          const winnerId = match.participants[winnerIndex].id;
          const loserId = match.participants[loserIndex].id;

          // Mettre à jour les points du vainqueur (3 points par victoire)
          if (participantStats[winnerId]) {
            participantStats[winnerId].points += 3;
            participantStats[winnerId].matches.push({
              opponentId: loserId,
              result: "win",
            });
          }

          // Le perdant ne reçoit pas de points mais on enregistre le match
          if (participantStats[loserId]) {
            participantStats[loserId].matches.push({
              opponentId: winnerId,
              result: "loss",
            });
          }

          // Mettre à jour les rounds gagnés et les points marqués
          result.rounds.forEach((round) => {
            if (round.winner === "A") {
              if (participantStats[match.participants[0].id]) {
                participantStats[match.participants[0].id].roundsWon += 1;
              }
            } else if (round.winner === "B") {
              if (participantStats[match.participants[1].id]) {
                participantStats[match.participants[1].id].roundsWon += 1;
              }
            }

            // Ajouter les points marqués
            if (participantStats[match.participants[0].id]) {
              participantStats[match.participants[0].id].scoreTotal +=
                round.fighterA;
            }
            if (participantStats[match.participants[1].id]) {
              participantStats[match.participants[1].id].scoreTotal +=
                round.fighterB;
            }
          });
        }

        // Enrichir l'objet match avec les résultats
        match.rounds = result?.rounds || match.rounds;
        match.winner = result?.winner;
        match.completed = result?.completed || false;
      });

      // Calculer le classement final
      const rankings = calculateRankings(
        participantStats,
        poolMatches,
        matchResults
      );

      // Ajouter les résultats de cette poule
      poolResults.push({
        groupId: group.id,
        poolIndex,
        participants: poolParticipants,
        matches: poolMatches,
        rankings,
      });
    });
  });

  return { poolResults };
};

/**
 * Initialise les statistiques pour chaque participant
 * @param {Array} participants - Liste des participants
 * @returns {Object} - Statistiques initialisées
 */
const initializeParticipantStats = (participants) => {
  const stats = {};

  participants.forEach((participant) => {
    stats[participant.id] = {
      ...participant,
      points: 0,
      roundsWon: 0,
      scoreTotal: 0,
      matches: [],
    };
  });

  return stats;
};

/**
 * Calcule le classement des participants dans une poule
 * @param {Object} participantStats - Statistiques des participants
 * @param {Array} matches - Liste des combats de la poule
 * @param {Object} matchResults - Résultats des combats
 * @returns {Array} - Liste des participants classés
 */
const calculateRankings = (participantStats, matches, matchResults) => {
  // Convertir l'objet en tableau pour le tri
  const participants = Object.values(participantStats);

  // Trier les participants selon les critères
  participants.sort((a, b) => {
    // 1. Nombre de points (3 points par victoire)
    if (a.points !== b.points) {
      return b.points - a.points;
    }

    // 2. Nombre de rounds gagnés
    if (a.roundsWon !== b.roundsWon) {
      return b.roundsWon - a.roundsWon;
    }

    // 3. Nombre total de points marqués
    if (a.scoreTotal !== b.scoreTotal) {
      return b.scoreTotal - a.scoreTotal;
    }

    // 4. Confrontation directe
    const directMatch = findDirectMatch(a.id, b.id, matches);
    if (directMatch) {
      const result = matchResults[directMatch.id];
      if (result && result.completed && result.winner) {
        const winnerIndex = result.winner === "A" ? 0 : 1;
        const winnerId = directMatch.participants[winnerIndex].id;

        if (winnerId === a.id) return -1;
        if (winnerId === b.id) return 1;
      }
    }

    // Par défaut, garder l'ordre original
    return 0;
  });

  // Attribuer le rang
  participants.forEach((participant, index) => {
    participant.rank = index + 1;
  });

  return participants;
};

/**
 * Trouve le match direct entre deux participants
 * @param {string} participantA - ID du premier participant
 * @param {string} participantB - ID du second participant
 * @param {Array} matches - Liste des matchs
 * @returns {Object|null} - Le match direct ou null si non trouvé
 */
const findDirectMatch = (participantA, participantB, matches) => {
  return (
    matches.find((match) => {
      const ids = match.participants.map((p) => p.id);
      return ids.includes(participantA) && ids.includes(participantB);
    }) || null
  );
};
