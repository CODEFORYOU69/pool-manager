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

  console.log("Début du calcul des résultats avec:", {
    participantsCount: participants.length,
    groupsCount: groups.length,
    matchesCount: matches.length,
    matchResultsCount: Object.keys(matchResults).length,
  });

  // Logs détaillés pour diagnostiquer les problèmes
  const completedMatches = matches.filter(
    (m) => m.status === "completed" || matchResults[m.id]?.completed
  );
  console.log(`Matchs complétés trouvés: ${completedMatches.length}`);

  if (completedMatches.length > 0) {
    console.log("Exemple de match complété:", completedMatches[0]);
  }

  // Création d'une map pour accéder rapidement aux données des participants
  const participantsMap = {};
  participants.forEach((participant) => {
    participantsMap[participant.id] = participant;
  });

  const poolResults = [];

  groups.forEach((group) => {
    // Pour chaque groupe (catégorie de poids et âge)
    if (!group.pools || !Array.isArray(group.pools)) {
      console.log(`Groupe sans poules valides: ${group.id}`);
      return;
    }

    console.log(
      `Traitement du groupe: ${group.id} - ${group.pools.length} poules`
    );

    group.pools.forEach((pool) => {
      // Pour chaque poule à l'intérieur du groupe
      if (!pool.poolParticipants || !Array.isArray(pool.poolParticipants)) {
        console.log(`Poule sans participants valides: ${pool.id}`);
        return;
      }

      console.log(
        `Traitement de la poule: ${pool.id} - ${pool.poolParticipants.length} participants`
      );

      const poolParticipantsResults = [];

      // Pour chaque participant de la poule
      pool.poolParticipants.forEach((poolParticipant) => {
        const participantId = poolParticipant.participantId;
        const participant = participantsMap[participantId];

        if (!participant) {
          console.log(`Participant introuvable: ${participantId}`);
          return;
        }

        // Initialiser les statistiques du participant
        const participantResult = {
          participantId: participantId,
          nom: participant.nom,
          prenom: participant.prenom,
          ligue: participant.ligue,
          matches: 0,
          wins: 0,
          points: 0,
          roundsWon: 0,
          roundsLost: 0,
          pointsGained: 0,
          pointsLost: 0,
        };

        // Trouver tous les matchs de ce participant dans cette poule
        const participantMatches = matches.filter((match) => {
          // Vérifier que le match est dans la bonne poule
          if (match.poolId !== pool.id) return false;

          // Vérifier que le participant est dans ce match
          const isInMatch = match.matchParticipants?.some(
            (mp) => mp.participantId === participantId
          );

          return isInMatch;
        });

        console.log(
          `Participant ${participant.prenom} ${participant.nom} - ${participantMatches.length} matchs trouvés`
        );

        // Pour chaque match du participant
        participantMatches.forEach((match) => {
          const isCompleted =
            match.status === "completed" || matchResults[match.id]?.completed;

          if (!isCompleted) {
            return; // Ignorer les matchs non terminés
          }

          console.log(
            `Match complété pour ${participant.prenom} ${participant.nom} - ID: ${match.id}`
          );

          participantResult.matches++;

          // Déterminer si le participant est le vainqueur
          const isWinner =
            match.winner === participantId ||
            matchResults[match.id]?.winner === participantId;

          if (isWinner) {
            participantResult.wins++;
            participantResult.points += 3; // 3 points par victoire
          }

          // Traiter les rounds
          const matchRounds = match.rounds || [];
          if (matchRounds.length > 0) {
            console.log(`Match ${match.id} a ${matchRounds.length} rounds`);
          }

          matchRounds.forEach((round) => {
            // Trouver la position du participant (A ou B)
            const participantPosition = match.matchParticipants.find(
              (mp) => mp.participantId === participantId
            )?.position;

            if (!participantPosition) {
              console.log(
                `Position introuvable pour le participant ${participantId} dans le match ${match.id}`
              );
              return;
            }

            // Déterminer si le participant a gagné ce round
            let isRoundWinner = false;

            // Vérifier les différentes façons de déterminer le gagnant d'un round
            if (round.winner === participantId) {
              // 1. Si winner contient directement l'ID du participant
              isRoundWinner = true;
            } else if (round.winnerPosition === participantPosition) {
              // 2. Si winnerPosition correspond à la position du participant (A ou B)
              isRoundWinner = true;
            } else if (round.winner === participantPosition) {
              // 3. Ancien format: si winner contient la position (A ou B)
              isRoundWinner = true;
            }

            if (isRoundWinner) {
              participantResult.roundsWon++;
            } else {
              participantResult.roundsLost++;
            }

            // Ajouter les points marqués/perdus
            if (participantPosition === "A") {
              participantResult.pointsGained += round.scoreA || 0;
              participantResult.pointsLost += round.scoreB || 0;
            } else {
              participantResult.pointsGained += round.scoreB || 0;
              participantResult.pointsLost += round.scoreA || 0;
            }
          });
        });

        // Calculer la différence de points
        participantResult.pointsDiff =
          participantResult.pointsGained - participantResult.pointsLost;

        poolParticipantsResults.push(participantResult);
      });

      // Trier les résultats par points, puis par différence de points, puis par points marqués
      poolParticipantsResults.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.pointsDiff !== b.pointsDiff) return b.pointsDiff - a.pointsDiff;
        return b.pointsGained - a.pointsGained;
      });

      // Ajouter les résultats de cette poule aux résultats globaux
      if (poolParticipantsResults.length > 0) {
        poolResults.push({
          groupId: group.id,
          poolId: pool.id,
          groupName: `${group.ageCategoryName} ${group.gender} ${group.weightCategoryName}`,
          poolIndex: pool.poolIndex,
          participants: poolParticipantsResults,
        });
      }
    });
  });

  console.log(`Résultats calculés pour ${poolResults.length} poules`);
  return poolResults;
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

  // Créer une fonction pour vérifier la confrontation directe entre deux participants
  const getDirectMatchWinner = (participantA, participantB) => {
    const directMatch = findDirectMatch(
      participantA.id,
      participantB.id,
      matches
    );
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
  };

  // Trier les participants selon les critères
  participants.sort((a, b) => {
    // 1. Nombre de points (3 points par victoire)
    if (a.points !== b.points) {
      return b.points - a.points;
    }

    // 2. Confrontation directe (le gagnant du match direct est placé devant)
    const directMatchWinnerId = getDirectMatchWinner(a, b);
    if (directMatchWinnerId === a.id) return -1;
    if (directMatchWinnerId === b.id) return 1;

    // 3. Nombre de rounds gagnés
    if (a.roundsWon !== b.roundsWon) {
      return b.roundsWon - a.roundsWon;
    }

    // 4. Nombre total de points marqués
    if (a.scoreTotal !== b.scoreTotal) {
      return b.scoreTotal - a.scoreTotal;
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
      if (!match.participants || match.participants.length < 2) return false;
      const ids = match.participants.map((p) => p.id);
      return ids.includes(participantA) && ids.includes(participantB);
    }) || null
  );
};
