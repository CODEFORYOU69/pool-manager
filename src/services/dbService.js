// Fonction pour détecter si l'application est exécutée dans Electron
const isElectron = () => {
  // Vérification plus robuste pour Electron
  return (
    typeof window !== "undefined" &&
    ((window.process && window.process.type === "renderer") ||
      (window.navigator &&
        window.navigator.userAgent.indexOf("Electron") !== -1))
  );
};

// URLs de l'API - utilise localhost sur votre machine, adresse IP sur le réseau
const LOCAL_API_URL = "http://localhost:3001/api";
const NETWORK_API_URL = "http://192.168.1.18:3001/api";

// Utilise l'URL appropriée selon le contexte d'exécution
const API_URL = isElectron() ? LOCAL_API_URL : NETWORK_API_URL;
export { API_URL }; // Exporter API_URL pour l'utiliser dans d'autres fichiers

console.log(
  "Mode d'exécution:",
  isElectron() ? "Electron (localhost)" : "Navigateur (réseau)"
);
console.log("URL de l'API utilisée:", API_URL);

// Nouvelle fonction pour récupérer un match par son numéro dans une compétition
export const getMatchByNumber = async (competitionId, matchNumber) => {
  try {
    console.log(
      `Recherche du match numéro ${matchNumber} dans la compétition ${competitionId}`
    );

    // Vérifier que les paramètres sont valides
    if (!competitionId) {
      throw new Error("ID de compétition non fourni");
    }

    if (!matchNumber) {
      throw new Error("Numéro de match non fourni");
    }

    // Appel à l'API en respectant l'ordre des paramètres
    const response = await fetch(
      `${API_URL}/match/byNumber/${competitionId}/${matchNumber}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Erreur lors de la recherche du match #${matchNumber}: ${response.status}`
      );
    }

    const match = await response.json();
    console.log(`Match #${matchNumber} trouvé avec ID: ${match.id}`);
    return match;
  } catch (error) {
    console.error(
      `Erreur détaillée lors de la recherche du match #${matchNumber}:`,
      error
    );
    throw error;
  }
};

// Sauvegarde d'une compétition nouvelle ou mise à jour d'une existante
export const saveCompetitionState = async (competitionData) => {
  try {
    console.log("Tentative de sauvegarde de la compétition:", competitionData);
    console.log(
      "poolSize reçu:",
      competitionData.poolSize,
      "type:",
      typeof competitionData.poolSize
    );

    // Préparer les données de la compétition
    const competitionToSave = {
      name: competitionData.name || "Compétition de Taekwondo",
      date: new Date(),
      startTime: competitionData.startTime,
      roundDuration: competitionData.roundDuration,
      breakDuration: competitionData.breakDuration,
      breakFrequency: competitionData.breakFrequency,
      poolSize: competitionData.poolSize,
    };

    console.log("Données préparées pour la sauvegarde:", competitionToSave);
    console.log(
      "poolSize envoyé à l'API:",
      competitionToSave.poolSize,
      "type:",
      typeof competitionToSave.poolSize
    );

    // Déterminer si on crée une nouvelle compétition ou on met à jour une existante
    let url = `${API_URL}/competition`;
    let method = "POST";

    // Si un ID est fourni, on fait une mise à jour
    if (competitionData.id) {
      console.log(
        `Mise à jour de la compétition existante avec ID: ${competitionData.id}`
      );
      url = `${API_URL}/competition/${competitionData.id}`;
      method = "PUT";
    } else {
      console.log("Création d'une nouvelle compétition");
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(competitionToSave),
    });

    if (!response.ok) {
      // Capturer le code HTTP de l'erreur pour le traiter plus tard
      const statusCode = response.status;
      let errorMessage;

      try {
        const errorData = await response.json();
        errorMessage = errorData.details || `Erreur HTTP: ${statusCode}`;
      } catch (jsonError) {
        // Si le corps de la réponse n'est pas du JSON valide
        errorMessage = `Erreur HTTP: ${statusCode}`;
      }

      // Créer une erreur avec le code de statut pour permettre des traitements spécifiques
      const error = new Error(errorMessage);
      error.statusCode = statusCode;
      throw error;
    }

    const result = await response.json();
    console.log("Compétition sauvegardée avec succès:", result);
    return result;
  } catch (error) {
    console.error(
      "Erreur détaillée lors de la sauvegarde de la compétition:",
      error
    );

    // Propager l'erreur avec le code de statut si disponible
    const enhancedError = new Error(
      "Erreur lors de la sauvegarde de la compétition."
    );
    enhancedError.cause = error;
    enhancedError.statusCode = error.statusCode; // Conserver le code de statut
    throw enhancedError;
  }
};

// Sauvegarde des groupes et poules
// Sauvegarde des groupes et poules - Version corrigée
export const saveGroupsAndPools = async (competitionId, groups) => {
  const errors = [];
  const savedGroups = [];
  const participantGroupAssociations = [];

  // Vérification des données de base
  if (!competitionId) {
    console.error("ID de compétition manquant");
    throw new Error("ID de compétition requis");
  }

  if (!groups || !Array.isArray(groups) || groups.length === 0) {
    console.error("Aucun groupe à sauvegarder");
    throw new Error("Aucun groupe à sauvegarder");
  }

  console.log(
    `Sauvegarde de ${groups.length} groupes pour la compétition ${competitionId}`
  );
  console.log(
    "Structure du premier groupe:",
    JSON.stringify(groups[0], null, 2)
  );

  // 1ère étape: récupérer tous les participants de la compétition pour vérification
  try {
    console.log(
      `Récupération des participants pour la compétition ${competitionId}...`
    );
    const participantsResponse = await fetch(
      `${API_URL}/participants?competitionId=${competitionId}`,
      {
        method: "GET",
      }
    );

    if (!participantsResponse.ok) {
      console.warn(
        `Impossible de récupérer les participants existants: ${participantsResponse.status}`
      );
    } else {
      const existingParticipants = await participantsResponse.json();
      console.log(
        `${existingParticipants.length} participants trouvés dans la base de données`
      );

      // Créer un set des IDs pour vérification rapide
      const existingParticipantIds = new Set(
        existingParticipants.map((p) => p.id)
      );

      // Vérifier les IDs des participants dans les groupes
      let totalParticipantsInGroups = 0;
      let validParticipantsInGroups = 0;
      // Garder la trace des participants déjà comptés pour éviter les doublons
      const countedParticipantIds = new Set();

      groups.forEach((group) => {
        if (Array.isArray(group.participants)) {
          totalParticipantsInGroups += group.participants.length;

          group.participants.forEach((participant) => {
            if (
              participant &&
              participant.id &&
              existingParticipantIds.has(participant.id) &&
              !countedParticipantIds.has(participant.id)
            ) {
              validParticipantsInGroups++;
              countedParticipantIds.add(participant.id);
            }
          });
        }

        if (Array.isArray(group.pools)) {
          group.pools.forEach((pool) => {
            if (Array.isArray(pool)) {
              pool.forEach((participantId) => {
                if (
                  participantId &&
                  existingParticipantIds.has(participantId) &&
                  !countedParticipantIds.has(participantId)
                ) {
                  validParticipantsInGroups++;
                  countedParticipantIds.add(participantId);
                } else if (
                  participantId &&
                  !existingParticipantIds.has(participantId)
                ) {
                  console.warn(
                    `Participant ${participantId} dans la poule mais non trouvé dans la base de données`
                  );
                }
              });
            }
          });
        }
      });

      console.log(
        `Validation des participants: ${validParticipantsInGroups} valides sur ${totalParticipantsInGroups} total`
      );
    }
  } catch (error) {
    console.error("Erreur lors de la vérification des participants:", error);
  }

  for (let group of groups) {
    try {
      // Validation des données du groupe
      if (!group.gender) {
        console.error("Genre manquant pour le groupe:", group);
        errors.push("Genre manquant pour un groupe");
        continue;
      }

      if (!group.ageCategory) {
        console.error("Catégorie d'âge manquante pour le groupe:", group);
        errors.push("Catégorie d'âge manquante pour un groupe");
        continue;
      }

      if (!group.weightCategory) {
        console.error("Catégorie de poids manquante pour le groupe:", group);
        errors.push("Catégorie de poids manquante pour un groupe");
        continue;
      }

      // Extraire et vérifier les informations de catégorie d'âge
      let ageCategoryName, ageCategoryMin, ageCategoryMax;

      if (typeof group.ageCategory === "object") {
        ageCategoryName = group.ageCategory.name || "Catégorie inconnue";

        // Vérifier si min et max existent et sont des nombres
        if ("min" in group.ageCategory && !isNaN(group.ageCategory.min)) {
          ageCategoryMin = group.ageCategory.min;
        } else {
          console.log(
            `Min manquant pour ${ageCategoryName}, utilisation de valeur par défaut 0`
          );
          ageCategoryMin = 0;
        }

        if ("max" in group.ageCategory && !isNaN(group.ageCategory.max)) {
          ageCategoryMax = group.ageCategory.max;
        } else {
          console.log(
            `Max manquant pour ${ageCategoryName}, utilisation de valeur par défaut 99`
          );
          ageCategoryMax = 99;
        }
      } else if (typeof group.ageCategory === "string") {
        // Si c'est une chaîne, on utilise comme nom avec valeurs par défaut
        ageCategoryName = group.ageCategory;
        ageCategoryMin = 0;
        ageCategoryMax = 99;
      } else {
        console.error("Format de catégorie d'âge invalide:", group.ageCategory);
        errors.push("Format de catégorie d'âge invalide");
        continue;
      }

      // Extraire et vérifier les informations de catégorie de poids
      let weightCategoryName, weightCategoryMax;

      if (typeof group.weightCategory === "object") {
        weightCategoryName = group.weightCategory.name || "Catégorie inconnue";

        // Vérifier si max existe et est un nombre
        if ("max" in group.weightCategory && !isNaN(group.weightCategory.max)) {
          weightCategoryMax = group.weightCategory.max;
        } else {
          console.log(
            `Max manquant pour ${weightCategoryName}, utilisation de valeur par défaut 999`
          );
          weightCategoryMax = 999;
        }
      } else if (typeof group.weightCategory === "string") {
        // Si c'est une chaîne, on utilise comme nom avec valeur par défaut
        weightCategoryName = group.weightCategory;
        weightCategoryMax = 999;
      } else {
        console.error(
          "Format de catégorie de poids invalide:",
          group.weightCategory
        );
        errors.push("Format de catégorie de poids invalide");
        continue;
      }

      // Préparation des données du groupe au format attendu par l'API
      const groupData = {
        competitionId,
        gender: group.gender,
        ageCategoryName,
        ageCategoryMin,
        ageCategoryMax,
        weightCategoryName,
        weightCategoryMax,
      };

      console.log(
        `Sauvegarde du groupe: ${groupData.gender} - ${groupData.ageCategoryName} - ${groupData.weightCategoryName}`
      );
      console.log("Données formatées:", groupData);

      const groupResponse = await fetch(`${API_URL}/group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(groupData),
      });

      if (!groupResponse.ok) {
        const responseText = await groupResponse.text();
        console.error(
          `Erreur lors de la sauvegarde du groupe: ${responseText}`
        );
        errors.push(`Erreur lors de la sauvegarde du groupe: ${responseText}`);
        continue;
      }

      const savedGroup = await groupResponse.json();
      console.log(`Groupe créé avec succès: ${savedGroup.id}`);
      savedGroups.push(savedGroup);

      // Créer les associations participant-groupe si les participants sont disponibles
      if (Array.isArray(group.participants) && group.participants.length > 0) {
        console.log(
          `Association de ${group.participants.length} participants au groupe ${savedGroup.id}`
        );

        for (const participant of group.participants) {
          if (participant && participant.id) {
            try {
              // Vérifier d'abord si le participant existe
              const checkParticipantResponse = await fetch(
                `${API_URL}/participant/${participant.id}`,
                {
                  method: "GET",
                }
              );

              if (!checkParticipantResponse.ok) {
                console.warn(
                  `Participant ${participant.id} non trouvé pour le groupe ${savedGroup.id}`
                );
                continue;
              }

              // Créer l'association participant-groupe
              const participantGroupResponse = await fetch(
                `${API_URL}/participantGroup`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    participantId: participant.id,
                    groupId: savedGroup.id,
                  }),
                }
              );

              if (!participantGroupResponse.ok) {
                console.warn(
                  `Erreur lors de l'association du participant ${participant.id} au groupe ${savedGroup.id}`
                );
              } else {
                console.log(
                  `Participant ${participant.id} associé au groupe ${savedGroup.id}`
                );
                participantGroupAssociations.push({
                  participantId: participant.id,
                  groupId: savedGroup.id,
                });
              }
            } catch (error) {
              console.error(
                `Erreur lors de l'association du participant ${participant.id} au groupe ${savedGroup.id}:`,
                error
              );
            }
          }
        }
      }

      // Vérification de la présence des poules
      if (!group.pools || !Array.isArray(group.pools)) {
        console.warn(`Pas de poules pour le groupe ${savedGroup.id}`);
        continue;
      }

      console.log(
        `Sauvegarde de ${group.pools.length} poules pour le groupe ${savedGroup.id}`
      );

      const poolIds = [];
      for (let poolIndex = 0; poolIndex < group.pools.length; poolIndex++) {
        try {
          const poolData = group.pools[poolIndex];

          console.log(
            `Sauvegarde de la poule ${poolIndex + 1} pour le groupe ${
              savedGroup.id
            }`
          );
          const poolResponse = await fetch(`${API_URL}/pool`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              groupId: savedGroup.id,
              poolIndex: poolIndex,
            }),
          });

          if (!poolResponse.ok) {
            const errorText = await poolResponse.text();
            console.error(
              `Erreur lors de la sauvegarde de la poule ${
                poolIndex + 1
              }: ${errorText}`
            );
            errors.push(
              `Erreur lors de la sauvegarde de la poule ${
                poolIndex + 1
              }: ${errorText}`
            );
            continue;
          }

          const savedPool = await poolResponse.json();
          console.log(`Poule créée avec succès: ${savedPool.id}`);
          poolIds.push(savedPool.id);

          if (!Array.isArray(poolData)) {
            console.warn(
              `Les données de la poule ${savedPool.id} ne sont pas un tableau`
            );
            continue;
          }

          // Filtrer les participants valides avant de les sauvegarder
          const validParticipants = poolData.filter(
            (participantId) =>
              participantId !== undefined && participantId !== null
          );

          if (validParticipants.length === 0) {
            console.warn(
              `Aucun participant valide pour la poule ${savedPool.id}`
            );
            continue;
          }

          console.log(
            `Sauvegarde de ${validParticipants.length} participants pour la poule ${savedPool.id}`
          );

          for (let participantId of validParticipants) {
            try {
              // Vérifier d'abord si le participant existe
              const checkParticipantResponse = await fetch(
                `${API_URL}/participant/${participantId}`,
                {
                  method: "GET",
                }
              );

              if (!checkParticipantResponse.ok) {
                console.warn(
                  `Participant ${participantId} non trouvé, ignoré pour la poule ${savedPool.id}`
                );
                errors.push(
                  `Participant ${participantId} non trouvé pour la poule ${savedPool.id}`
                );
                continue; // Continuer avec le prochain participant sans arrêter l'exécution
              }

              // Créer également l'association participant-groupe si elle n'existe pas déjà
              if (
                !participantGroupAssociations.some(
                  (assoc) =>
                    assoc.participantId === participantId &&
                    assoc.groupId === savedGroup.id
                )
              ) {
                const participantGroupResponse = await fetch(
                  `${API_URL}/participantGroup`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      participantId: participantId,
                      groupId: savedGroup.id,
                    }),
                  }
                );

                if (participantGroupResponse.ok) {
                  console.log(
                    `Participant ${participantId} associé au groupe ${savedGroup.id} via la poule`
                  );
                  participantGroupAssociations.push({
                    participantId: participantId,
                    groupId: savedGroup.id,
                  });
                }
              }

              // Le participant existe, on peut l'ajouter à la poule
              const poolParticipantResponse = await fetch(
                `${API_URL}/poolParticipant`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    poolId: savedPool.id,
                    participantId,
                  }),
                }
              );

              if (!poolParticipantResponse.ok) {
                const errorText = await poolParticipantResponse.text();
                console.warn(
                  `Erreur lors de l'ajout du participant ${participantId} à la poule ${savedPool.id}: ${errorText}`
                );
                errors.push(
                  `Erreur lors de l'ajout du participant ${participantId} à la poule ${savedPool.id}: ${errorText}`
                );
                // On continue avec le prochain participant
              } else {
                console.log(
                  `Participant ${participantId} ajouté à la poule ${savedPool.id}`
                );
              }
            } catch (error) {
              console.error(
                `Erreur lors du traitement du participant ${participantId} pour la poule ${savedPool.id}:`,
                error
              );
              errors.push(
                `Erreur lors du traitement du participant ${participantId} pour la poule ${savedPool.id}: ${error.message}`
              );
              // On continue avec le prochain participant sans arrêter l'exécution
            }
          }
        } catch (error) {
          console.error(
            `Erreur lors du traitement de la poule ${
              poolIndex + 1
            } pour le groupe ${savedGroup.id}:`,
            error
          );
          errors.push(
            `Erreur lors du traitement de la poule ${
              poolIndex + 1
            } pour le groupe ${savedGroup.id}: ${error.message}`
          );
          // On continue avec la prochaine poule sans arrêter l'exécution
        }
      }

      // Ajouter les IDs de poules au groupe sauvegardé pour référence future
      savedGroup.poolIds = poolIds;
    } catch (error) {
      console.error("Erreur lors du traitement du groupe:", error);
      errors.push(`Erreur lors du traitement du groupe: ${error.message}`);
      // On continue avec le prochain groupe sans arrêter l'exécution
    }
  }

  if (errors.length > 0) {
    console.warn(`Sauvegarde terminée avec ${errors.length} erreurs:`, errors);
    return { success: false, errors, savedGroups };
  }

  console.log("Sauvegarde des groupes et poules terminée avec succès");
  console.log(
    `Nombre d'associations participant-groupe créées: ${participantGroupAssociations.length}`
  );

  // Identifier les participants qui n'ont pas été placés dans des groupes
  try {
    const placedParticipantIds = new Set(
      participantGroupAssociations.map((assoc) => assoc.participantId)
    );

    // Récupérer à nouveau tous les participants pour vérifier ceux qui sont placés/non placés
    const allParticipantsResponse = await fetch(
      `${API_URL}/participants?competitionId=${competitionId}`,
      { method: "GET" }
    );

    if (allParticipantsResponse.ok) {
      const allParticipants = await allParticipantsResponse.json();
      const unplacedParticipants = allParticipants.filter(
        (p) => !placedParticipantIds.has(p.id)
      );

      console.log(
        `Nombre de participants non placés dans des groupes: ${unplacedParticipants.length}`
      );

      // Analyser les catégories des groupes existants
      const groupCategories = savedGroups.map((group) => ({
        gender: group.gender,
        ageCategory: group.ageCategoryName,
        weightCategory: group.weightCategoryName,
        ageMin: group.ageCategoryMin,
        ageMax: group.ageCategoryMax,
        weightMax: group.weightCategoryMax,
      }));

      console.log(
        "Catégories disponibles dans les groupes:",
        JSON.stringify(groupCategories, null, 2)
      );

      // Analyser les participants non placés
      if (unplacedParticipants.length > 0) {
        console.log("Détails des participants non placés:");

        // Regrouper par sexe pour analyse
        const participantsBySexe = {};
        unplacedParticipants.forEach((p) => {
          const sexe = p.sexe || "unknown";
          if (!participantsBySexe[sexe]) {
            participantsBySexe[sexe] = [];
          }
          participantsBySexe[sexe].push(p);

          console.log(
            `ID: ${p.id}, Nom: ${p.nom} ${p.prenom}, Sexe: ${p.sexe}, Age: ${p.age}, Poids: ${p.poids}`
          );
        });

        // Afficher la répartition par sexe
        console.log("Répartition des participants non placés par sexe:");
        Object.keys(participantsBySexe).forEach((sexe) => {
          console.log(
            `${sexe}: ${participantsBySexe[sexe].length} participants`
          );
        });

        // Vérifier pour chaque participant non placé pourquoi il ne correspond à aucun groupe
        unplacedParticipants.forEach((p) => {
          const matchingGroups = savedGroups.filter((group) => {
            const matchesSexe = p.sexe === group.gender;
            const matchesAge =
              p.age >= group.ageCategoryMin && p.age <= group.ageCategoryMax;
            const matchesWeight = p.poids <= group.weightCategoryMax;

            return matchesSexe && matchesAge && matchesWeight;
          });

          if (matchingGroups.length === 0) {
            console.log(
              `Participant ${p.id} (${p.nom} ${p.prenom}) ne correspond à aucun groupe existant.`
            );
            console.log(`  Sexe: ${p.sexe}, Age: ${p.age}, Poids: ${p.poids}`);
          } else {
            console.log(
              `Participant ${p.id} (${p.nom} ${p.prenom}) correspond à ${matchingGroups.length} groupe(s) mais n'a pas été placé!`
            );
          }
        });
      }
    }
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des participants non placés:",
      error
    );
  }

  return { success: true, savedGroups };
};

// Sauvegarde d'un match individuel et de ses résultats
export const saveMatchResult = async (matchId, results) => {
  try {
    console.log("=== Début de saveMatchResult ===");
    console.log("Type de matchId:", typeof matchId);
    console.log("Valeur de matchId:", matchId);
    console.log("Résultats reçus:", JSON.stringify(results, null, 2));

    if (!matchId) {
      throw new Error("ID du match non fourni");
    }

    // Récupérer d'abord les informations du match pour vérifier les positions des participants
    console.log(
      "Récupération des informations du match avant la mise à jour..."
    );
    const matchInfoResponse = await fetch(`${API_URL}/match/${matchId}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!matchInfoResponse.ok) {
      throw new Error(
        `Erreur lors de la récupération des informations du match: ${matchInfoResponse.status}`
      );
    }

    const matchInfo = await matchInfoResponse.json();
    console.log(
      "Informations du match récupérées:",
      JSON.stringify(matchInfo.matchParticipants, null, 2)
    );

    // Identifier les participants par position
    const participantA = matchInfo.matchParticipants.find(
      (mp) => mp.position === "A"
    );
    const participantB = matchInfo.matchParticipants.find(
      (mp) => mp.position === "B"
    );

    if (!participantA || !participantB) {
      console.error(
        "Impossible de trouver les participants A et B dans le match"
      );
      throw new Error("Données du match incomplètes");
    }

    console.log("Position A:", participantA.participantId);
    console.log("Position B:", participantB.participantId);

    // Déterminer le vainqueur en fonction des rounds gagnés par position
    let winnerId = null;
    let winnerPosition = null;

    if (results.completed) {
      // Compter les rounds gagnés par chaque position
      let roundsWonByA = 0;
      let roundsWonByB = 0;

      results.rounds.forEach((round) => {
        if (round.winner === "A") roundsWonByA++;
        if (round.winner === "B") roundsWonByB++;
      });

      console.log(`Rounds gagnés - A: ${roundsWonByA}, B: ${roundsWonByB}`);

      // Déterminer le vainqueur du match
      if (roundsWonByA > roundsWonByB) {
        winnerId = participantA.participantId;
        winnerPosition = "A";
      } else if (roundsWonByB > roundsWonByA) {
        winnerId = participantB.participantId;
        winnerPosition = "B";
      }

      console.log(
        `Vainqueur calculé: ${winnerPosition} (A: ${roundsWonByA} rounds, B: ${roundsWonByB} rounds)`
      );
      console.log(`ID du vainqueur: ${winnerId}`);
    }

    // Préparer les données de mise à jour
    console.log("Préparation des données de mise à jour...");
    const updateData = {
      status: results.completed ? "completed" : "pending",
      winner: winnerId, // Utiliser l'ID correct du vainqueur
      endTime: results.completed ? new Date().toISOString() : null,
      rounds: results.rounds.map((round, index) => {
        const roundWinnerId =
          round.winner === "A"
            ? participantA.participantId
            : round.winner === "B"
            ? participantB.participantId
            : null;

        return {
          roundNumber: index + 1,
          scoreA: round.fighterA,
          scoreB: round.fighterB,
          winner: roundWinnerId,
          winnerPosition: round.winner,
        };
      }),
    };

    console.log("Données de mise à jour:", JSON.stringify(updateData, null, 2));

    // Envoyer la mise à jour au serveur
    console.log("Envoi de la mise à jour au serveur...");
    const url = `${API_URL}/match/${matchId}/results`;
    console.log("URL de la requête:", url);

    const matchResponse = await fetch(url, {
      method: "POST", // Utiliser POST au lieu de PUT pour aller à un endpoint spécifique
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updateData),
    });

    console.log("Statut de la réponse:", matchResponse.status);

    if (!matchResponse.ok) {
      let errorMessage = `Erreur HTTP: ${matchResponse.status}`;
      try {
        const errorData = await matchResponse.json();
        errorMessage = errorData.message || errorData.details || errorMessage;
      } catch (e) {
        // Si la réponse n'est pas du JSON valide, on garde le message par défaut
        console.warn("Impossible de parser la réponse d'erreur comme JSON", e);
      }
      console.error("Erreur lors de la mise à jour:", errorMessage);
      throw new Error(errorMessage);
    }

    const updatedMatch = await matchResponse.json();
    console.log("Match mis à jour avec succès:", updatedMatch);
    return {
      success: true,
      match: updatedMatch,
      winnerPosition: winnerPosition,
    };
  } catch (error) {
    console.error("Erreur détaillée lors de la mise à jour du match:", error);
    return {
      success: false,
      error: error.message,
      details: error,
    };
  }
};

// Récupération des matches terminés
export const getCompletedMatches = async (competitionId) => {
  try {
    const response = await fetch(
      `${API_URL}/match?status=completed&competitionId=${competitionId}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des matches terminés");
    }

    return response.json();
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des matches terminés:",
      error
    );
    throw error;
  }
};

// Sauvegarde des participants
export const saveParticipants = async (competitionId, participants) => {
  try {
    console.log(
      "Sauvegarde des participants pour la compétition:",
      competitionId
    );
    console.log("Nombre de participants à sauvegarder:", participants.length);

    const savedParticipants = [];

    for (const participant of participants) {
      try {
        console.log("Tentative de sauvegarde du participant:", participant);

        // Vérification et nettoyage des données
        let sexe = (participant.sexe || "").toLowerCase().trim();

        // Amélioration de la normalisation du sexe
        if (
          sexe === "m" ||
          sexe === "h" ||
          sexe === "homme" ||
          sexe === "male" ||
          sexe === "masculin"
        ) {
          sexe = "male";
          console.log(
            `Sexe normalisé de ${participant.nom} ${participant.prenom}: "${participant.sexe}" -> "male"`
          );
        } else if (
          sexe === "f" ||
          sexe === "femme" ||
          sexe === "female" ||
          sexe === "féminin" ||
          sexe === "feminin"
        ) {
          sexe = "female";
          console.log(
            `Sexe normalisé de ${participant.nom} ${participant.prenom}: "${participant.sexe}" -> "female"`
          );
        } else if (
          participant.categorie &&
          typeof participant.categorie === "string"
        ) {
          // Tenter de déterminer le sexe à partir de la catégorie
          const lowerCategorie = participant.categorie.toLowerCase();
          if (
            lowerCategorie.startsWith("female-") ||
            lowerCategorie.startsWith("f-")
          ) {
            sexe = "female";
            console.log(
              `Sexe déterminé par catégorie pour ${participant.nom} ${participant.prenom}: "${participant.categorie}" -> "female"`
            );
          } else if (
            lowerCategorie.startsWith("male-") ||
            lowerCategorie.startsWith("m-")
          ) {
            sexe = "male";
            console.log(
              `Sexe déterminé par catégorie pour ${participant.nom} ${participant.prenom}: "${participant.categorie}" -> "male"`
            );
          } else {
            sexe = "unknown";
            console.warn(
              `Sexe non reconnu pour ${participant.nom} ${participant.prenom}: "${participant.sexe}"`
            );
          }
        } else {
          sexe = "unknown";
          console.warn(
            `Sexe non reconnu pour ${participant.nom} ${participant.prenom}: "${participant.sexe}"`
          );
        }

        const participantData = {
          nom: participant.nom?.trim() || "",
          prenom: participant.prenom?.trim() || "",
          sexe: sexe,
          age: parseInt(participant.age) || 0,
          poids:
            parseFloat(participant.poids?.toString().replace(",", ".")) || 0,
          ligue: participant.ligue?.trim() || "",
          competitionId: competitionId,
        };

        console.log("Données formatées du participant:", participantData);

        const response = await fetch(`${API_URL}/participant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(participantData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Erreur serveur: ${errorData.message || response.statusText}`
          );
        }

        const savedParticipant = await response.json();
        console.log("Participant sauvegardé avec succès:", savedParticipant);
        savedParticipants.push(savedParticipant);
      } catch (participantError) {
        console.error(
          `Erreur détaillée pour ${participant.nom} ${participant.prenom}:`,
          participantError
        );
        throw new Error(
          `Erreur lors de la sauvegarde du participant ${participant.nom} ${participant.prenom}: ${participantError.message}`
        );
      }
    }

    console.log(
      "Tous les participants ont été sauvegardés avec succès:",
      savedParticipants.length
    );
    return savedParticipants;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des participants:", error);
    throw error;
  }
};

// Mise à jour d'un match existant
export const updateMatchResult = async (matchId, matchData) => {
  try {
    console.log("Tentative de mise à jour du match:", matchId, matchData);

    const response = await fetch(`${API_URL}/match/${matchId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(matchData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Erreur lors de la mise à jour du match"
      );
    }

    const result = await response.json();
    console.log("Match mis à jour avec succès:", result);
    return result;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du match:", error);
    throw error;
  }
};

// Sauvegarde des matchs générés
export const saveGeneratedMatches = async (competitionId, matchesByPool) => {
  const errors = [];
  const savedMatches = [];
  // Garder une trace des combinaisons de participants déjà sauvegardées
  const savedCombinations = new Set();

  if (!competitionId) {
    console.error("ID de compétition manquant");
    throw new Error("ID de compétition requis");
  }

  if (
    !matchesByPool ||
    !Array.isArray(matchesByPool) ||
    matchesByPool.length === 0
  ) {
    console.error("Aucun match par poule à sauvegarder");
    throw new Error("Aucun match par poule à sauvegarder");
  }

  console.log(
    `Sauvegarde des matchs pour ${matchesByPool.length} poules dans la compétition ${competitionId}`
  );
  console.log(
    "Structure des matchs par poule:",
    JSON.stringify(matchesByPool[0], null, 2)
  );

  try {
    // Boucle sur chaque poule
    for (const poolItem of matchesByPool) {
      const { poolId, matches } = poolItem;

      if (!poolId) {
        console.error("ID de poule manquant pour un ensemble de matchs");
        errors.push("ID de poule manquant");
        continue;
      }

      if (!matches || !Array.isArray(matches) || matches.length === 0) {
        console.warn(`Aucun match à sauvegarder pour la poule ${poolId}`);
        continue;
      }

      console.log(
        `Sauvegarde de ${matches.length} matchs pour la poule ${poolId}`
      );

      // Récupérer les informations de la poule
      const poolResponse = await fetch(`${API_URL}/pool/${poolId}`, {
        method: "GET",
      });

      if (!poolResponse.ok) {
        console.error(
          `Poule ${poolId} non trouvée, impossible de sauvegarder les matchs`
        );
        errors.push(`Poule ${poolId} non trouvée`);
        continue;
      }

      const pool = await poolResponse.json();
      console.log(`Informations de la poule récupérées:`, pool);

      // Récupérer les informations du groupe
      const groupResponse = await fetch(`${API_URL}/group/${pool.groupId}`, {
        method: "GET",
      });

      if (!groupResponse.ok) {
        console.error(
          `Groupe ${pool.groupId} non trouvé, impossible de sauvegarder les matchs`
        );
        errors.push(`Groupe ${pool.groupId} non trouvé`);
        continue;
      }

      const group = await groupResponse.json();
      console.log(`Informations du groupe récupérées:`, group);

      // Sauvegarder chaque match de la poule
      for (const match of matches) {
        try {
          if (!match.participants || match.participants.length !== 2) {
            console.warn(`Match sans participants valides, ignoré`);
            continue;
          }

          // Créer une clé unique pour ce match basée sur les IDs des participants
          const participant1 = match.participants[0]?.id || "";
          const participant2 = match.participants[1]?.id || "";
          const matchKey = [participant1, participant2].sort().join("|");

          // Vérifier si cette combinaison a déjà été sauvegardée
          if (savedCombinations.has(matchKey)) {
            console.log(
              `Match entre ${participant1} et ${participant2} déjà sauvegardé, éviter le doublon`
            );
            continue;
          }

          // Marquer cette combinaison comme sauvegardée
          savedCombinations.add(matchKey);

          // Trouver le numéro du match à partir des informations de schedule
          // Le match.number peut venir du schedule
          let matchNumber = 0;

          if (match.number) {
            // Si le numéro est déjà défini dans le match
            matchNumber = match.number;
            console.log(`Numéro du match trouvé directement: ${matchNumber}`);
          } else if (match.id) {
            // Essayer de trouver le numéro dans les informations associées au match
            console.log(`Recherche du numéro pour le match ID: ${match.id}`);
          } else {
            // Générer un numéro basé sur l'index dans la poule
            const index = matches.indexOf(match);
            matchNumber = index + 1 + pool.poolIndex * 100; // Créer un numéro unique basé sur l'index de poule
            console.log(`Numéro généré pour le match: ${matchNumber}`);
          }

          // Préparer les données du match
          const matchData = {
            poolId: poolId,
            groupId: pool.groupId,
            poolIndex: pool.poolIndex,
            matchNumber: matchNumber,
            areaNumber: match.areaNumber || 1, // Utiliser l'aire spécifiée ou la valeur par défaut
            startTime: match.startTime ? new Date(match.startTime) : new Date(),
            status: "pending",
          };

          console.log(
            `Sauvegarde du match #${matchNumber} pour la poule ${poolId}:`,
            matchData
          );

          // Créer le match
          const matchResponse = await fetch(`${API_URL}/match`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(matchData),
          });

          if (!matchResponse.ok) {
            const errorText = await matchResponse.text();
            console.error(`Erreur lors de la création du match: ${errorText}`);
            errors.push(`Erreur lors de la création du match: ${errorText}`);
            continue;
          }

          const savedMatch = await matchResponse.json();
          console.log(
            `Match #${matchNumber} créé avec succès: ${savedMatch.id}`
          );
          savedMatches.push(savedMatch);

          // Associer les participants au match avec une gestion améliorée des erreurs
          const participantPromises = [];
          for (let i = 0; i < 2; i++) {
            const participant = match.participants[i];
            const position = i === 0 ? "A" : "B";

            if (!participant || !participant.id) {
              console.warn(
                `Participant invalide à la position ${position} pour le match ${savedMatch.id}`
              );
              continue;
            }

            // Vérifier d'abord que le participant existe bien
            const checkParticipantResponse = await fetch(
              `${API_URL}/participant/${participant.id}`,
              {
                method: "GET",
              }
            );

            if (!checkParticipantResponse.ok) {
              console.warn(
                `Participant ${participant.id} non trouvé, ignoré pour le match ${savedMatch.id}`
              );
              continue;
            }

            console.log(
              `Ajout du participant ${participant.id} en position ${position} au match ${savedMatch.id}`
            );

            // Créer une promesse pour l'ajout du participant au match
            participantPromises.push(
              (async () => {
                try {
                  const matchParticipantResponse = await fetch(
                    `${API_URL}/matchParticipant`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        matchId: savedMatch.id,
                        participantId: participant.id,
                        position: position,
                      }),
                    }
                  );

                  const responseText = await matchParticipantResponse.text();
                  console.log(`Réponse brute: ${responseText}`);

                  if (!matchParticipantResponse.ok) {
                    console.warn(
                      `Erreur lors de l'ajout du participant ${participant.id} au match ${savedMatch.id}: ${responseText}`
                    );
                    errors.push(
                      `Erreur lors de l'ajout du participant ${participant.id} au match ${savedMatch.id}: ${responseText}`
                    );
                  } else {
                    console.log(
                      `Participant ${participant.id} ajouté au match ${savedMatch.id} en position ${position}`
                    );
                  }
                } catch (error) {
                  console.error(
                    `Erreur lors de l'ajout du participant ${participant.id} au match ${savedMatch.id}:`,
                    error
                  );
                  errors.push(
                    `Erreur lors de l'ajout du participant ${participant.id} au match ${savedMatch.id}: ${error.message}`
                  );
                }
              })()
            );
          }

          // Attendre que toutes les associations de participants soient terminées
          await Promise.all(participantPromises);

          // Vérifier que les participants ont bien été associés au match
          const matchWithParticipants = await fetch(
            `${API_URL}/match/${savedMatch.id}`,
            {
              method: "GET",
            }
          );

          if (matchWithParticipants.ok) {
            const matchData = await matchWithParticipants.json();
            if (
              matchData.matchParticipants &&
              matchData.matchParticipants.length > 0
            ) {
              console.log(
                `Match ${savedMatch.id} a ${matchData.matchParticipants.length} participants associés`
              );
            } else {
              console.warn(
                `Match ${savedMatch.id} n'a pas de participants associés`
              );
            }
          }
        } catch (error) {
          console.error(`Erreur lors du traitement d'un match:`, error);
          errors.push(`Erreur lors du traitement d'un match: ${error.message}`);
        }
      }
    }

    console.log(`${savedMatches.length} matchs sauvegardés (sans doublons)`);

    if (errors.length > 0) {
      console.warn(
        `Sauvegarde terminée avec ${errors.length} erreurs:`,
        errors
      );
      return { success: false, savedMatches, errors };
    }

    console.log("Sauvegarde des matchs terminée avec succès");
    return { success: true, savedMatches };
  } catch (error) {
    console.error("Erreur générale lors de la sauvegarde des matchs:", error);
    errors.push(`Erreur générale: ${error.message}`);
    return { success: false, savedMatches, errors };
  }
};

// Récupération de toutes les compétitions
export const fetchCompetitions = async () => {
  try {
    const response = await fetch(`${API_URL}/competitions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des compétitions");
    }

    return response.json();
  } catch (error) {
    console.error("Erreur lors de la récupération des compétitions:", error);
    throw error;
  }
};

// Récupération d'une compétition spécifique avec ses détails
export const fetchCompetitionDetails = async (competitionId) => {
  try {
    const response = await fetch(`${API_URL}/competition/${competitionId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération de la compétition");
    }

    return response.json();
  } catch (error) {
    console.error("Erreur lors de la récupération de la compétition:", error);
    throw error;
  }
};

// Suppression d'une compétition
export const deleteCompetition = async (competitionId) => {
  try {
    const response = await fetch(`${API_URL}/competition/${competitionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Erreur lors de la suppression de la compétition"
      );
    }

    return response.json();
  } catch (error) {
    console.error("Erreur lors de la suppression de la compétition:", error);
    throw error;
  }
};

// Vérifier si des groupes et poules existent déjà pour une compétition
export const checkExistingGroupsAndPools = async (competitionId) => {
  try {
    if (!competitionId) {
      console.error("ID de compétition manquant");
      return { exists: false, count: 0 };
    }

    const response = await fetch(
      `${API_URL}/competition/${competitionId}/groups`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn(
        `Erreur lors de la vérification des groupes existants: ${response.status}`
      );
      return { exists: false, count: 0 };
    }

    const groups = await response.json();
    console.log(
      `${groups.length} groupes existants trouvés pour la compétition ${competitionId}`
    );

    return {
      exists: groups.length > 0,
      count: groups.length,
      groups: groups,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des groupes existants:",
      error
    );
    return { exists: false, count: 0 };
  }
};

// Vérifier si des matchs existent déjà pour une compétition
export const checkExistingMatches = async (competitionId) => {
  try {
    if (!competitionId) {
      console.error("ID de compétition manquant dans checkExistingMatches");
      return { exists: false, count: 0 };
    }

    // Utilisation d'un endpoint qui existe réellement pour vérifier les matchs
    console.log(
      `Vérification des matchs existants pour compétition ${competitionId}...`
    );
    const response = await fetch(
      `${API_URL}/competition/${competitionId}/matches`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`Statut de la réponse: ${response.status}`);

    if (!response.ok) {
      console.error(
        `Erreur HTTP lors de la vérification des matchs: ${response.status}`
      );
      if (response.status === 404) {
        // La route n'existe pas - probable erreur côté API
        console.warn(
          "L'endpoint /competition/:id/matches n'existe pas. Essai de l'endpoint alternatif..."
        );
        // Essayer un autre endpoint si le premier n'existe pas
        const altResponse = await fetch(
          `${API_URL}/competition/${competitionId}/matchesWithDetails`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        if (!altResponse.ok) {
          console.error(
            `Erreur HTTP avec l'endpoint alternatif: ${altResponse.status}`
          );
          return { exists: false, count: 0 };
        }

        const matches = await altResponse.json();
        console.log(
          `${matches.length} matchs trouvés avec l'endpoint alternatif`
        );
        return {
          exists: matches.length > 0,
          count: matches.length,
          matches: matches,
        };
      }

      return { exists: false, count: 0 };
    }

    const matches = await response.json();
    const count = Array.isArray(matches) ? matches.length : 0;

    console.log(
      `${count} matchs existants trouvés pour la compétition ${competitionId}`
    );

    return {
      exists: count > 0,
      count: count,
      matches: matches,
    };
  } catch (error) {
    console.error(
      "Erreur détaillée lors de la vérification des matchs existants:",
      error
    );
    // En cas d'erreur, considérer qu'il n'y a pas de matchs pour éviter la régénération
    return { exists: true, count: 1 };
  }
};

// Récupérer tous les groupes et poules d'une compétition avec structure formatée comme generateMatches
export const fetchFormattedGroupsAndPools = async (competitionId) => {
  try {
    if (!competitionId) {
      console.error("ID de compétition manquant");
      throw new Error("ID de compétition requis");
    }

    // Récupérer les groupes avec leurs poules et participants
    const response = await fetch(
      `${API_URL}/competition/${competitionId}/groupsWithDetails`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Erreur lors de la récupération des groupes: ${response.status}`
      );
    }

    const dbGroups = await response.json();

    // Transformer les données au format attendu par l'application
    const formattedGroups = dbGroups.map((group) => {
      return {
        id: group.id,
        gender: group.gender,
        ageCategory: {
          name: group.ageCategoryName,
          min: group.ageCategoryMin,
          max: group.ageCategoryMax,
        },
        weightCategory: {
          name: group.weightCategoryName,
          max: group.weightCategoryMax,
        },
        pools: group.pools.map((pool) => {
          return pool.poolParticipants.map((pp) => pp.participantId);
        }),
        participants: group.participants.map((p) => p.participant),
      };
    });

    console.log(`${formattedGroups.length} groupes récupérés et formatés`);

    // Ajouter un logging détaillé pour examiner la structure
    if (formattedGroups.length > 0) {
      const sampleGroup = formattedGroups[0];
      console.log(
        "Structure d'un groupe exemple:",
        JSON.stringify(
          {
            id: sampleGroup.id,
            gender: sampleGroup.gender,
            ageCategory: sampleGroup.ageCategory,
            weightCategory: sampleGroup.weightCategory,
            poolsCount: sampleGroup.pools.length,
            participantsCount: sampleGroup.participants
              ? sampleGroup.participants.length
              : 0,
          },
          null,
          2
        )
      );

      // Vérifier si les participants contiennent les informations complètes
      if (sampleGroup.participants && sampleGroup.participants.length > 0) {
        console.log(
          "Example de participant:",
          JSON.stringify(sampleGroup.participants[0], null, 2)
        );
      } else {
        console.warn("Aucun participant trouvé dans le premier groupe");
      }

      // Vérifier la structure des poules et des participants dans les poules
      if (sampleGroup.pools && sampleGroup.pools.length > 0) {
        console.log(
          "Example de poule:",
          JSON.stringify(sampleGroup.pools[0], null, 2)
        );
      }
    }

    return formattedGroups;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des groupes et poules:",
      error
    );
    throw error;
  }
};

// Récupérer tous les matchs d'une compétition avec structure formatée
export const fetchFormattedMatches = async (competitionId) => {
  try {
    if (!competitionId) {
      console.error("ID de compétition manquant");
      throw new Error("ID de compétition requis");
    }

    // Récupérer tous les matchs de la compétition
    const response = await fetch(
      `${API_URL}/competition/${competitionId}/matchesWithDetails`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Erreur lors de la récupération des matchs: ${response.status}`
      );
    }

    const dbMatches = await response.json();

    // Transformer les données de match au format attendu
    const formattedMatches = dbMatches.map((match) => {
      return {
        id: match.id,
        groupId: match.groupId,
        poolId: match.poolId,
        poolIndex: match.poolIndex,
        number: match.matchNumber,
        status: match.status,
        participants: match.matchParticipants.map((mp) => mp.participant),
        areaNumber: match.area?.areaNumber || 1,
        startTime: match.startTime,
      };
    });

    // Créer la structure de planning
    const schedule = formattedMatches.map((match) => {
      return {
        matchId: match.id,
        matchNumber: match.number,
        areaNumber: match.areaNumber,
        startTime: match.startTime,
        endTime:
          match.endTime ||
          new Date(new Date(match.startTime).getTime() + 3 * 60000), // Estimer 3 minutes par défaut
        type: "match",
      };
    });

    console.log(`${formattedMatches.length} matchs récupérés et formatés`);
    return { matches: formattedMatches, schedule };
  } catch (error) {
    console.error("Erreur lors de la récupération des matchs:", error);
    throw error;
  }
};

/**
 * Charge les matchs depuis la base de données
 * @param {string} competitionId - ID de la compétition
 * @returns {Promise<Array>} - Liste des matchs
 */
export const loadMatches = async (competitionId) => {
  try {
    const response = await fetch(`${API_URL}/matches/${competitionId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors du chargement des matchs:", error);
    throw error;
  }
};

/**
 * Vérifie si des résultats existent pour une compétition
 * @param {string} competitionId - ID de la compétition
 * @returns {Promise<{exists: boolean, count: number}>} - Résultat de la vérification
 */
export const checkExistingResults = async (competitionId) => {
  try {
    const response = await fetch(`${API_URL}/results/count/${competitionId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    return {
      exists: data.count > 0,
      count: data.count,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des résultats existants:",
      error
    );
    return { exists: false, count: 0 };
  }
};

/**
 * Charge les résultats depuis la base de données
 * @param {string} competitionId - ID de la compétition
 * @returns {Promise<Object>} - Objet avec les résultats des matchs
 */
export const loadResults = async (competitionId) => {
  try {
    const response = await fetch(`${API_URL}/results/${competitionId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors du chargement des résultats:", error);
    throw error;
  }
};

/**
 * Récupère toutes les données nécessaires pour le calcul des résultats des poules
 * @param {string} competitionId - ID de la compétition
 * @returns {Promise<Object>} - Toutes les données nécessaires
 */
export const fetchResultsData = async (competitionId) => {
  try {
    console.log(
      "Récupération des données de résultats pour la compétition:",
      competitionId
    );

    // 1. Récupérer les groupes avec leurs détails (poules et participants)
    const groupsResponse = await fetch(
      `${API_URL}/competition/${competitionId}/groupsWithDetails`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!groupsResponse.ok) {
      throw new Error(
        `Erreur lors de la récupération des groupes: ${groupsResponse.status}`
      );
    }

    const groups = await groupsResponse.json();
    console.log(`${groups.length} groupes récupérés avec leurs détails`);

    // 2. Récupérer tous les matchs, y compris ceux complétés
    const matchesResponse = await fetch(
      `${API_URL}/competition/${competitionId}/matchesWithDetails`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!matchesResponse.ok) {
      throw new Error(
        `Erreur lors de la récupération des matchs: ${matchesResponse.status}`
      );
    }

    const matches = await matchesResponse.json();
    console.log(`${matches.length} matchs récupérés au total`);

    // Vérifier les matchs complétés
    const completedMatches = matches.filter((m) => m.status === "completed");
    console.log(`${completedMatches.length} matchs complétés trouvés`);

    if (completedMatches.length > 0) {
      console.log("Exemple de match complété:", {
        id: completedMatches[0].id,
        matchNumber: completedMatches[0].matchNumber,
        winner: completedMatches[0].winner,
        rounds: completedMatches[0].rounds?.length || 0,
      });
    }

    // 3. Récupérer tous les participants
    const participantsResponse = await fetch(
      `${API_URL}/participants?competitionId=${competitionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!participantsResponse.ok) {
      throw new Error(
        `Erreur lors de la récupération des participants: ${participantsResponse.status}`
      );
    }

    const participants = await participantsResponse.json();
    console.log(`${participants.length} participants récupérés`);

    // 4. Récupérer tous les résultats de matchs sauvegardés séparément (si applicable)
    // Dans certains cas, les résultats peuvent être stockés dans une collection séparée
    let matchResults = {};

    try {
      const resultsResponse = await fetch(
        `${API_URL}/match/results/${competitionId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (resultsResponse.ok) {
        const results = await resultsResponse.json();
        // Organiser les résultats par ID de match
        results.forEach((result) => {
          matchResults[result.matchId] = result;
        });
        console.log(
          `${
            Object.keys(matchResults).length
          } résultats de matchs récupérés depuis la collection de résultats`
        );
      } else {
        console.log(
          "Pas de collection de résultats séparée disponible. Utilisation des données intégrées aux matchs."
        );
      }
    } catch (error) {
      console.log(
        "Pas de collection de résultats séparée disponible:",
        error.message
      );
    }

    // Si nous n'avons pas de résultats séparés, créer les résultats à partir des données de matchs
    if (Object.keys(matchResults).length === 0 && completedMatches.length > 0) {
      console.log(
        "Création des résultats à partir des données de matchs complétés"
      );

      completedMatches.forEach((match) => {
        // Créer un objet de résultat basé sur les données du match
        matchResults[match.id] = {
          matchId: match.id,
          winner: match.winner,
          completed: true,
          rounds: match.rounds || [],
        };
      });

      console.log(
        `${
          Object.keys(matchResults).length
        } résultats créés à partir des matchs complétés`
      );
    }

    return {
      participants,
      groups,
      matches,
      matchResults,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des données:", error);
    throw error;
  }
};

/**
 * Supprime tous les groupes d'une compétition
 * @param {string} competitionId - ID de la compétition
 * @returns {Promise<{success: boolean, message: string}>} - Résultat de l'opération
 */
export const deleteAllGroups = async (competitionId) => {
  try {
    console.log(
      `Suppression de tous les groupes pour la compétition ${competitionId}`
    );

    // Vérifier d'abord que la compétition existe
    const competitionResponse = await fetch(
      `${API_URL}/competition/${competitionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!competitionResponse.ok) {
      throw new Error(`Compétition non trouvée avec l'ID: ${competitionId}`);
    }

    // Récupérer tous les groupes existants pour cette compétition
    const groupsResponse = await fetch(
      `${API_URL}/competition/${competitionId}/groups`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!groupsResponse.ok) {
      throw new Error(
        `Erreur lors de la récupération des groupes: ${groupsResponse.status}`
      );
    }

    const groups = await groupsResponse.json();

    if (groups.length === 0) {
      return { success: true, message: "Aucun groupe à supprimer" };
    }

    console.log(`${groups.length} groupes à supprimer`);

    // Supprimer chaque groupe
    const deletionPromises = groups.map(async (group) => {
      try {
        const deleteResponse = await fetch(`${API_URL}/group/${group.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!deleteResponse.ok) {
          console.warn(
            `Erreur lors de la suppression du groupe ${group.id}: ${deleteResponse.status}`
          );
          return { success: false, groupId: group.id };
        }

        return { success: true, groupId: group.id };
      } catch (error) {
        console.error(
          `Erreur lors de la suppression du groupe ${group.id}:`,
          error
        );
        return { success: false, groupId: group.id, error: error.message };
      }
    });

    const results = await Promise.all(deletionPromises);
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: failed === 0,
      message: `${successful} groupes supprimés avec succès, ${failed} échecs`,
      details: {
        total: groups.length,
        successful,
        failed,
        failedGroupIds: results.filter((r) => !r.success).map((r) => r.groupId),
      },
    };
  } catch (error) {
    console.error("Erreur lors de la suppression des groupes:", error);
    return { success: false, message: error.message };
  }
};
