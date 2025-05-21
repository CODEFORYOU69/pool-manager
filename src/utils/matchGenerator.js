import { v4 as uuidv4 } from "uuid";

/**
 * Génère tous les combats pour les groupes et poules
 * @param {Array} groups - Liste des groupes
 * @returns {Array} - Liste des combats générés
 */
export const generateMatches = (groups) => {
  try {
    if (!groups || !Array.isArray(groups)) {
      console.error("Liste de groupes invalide:", groups);
      throw new Error("Liste de groupes invalide");
    }

    if (groups.length === 0) {
      console.error("Aucun groupe fourni pour générer des matchs");
      return [];
    }

    console.log(`Génération des matchs pour ${groups.length} groupes`);

    const allMatches = [];
    const errors = [];

    // Créer un registre pour suivre les combinaisons de participants déjà traitées
    const processedCombinations = new Set();
    // Créer un registre pour suivre les matchs uniques par paire de participants
    const uniqueMatchesByParticipants = new Map();

    // Pour chaque groupe
    groups.forEach((group, groupIndex) => {
      try {
        if (!group || typeof group !== "object") {
          console.error(`Groupe invalide à l'index ${groupIndex}:`, group);
          return;
        }

        if (!group.id) {
          console.error(`Groupe sans ID à l'index ${groupIndex}:`, group);
          return;
        }

        if (!Array.isArray(group.pools)) {
          console.error(
            `Poules invalides pour le groupe ${group.id}:`,
            group.pools
          );
          return;
        }

        if (!Array.isArray(group.participants)) {
          console.error(
            `Participants invalides pour le groupe ${group.id}:`,
            group.participants
          );
          return;
        }

        console.log(
          `Traitement du groupe ${groupIndex + 1}/${groups.length}: ${group.id}`
        );
        console.log(`  - ${group.pools.length} poules dans ce groupe`);
        console.log(
          `  - ${group.participants.length} participants dans ce groupe`
        );

        // Pour chaque poule dans le groupe
        group.pools.forEach((pool, poolIndex) => {
          try {
            if (!pool || !Array.isArray(pool)) {
              console.error(
                `Poule invalide à l'index ${poolIndex} du groupe ${group.id}:`,
                pool
              );
              return;
            }

            console.log(
              `  - Traitement de la poule ${poolIndex + 1}/${
                group.pools.length
              } avec ${pool.length} participants`
            );

            // Créer un identifiant unique pour cette poule basé sur ses participants
            // Ceci nous permettra d'éviter de créer les mêmes matchs plusieurs fois
            const poolParticipantIds = [...pool].sort().join("|");
            const poolIdentifier = `${group.id}|${poolIndex}|${poolParticipantIds}`;

            // Si cette combinaison de participants a déjà été traitée, ne pas générer à nouveau
            if (processedCombinations.has(poolIdentifier)) {
              console.log(`    - Poule déjà traitée, éviter la duplication`);
              return;
            }

            // Marquer cette combinaison comme traitée
            processedCombinations.add(poolIdentifier);

            // Générer les combats pour cette poule
            const poolMatches = generatePoolMatches(
              pool,
              group.id,
              poolIndex,
              group.participants
            );

            console.log(
              `    - ${poolMatches.length} matchs générés pour cette poule`
            );

            // Vérifier que chaque match est unique (même au sein de différentes poules)
            const uniquePoolMatches = [];

            poolMatches.forEach((match) => {
              if (!match.participants || match.participants.length !== 2) {
                return; // Ignorer les matchs invalides
              }

              // Créer une clé unique pour ce match
              const participant1Id = match.participants[0].id;
              const participant2Id = match.participants[1].id;
              const matchKey = [participant1Id, participant2Id]
                .sort()
                .join("|");

              // Vérifier si ce match existe déjà
              if (uniqueMatchesByParticipants.has(matchKey)) {
                console.log(
                  `    - Match ${participant1Id} vs ${participant2Id} déjà généré, éviter le doublon`
                );
                return;
              }

              // Ajouter ce match à la liste des matchs uniques
              uniqueMatchesByParticipants.set(matchKey, match);
              uniquePoolMatches.push(match);
            });

            console.log(
              `    - ${uniquePoolMatches.length} matchs uniques retenus après vérification`
            );

            // Ajouter les combats uniques à la liste globale
            allMatches.push(...uniquePoolMatches);
          } catch (poolError) {
            console.error(
              `Erreur lors de la génération des matchs pour la poule ${poolIndex} du groupe ${group.id}:`,
              poolError
            );
            errors.push({
              groupId: group.id,
              poolIndex,
              error: poolError.message,
            });
          }
        });
      } catch (groupError) {
        console.error(
          `Erreur lors de la génération des matchs pour le groupe ${groupIndex}:`,
          groupError
        );
        errors.push({
          groupIndex,
          error: groupError.message,
        });
      }
    });

    if (errors.length > 0) {
      console.error(
        `${errors.length} erreurs lors de la génération des matchs`,
        errors
      );
    }

    console.log(
      `Génération terminée: ${allMatches.length} matchs uniques générés`
    );
    return allMatches;
  } catch (error) {
    console.error("Erreur lors de la génération des matchs:", error);
    throw error;
  }
};

/**
 * Génère les combats pour une poule spécifique
 * @param {Array} pool - Liste des IDs des participants dans la poule
 * @param {string} groupId - ID du groupe
 * @param {number} poolIndex - Index de la poule dans le groupe
 * @param {Array} groupParticipants - Liste complète des participants du groupe
 * @returns {Array} - Liste des combats générés pour la poule
 */
const generatePoolMatches = (pool, groupId, poolIndex, groupParticipants) => {
  const matches = [];

  // Vérifier si la poule a suffisamment de participants
  if (!Array.isArray(pool) || pool.length < 2) {
    console.error(
      `Poule avec insuffisamment de participants: ${pool?.length || 0}`
    );
    return matches;
  }

  // Filtrer les IDs de participant invalides
  const validPoolIds = pool.filter(
    (id) => typeof id === "string" && id.length > 0
  );

  if (validPoolIds.length < 2) {
    console.error(
      `Poule avec insuffisamment de participants valides: ${validPoolIds.length}`
    );
    return matches;
  }

  // Vérifier que tous les participants existent effectivement
  const verifiedParticipants = [];
  for (const participantId of validPoolIds) {
    const participant = groupParticipants.find(
      (p) => p && p.id === participantId
    );
    if (participant) {
      verifiedParticipants.push(participantId);
    } else {
      console.error(
        `Participant ${participantId} référencé dans la poule mais non trouvé dans les participants du groupe`
      );
    }
  }

  if (verifiedParticipants.length < 2) {
    console.error(
      `Poule avec insuffisamment de participants vérifiés: ${verifiedParticipants.length}`
    );
    return matches;
  }

  // Générer les matchups selon la taille de la poule
  const matchups = generateMatchups(verifiedParticipants.length);

  // Créer les objets match pour chaque matchup
  matchups.forEach((matchup) => {
    const participantAId = verifiedParticipants[matchup[0]];
    const participantBId = verifiedParticipants[matchup[1]];

    // Rechercher les informations des participants
    const participantA = groupParticipants.find(
      (p) => p && p.id === participantAId
    );
    const participantB = groupParticipants.find(
      (p) => p && p.id === participantBId
    );

    if (!participantA || !participantB) {
      console.error(
        `Participant(s) non trouvé(s) pour le match: ${participantAId} vs ${participantBId}`
      );
      return;
    }

    // Créer l'objet match
    const match = {
      id: uuidv4(),
      groupId,
      poolIndex,
      participants: [
        { ...participantA, position: "A" },
        { ...participantB, position: "B" },
      ],
      status: "pending",
      rounds: Array(3)
        .fill()
        .map(() => ({ fighterA: 0, fighterB: 0, winner: null })),
      winner: null,
    };

    matches.push(match);
  });

  if (matches.length === 0) {
    console.error(
      `Aucun match n'a pu être généré pour la poule ${poolIndex} du groupe ${groupId}`
    );
  }

  return matches;
};

/**
 * Génère les paires de combats optimales selon la taille de la poule
 * @param {number} poolSize - Nombre de participants dans la poule
 * @returns {Array} - Liste des paires d'indices des participants
 */
const generateMatchups = (poolSize) => {
  // Cas spécial pour une poule de 4
  if (poolSize === 4) {
    return [
      [0, 1], // A vs B
      [2, 3], // C vs D
      [0, 2], // A vs C
      [1, 3], // B vs D
      [0, 3], // A vs D
      [1, 2], // B vs C
    ];
  }

  // Pour les autres tailles de poule, générer toutes les combinaisons possibles
  const matchups = [];
  for (let i = 0; i < poolSize; i++) {
    for (let j = i + 1; j < poolSize; j++) {
      matchups.push([i, j]);
    }
  }

  return matchups;
};
