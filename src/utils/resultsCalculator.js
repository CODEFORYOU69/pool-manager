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

  // Création d'une map pour accéder rapidement aux données des participants
  const participantsMap = {};
  participants.forEach((participant) => {
    participantsMap[participant.id] = participant;
  });

  const poolResults = [];

  // Pour chaque groupe
  groups.forEach((group) => {
    // Pour chaque poule dans le groupe
    if (group.pools) {
      group.pools.forEach((pool, poolIndex) => {
        // Récupérer les matchs de cette poule
        const poolMatches = matches.filter(
          (match) => match.groupId === group.id && match.poolIndex === poolIndex
        );

        // Compiler les statistiques par participant
        const participantStats = compileParticipantStats(
          pool,
          poolMatches,
          matchResults,
          participantsMap
        );

        // Calculer le classement
        const rankings = calculateRankings(
          participantStats,
          poolMatches,
          matchResults
        );

        // Ajouter les résultats de cette poule
        poolResults.push({
          groupId: group.id,
          poolIndex: poolIndex,
          rankings: rankings,
          matches: poolMatches.map((match) => ({
            ...match,
            result: matchResults[match.id],
          })),
        });
      });
    }
  });

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
  const stats = {};

  // Initialiser les statistiques pour chaque participant
  pool.forEach((participantId) => {
    if (participantId && participantsMap[participantId]) {
      const participant = participantsMap[participantId];
      stats[participantId] = {
        id: participantId,
        nom: participant.nom,
        prenom: participant.prenom,
        points: 0, // 3 points par victoire
        matchesWon: 0,
        matchesLost: 0,
        matchesTied: 0,
        roundsWon: 0,
        roundsLost: 0,
        scoreTotal: 0,
        rank: 0, // Sera défini plus tard
      };
    }
  });

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

        // Ajouter les scores
        stats[participantAId].scoreTotal += scoreA;
        stats[participantBId].scoreTotal += scoreB;
      });
    }
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
  // Vérifier d'abord dans matchParticipants (structure de BD)
  if (match.matchParticipants) {
    const matchParticipant = match.matchParticipants.find(
      (mp) => mp.position === position
    );
    if (matchParticipant && matchParticipant.participant) {
      return matchParticipant.participant;
    }
  }

  // Ensuite vérifier dans la structure participants (générée localement)
  if (match.participants && match.participants.length > 0) {
    const index = position === "A" ? 0 : position === "B" ? 1 : -1;
    if (index >= 0 && index < match.participants.length) {
      return match.participants[index];
    }
  }

  return null;
};

/**
 * Trouver le match direct entre deux participants
 * @param {string} participant1Id - ID du premier participant
 * @param {string} participant2Id - ID du deuxième participant
 * @param {Array} matches - Liste des matchs
 * @returns {Object|null} - Le match trouvé ou null
 */
const findDirectMatch = (participant1Id, participant2Id, matches) => {
  return matches.find((match) => {
    // Vérifier dans matchParticipants (structure de BD)
    if (match.matchParticipants && match.matchParticipants.length >= 2) {
      const participantIds = match.matchParticipants.map(
        (mp) => mp.participant.id
      );
      return (
        participantIds.includes(participant1Id) &&
        participantIds.includes(participant2Id)
      );
    }

    // Vérifier dans participants (structure locale)
    if (match.participants && match.participants.length >= 2) {
      const participantIds = match.participants.map((p) => p.id);
      return (
        participantIds.includes(participant1Id) &&
        participantIds.includes(participant2Id)
      );
    }

    return false;
  });
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
