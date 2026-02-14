import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import React, { useEffect, useState } from "react";
import { Bracket } from "react-brackets";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  checkExistingGroupsAndPools,
  saveGeneratedMatches,
  saveGroupsAndPools,
} from "../services/dbService";
import "../styles/EliminationBracket.css";
import { categorizeParticipants } from "../utils/groupManager";

const EliminationBracket = ({
  participants,
  tournamentConfig,
  setGroups,
  nextStep,
  prevStep,
  goDirectlyToScoreInput,
}) => {
  const { competitionId } = useCompetition();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [participantRankings, setParticipantRankings] = useState({});
  const [groupedParticipants, setGroupedParticipants] = useState({});
  const [brackets, setBrackets] = useState({});
  const [currentStep, setCurrentStep] = useState("ranking");
  const [eliminationMatches, setEliminationMatches] = useState([]);
  const [savedGroups, setSavedGroups] = useState([]);
  const [sortByClub, setSortByClub] = useState({}); // Nouveau état pour gérer le tri par club pour chaque catégorie

  // Grouper les participants par catégorie en utilisant la même logique que les poules
  useEffect(() => {
    console.log("Catégorisation des participants pour l'élimination directe");
    console.log("Configuration du tournoi reçue:", tournamentConfig);
    console.log(
      "Nombre d'aires dans tournamentConfig:",
      tournamentConfig.numAreas,
      typeof tournamentConfig.numAreas
    );
    console.log(
      "Nombre d'aires alternatives:",
      tournamentConfig.numberOfAreas,
      typeof tournamentConfig.numberOfAreas
    );

    // Utiliser la même fonction de catégorisation que pour les poules
    const categories = categorizeParticipants(participants, tournamentConfig);
    console.log("Catégories générées:", categories);

    setGroupedParticipants(categories);

    // Initialiser les rankings
    const rankings = {};
    Object.values(categories).forEach((categoryParticipants) => {
      categoryParticipants.forEach((participant) => {
        rankings[participant.id] = 1;
      });
    });
    setParticipantRankings(rankings);
  }, [participants, tournamentConfig]);

  // Calculer la taille optimale (puissance de 2)
  const getOptimalBracketSize = (count) => {
    if (count <= 2) return 2;
    if (count <= 4) return 4;
    if (count <= 8) return 8;
    if (count <= 16) return 16;
    if (count <= 32) return 32;
    return 64;
  };

  // Attribution des aires : équilibrer les combats par aire (pas juste les catégories)
  const getAreaAssignments = () => {
    const numAreas =
      tournamentConfig.numAreas || tournamentConfig.numberOfAreas || 1;
    const categories = Object.keys(groupedParticipants);

    console.log(
      `\n🎯 CALCUL DE LA RÉPARTITION ÉQUILIBRÉE POUR ${numAreas} AIRES`
    );

    // Calculer le nombre de combats par catégorie
    const categoriesWithCombats = categories.map((category, index) => {
      const participants = groupedParticipants[category];
      const participantCount = participants?.length || 0;
      const bracketSize = getOptimalBracketSize(participantCount);
      const totalMatches = bracketSize - 1; // Dans un bracket d'élimination, on a toujours n-1 matchs

      return {
        category,
        index,
        participantCount,
        bracketSize,
        totalMatches,
      };
    });

    // Trier par nombre de combats décroissant pour mieux équilibrer
    categoriesWithCombats.sort((a, b) => b.totalMatches - a.totalMatches);

    console.log("Catégories triées par nombre de combats:");
    categoriesWithCombats.forEach((cat) => {
      console.log(
        `  ${cat.category}: ${cat.participantCount} participants → ${cat.totalMatches} combats`
      );
    });

    // Initialiser les aires avec un compteur de combats
    const areas = Array.from({ length: numAreas }, (_, i) => ({
      areaNumber: i + 1,
      categories: [],
      totalCombats: 0,
    }));

    // Assigner chaque catégorie à l'aire qui a le moins de combats
    categoriesWithCombats.forEach((categoryInfo) => {
      // Trouver l'aire avec le moins de combats
      const targetArea = areas.reduce((min, area) =>
        area.totalCombats < min.totalCombats ? area : min
      );

      // Assigner la catégorie à cette aire
      targetArea.categories.push(categoryInfo);
      targetArea.totalCombats += categoryInfo.totalMatches;

      console.log(
        `📍 ${categoryInfo.category} (${categoryInfo.totalMatches} combats) → Aire ${targetArea.areaNumber} (total: ${targetArea.totalCombats})`
      );
    });

    // Afficher le résumé final
    console.log("\n📊 RÉPARTITION FINALE:");
    areas.forEach((area) => {
      console.log(
        `Aire ${area.areaNumber}: ${area.totalCombats} combats (${area.categories.length} catégories)`
      );
    });

    // Créer un map pour retrouver rapidement l'aire d'une catégorie
    const categoryToAreaMap = {};
    areas.forEach((area) => {
      area.categories.forEach((categoryInfo) => {
        categoryToAreaMap[categoryInfo.category] = area.areaNumber;
      });
    });

    return { areas, categoryToAreaMap };
  };

  // Attribution d'une aire pour une catégorie spécifique (utilise la répartition équilibrée)
  const getAreaForCategory = (categoryIndex) => {
    // Si on n'a pas encore calculé la répartition, utiliser l'ancienne méthode en fallback
    if (!window.tournamentAreaAssignments) {
      const numAreas =
        tournamentConfig.numAreas || tournamentConfig.numberOfAreas || 1;
      const areaNumber = (categoryIndex % numAreas) + 1;
      console.log(
        `⚠️ Fallback - Catégorie ${categoryIndex} → Aire ${areaNumber}`
      );
      return areaNumber;
    }

    const categories = Object.keys(groupedParticipants);
    const category = categories[categoryIndex];
    const assignedArea =
      window.tournamentAreaAssignments.categoryToAreaMap[category];

    if (assignedArea) {
      return assignedArea;
    } else {
      // Fallback si la catégorie n'est pas trouvée
      const numAreas =
        tournamentConfig.numAreas || tournamentConfig.numberOfAreas || 1;
      return (categoryIndex % numAreas) + 1;
    }
  };

  // Calculer le numéro de combat selon la logique taekwondo (aire * 100 + séquentiel)
  const calculateMatchNumber = (areaNumber, sequentialNumber) => {
    return areaNumber * 100 + sequentialNumber;
  };

  // Générer l'ordre de seeding classique pour un bracket équilibré
  const generateSeedOrder = (bracketSize) => {
    if (bracketSize === 2) return [1, 2];
    if (bracketSize === 4) return [1, 4, 2, 3];
    if (bracketSize === 8) return [1, 8, 4, 5, 2, 7, 3, 6];
    if (bracketSize === 16)
      return [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
    if (bracketSize === 32)
      return [
        1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15,
        18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22,
      ];

    // Pour des tailles plus grandes, générer algorithmiquement
    const seeds = [1];
    let currentSize = 1;

    while (currentSize < bracketSize) {
      const newSeeds = [];
      for (let i = 0; i < seeds.length; i++) {
        newSeeds.push(seeds[i]);
        newSeeds.push(currentSize * 2 + 1 - seeds[i]);
      }
      seeds.splice(0, seeds.length, ...newSeeds);
      currentSize *= 2;
    }

    return seeds.slice(0, bracketSize);
  };

  // Générer les brackets initiaux avec répartition équilibrée des byes
  const generateInitialBracket = (
    categoryParticipants,
    category,
    groupId,
    poolId,
    categoryIndex
  ) => {
    const sortedParticipants = [...categoryParticipants].sort((a, b) => {
      return (
        (participantRankings[a.id] || 1) - (participantRankings[b.id] || 1)
      );
    });

    const bracketSize = getOptimalBracketSize(sortedParticipants.length);
    const rounds = Math.log2(bracketSize);
    const participantCount = sortedParticipants.length;
    const byesNeeded = bracketSize - participantCount;

    console.log(
      `Catégorie ${category}: ${participantCount} participants, ${byesNeeded} byes nécessaires, taille bracket: ${bracketSize}`
    );

    // Créer les participants avec seeding correct (répartition équilibrée des byes)
    const seededParticipants = new Array(bracketSize);
    const seedOrder = generateSeedOrder(bracketSize);

    // Placer les participants selon l'ordre de seeding
    for (let i = 0; i < sortedParticipants.length; i++) {
      seededParticipants[seedOrder[i] - 1] = sortedParticipants[i];
    }

    // Créer tous les matchs pour tous les tours
    const allMatches = [];

    // Commencer par le premier tour
    const firstRoundMatches = [];
    for (let i = 0; i < bracketSize; i += 2) {
      const player1 = seededParticipants[i];
      const player2 = seededParticipants[i + 1];

      const matchIndexInRound = Math.floor(i / 2);
      const areaNumber = getAreaForCategory(categoryIndex);

      const match = {
        id: `${category}-r1-m${matchIndexInRound}`,
        name: `Combat`, // Le numéro sera ajouté plus tard globalement
        categoryIndex: categoryIndex,
        areaNumber: areaNumber,
        groupId: groupId,
        poolId: poolId,
        poolIndex: 0,
        tournamentRoundText: "1er Tour",
        startTime: new Date().toISOString(),
        state: "PENDING",
        status: "pending",
        round: 1,
        matchIndex: matchIndexInRound,
        participants: [
          player1
            ? {
                id: player1.id,
                name: `${player1.prenom} ${player1.nom}`,
                prenom: player1.prenom,
                nom: player1.nom,
                club: player1.club || player1.clubName,
                position: "A", // Position bleue
                isWinner: false,
                resultText: "",
              }
            : {
                id: "bye",
                name: "BYE",
                position: "A",
                isWinner: false,
                resultText: "BYE",
                isBye: true,
              },
          player2
            ? {
                id: player2.id,
                name: `${player2.prenom} ${player2.nom}`,
                prenom: player2.prenom,
                nom: player2.nom,
                club: player2.club || player2.clubName,
                position: "B", // Position rouge
                isWinner: false,
                resultText: "",
              }
            : {
                id: "bye",
                name: "BYE",
                position: "B",
                isWinner: false,
                resultText: "BYE",
                isBye: true,
              },
        ],
        nextMatchId: null, // sera défini plus tard
      };

      firstRoundMatches.push(match);
      allMatches.push(match);
    }

    // Créer les tours suivants
    let currentRoundMatches = firstRoundMatches;
    for (let round = 2; round <= rounds; round++) {
      const nextRoundMatches = [];

      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        const match1 = currentRoundMatches[i];
        const match2 = currentRoundMatches[i + 1];

        const matchIndexInRound = Math.floor(i / 2);
        const areaNumber = getAreaForCategory(categoryIndex);

        const nextMatch = {
          id: `${category}-r${round}-m${matchIndexInRound}`,
          name: round === rounds ? `Finale` : `Combat`, // Le numéro sera ajouté plus tard globalement
          categoryIndex: categoryIndex,
          areaNumber: areaNumber,
          groupId: groupId,
          poolId: poolId,
          poolIndex: 0,
          tournamentRoundText: round === rounds ? "Finale" : `Tour ${round}`,
          startTime: new Date().toISOString(),
          state: "PENDING",
          status: "pending",
          round: round,
          matchIndex: matchIndexInRound,
          participants: [
            {
              id: null,
              name: "À déterminer",
              position: "A",
              isWinner: false,
              resultText: "",
            },
            {
              id: null,
              name: "À déterminer",
              position: "B",
              isWinner: false,
              resultText: "",
            },
          ],
          nextMatchId: null,
          previousMatches: [match1?.id, match2?.id].filter(Boolean),
        };

        // Lier les matchs précédents au match suivant
        if (match1) match1.nextMatchId = nextMatch.id;
        if (match2) match2.nextMatchId = nextMatch.id;

        nextRoundMatches.push(nextMatch);
        allMatches.push(nextMatch);
      }

      currentRoundMatches = nextRoundMatches;
    }

    // CORRECTION: Ne pas traiter automatiquement les BYEs
    // Tous les matchs doivent rester en statut "en attente" pour permettre la gestion manuelle
    // Les BYEs seront traités lors de la saisie des scores
    console.log(
      "ℹ️ BYEs non traités automatiquement - tous les matchs restent en statut 'en attente'"
    );

    // Ancienne logique (commentée) :
    // firstRoundMatches.forEach((match) => {
    //   if (match.participants[0]?.isBye && !match.participants[1]?.isBye) {
    //     match.participants[1].isWinner = true;
    //     match.participants[1].resultText = "Qualifié (BYE)";
    //     match.state = "DONE";
    //     match.status = "completed";
    //     advanceWinner(match, allMatches);
    //   } else if (match.participants[1]?.isBye && !match.participants[0]?.isBye) {
    //     match.participants[0].isWinner = true;
    //     match.participants[0].resultText = "Qualifié (BYE)";
    //     match.state = "DONE";
    //     match.status = "completed";
    //     advanceWinner(match, allMatches);
    //   }
    // });

    return allMatches;
  };

  // Faire avancer le gagnant au tour suivant en conservant la position correcte
  const advanceWinner = (completedMatch, allMatches) => {
    if (!completedMatch.nextMatchId) return;

    const winner = completedMatch.participants.find((p) => p && p.isWinner);
    if (!winner || winner.isBye) return;

    const nextMatch = allMatches.find(
      (m) => m.id === completedMatch.nextMatchId
    );
    if (!nextMatch) return;

    // Déterminer la position dans le match suivant
    const previousMatches = nextMatch.previousMatches || [];
    const matchPosition = previousMatches.indexOf(completedMatch.id);

    // Positionner le gagnant:
    // - Premier match précédent -> position A (bleu)
    // - Deuxième match précédent -> position B (rouge)
    const targetPosition = matchPosition === 0 ? 0 : 1;
    const positionLetter = targetPosition === 0 ? "A" : "B";

    // Mettre à jour le participant dans le match suivant
    nextMatch.participants[targetPosition] = {
      ...winner,
      position: positionLetter,
      isWinner: false,
      resultText: "",
    };

    console.log(
      `Gagnant ${
        winner.name || `${winner.prenom} ${winner.nom}`
      } avancé au match ${nextMatch.matchNumber} en position ${positionLetter}`
    );

    // Vérifier si le match suivant peut maintenant commencer (2 participants réels)
    const realParticipants = nextMatch.participants.filter(
      (p) =>
        p &&
        p.id &&
        !p.isBye &&
        p.id !== null &&
        p.id !== "bye" &&
        p.name !== "À déterminer"
    );

    if (realParticipants.length === 2) {
      console.log(
        `Match ${nextMatch.matchNumber} est maintenant prêt avec 2 participants, création en BDD...`
      );
      nextMatch.state = "PENDING";

      // Créer le match suivant en base de données
      createNextMatchInDatabase(nextMatch);
    }

    // Mettre à jour l'affichage des brackets
    setEliminationMatches([...eliminationMatches]);

    // Mettre à jour les brackets pour l'affichage
    const newBrackets = { ...brackets };
    Object.keys(newBrackets).forEach((category) => {
      newBrackets[category] = newBrackets[category].map((categoryMatch) => {
        if (categoryMatch.id === nextMatch.id) {
          return nextMatch;
        }
        if (categoryMatch.id === completedMatch.id) {
          return completedMatch;
        }
        return categoryMatch;
      });
    });
    setBrackets(newBrackets);
  };

  // Générer tous les brackets
  const generateBrackets = async () => {
    try {
      console.log("🔥🔥🔥 DÉBUT DE generateBrackets - NOUVELLE VERSION 🔥🔥🔥");

      // ÉTAPE 1: Calculer la répartition équilibrée des aires
      console.log("=== ÉTAPE 1: CALCUL DE LA RÉPARTITION ÉQUILIBRÉE ===");
      const areaAssignments = getAreaAssignments();
      window.tournamentAreaAssignments = areaAssignments; // Stocker globalement pour getAreaForCategory

      const newBrackets = {};
      const allMatchesFromAllCategories = [];
      let savedGroupsList = [];

      // Attendre que les groupes soient disponibles
      // if (!savedGroupsList || savedGroupsList.length === 0) {
      //   console.log("❌ Aucun groupe sauvegardé trouvé. Arrêt.");
      //   return;
      // }

      // D'abord, vérifier si les groupes existent déjà (créés dans TournamentSetup)
      console.log("Vérification des groupes existants...");
      const existingGroupsResult = await checkExistingGroupsAndPools(
        competitionId
      );

      if (
        existingGroupsResult.exists &&
        existingGroupsResult.groups?.length > 0
      ) {
        console.log(
          `✅ Utilisation des ${existingGroupsResult.groups.length} groupes existants créés par TournamentSetup`
        );
        savedGroupsList = existingGroupsResult.groups;

        // Log pour vérifier le format des groupes existants
        if (savedGroupsList.length > 0) {
          console.log("Format du premier groupe existant:", {
            id: savedGroupsList[0].id,
            gender: savedGroupsList[0].gender,
            ageCategory:
              savedGroupsList[0].ageCategory ||
              savedGroupsList[0].ageCategoryName,
            weightCategory:
              savedGroupsList[0].weightCategory ||
              savedGroupsList[0].weightCategoryName,
            participantsCount: savedGroupsList[0].participants?.length || 0,
            poolsCount: savedGroupsList[0].pools?.length || 0,
            type: savedGroupsList[0].type,
          });

          // Log des participants dans le premier groupe pour vérifier la structure
          if (
            savedGroupsList[0].participants &&
            savedGroupsList[0].participants.length > 0
          ) {
            console.log(
              "Échantillon de participants du premier groupe:",
              savedGroupsList[0].participants.slice(0, 2).map((p) => ({
                id: p.participant?.id || p.id,
                nom: p.participant?.nom || p.nom,
                prenom: p.participant?.prenom || p.prenom,
                format: p.participant ? "relation" : "direct",
              }))
            );
          }
        }

        console.log(
          "✅ Les groupes et leurs pools/participantGroup ont déjà été créés par TournamentSetup, pas besoin de les recréer"
        );
      } else {
        console.log(
          "Aucun groupe existant trouvé, création de nouveaux groupes..."
        );

        // Créer les groupes pour obtenir les IDs (fallback uniquement)
        const categoryKeys = Object.keys(groupedParticipants);
        const groupsToSave = categoryKeys.map((category, index) => {
          const categoryParticipants = groupedParticipants[category];
          const [gender, ageCategory, weightCategory] = category.split("-");

          const ageCatObj = tournamentConfig.ageCategories?.find(
            (cat) => cat.name === ageCategory
          );
          const weightCatObj = tournamentConfig.weightCategories?.[
            gender
          ]?.find((cat) => cat.name === weightCategory);

          return {
            id: index + 1,
            nom: `Groupe ${category}`,
            name: `${
              gender === "male" ? "Hommes" : "Femmes"
            } ${ageCategory} ${weightCategory}`,
            gender: gender,
            ageCategory: ageCatObj,
            weightCategory: weightCatObj,
            participants: categoryParticipants || [],
            pools: [], // Pas de poules en élimination directe
            type: "elimination",
            categoryIndex: index, // Ajouter l'index de catégorie
          };
        });

        // Sauvegarder les groupes d'abord pour obtenir les IDs
        console.log("Sauvegarde des groupes...");
        const savedGroupsResult = await saveGroupsAndPools(
          competitionId,
          groupsToSave
        );
        savedGroupsList = savedGroupsResult.savedGroups || [];
      }

      setSavedGroups(savedGroupsList);

      // Créer les pools d'élimination en base de données
      console.log("Création/Vérification des pools d'élimination...");
      for (const group of savedGroupsList) {
        try {
          // D'abord, vérifier si des pools d'élimination existent déjà pour ce groupe
          console.log(
            `Vérification des pools existantes pour le groupe ${group.id}...`
          );

          const existingPoolsResponse = await fetch(
            `${API_URL}/group/${group.id}/pools`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          let eliminationPool = null;

          if (existingPoolsResponse.ok) {
            const existingPools = await existingPoolsResponse.json();
            // Chercher une pool avec poolIndex = 0 (réservé pour l'élimination)
            eliminationPool = existingPools.find(
              (pool) => pool.poolIndex === 0
            );

            if (eliminationPool) {
              console.log(
                `✅ Pool d'élimination existante trouvée: ${eliminationPool.id} pour le groupe ${group.id}`
              );
              group.eliminationPoolId = eliminationPool.id;
            }
          }

          // Si aucune pool d'élimination n'existe, la créer
          if (!eliminationPool) {
            console.log(
              `Création d'une nouvelle pool d'élimination pour le groupe ${group.id}...`
            );

            const poolResponse = await fetch(`${API_URL}/pool`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                groupId: group.id,
                poolIndex: 0, // Toujours 0 pour l'élimination directe
                type: "elimination", // Marquer comme pool d'élimination
              }),
            });

            if (poolResponse.ok) {
              const savedPool = await poolResponse.json();
              console.log(
                `✅ Pool d'élimination créée: ${savedPool.id} pour le groupe ${group.id}`
              );
              group.eliminationPoolId = savedPool.id;
            } else {
              console.error(
                `❌ Erreur lors de la création de la pool d'élimination pour le groupe ${group.id}: ${poolResponse.status}`
              );
              const errorText = await poolResponse.text();
              console.error(`Détails de l'erreur:`, errorText);
            }
          }
        } catch (error) {
          console.error(
            `Erreur lors de la gestion de la pool d'élimination pour le groupe ${group.id}:`,
            error
          );
        }
      }

      // Mapper les catégories aux groupes sauvegardés
      const categoryKeys = Object.keys(groupedParticipants);

      // DEBUG: Afficher les formats pour comprendre le problème
      console.log("=== DEBUG CORRESPONDANCE CATÉGORIES ===");
      console.log("Catégories générées:", categoryKeys);
      console.log(
        "Groupes existants format:",
        savedGroupsList.map((group) => ({
          id: group.id,
          gender: group.gender,
          ageCategory: group.ageCategory?.name || group.ageCategoryName,
          weightCategory:
            group.weightCategory?.name || group.weightCategoryName,
          reconstructed: `${group.gender}-${
            group.ageCategory?.name || group.ageCategoryName
          }-${group.weightCategory?.name || group.weightCategoryName}`,
          participantsCount: group.participants?.length || 0,
          sampleParticipantId:
            group.participants?.[0]?.id ||
            group.participants?.[0]?.participant?.id ||
            "N/A",
        }))
      );

      // NOUVELLE APPROCHE: Récupérer les vrais participants depuis l'API avant de créer les matchs
      console.log("=== RÉCUPÉRATION DES VRAIS PARTICIPANTS DEPUIS L'API ===");
      let realParticipantsFromApi = [];
      try {
        const participantsResponse = await fetch(
          `${API_URL}/competition/${competitionId}/participants`
        );
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          realParticipantsFromApi = participantsData || [];
          console.log(
            `${realParticipantsFromApi.length} participants récupérés depuis l'API`
          );
          console.log(
            "Échantillon des IDs API:",
            realParticipantsFromApi.slice(0, 3).map((p) => ({
              id: p.id,
              nom: p.nom,
              prenom: p.prenom,
            }))
          );
        } else {
          console.warn(
            "Impossible de récupérer les participants depuis l'API (erreur 404 - endpoint inexistant)"
          );
        }
      } catch (error) {
        console.warn(
          "Erreur lors de la récupération des participants depuis l'API:",
          error
        );
      }

      // CORRECTION: Extraire les participants valides depuis les groupes existants
      console.log(
        "=== EXTRACTION DES PARTICIPANTS VALIDES DEPUIS LES GROUPES ==="
      );
      const validParticipantsMap = new Map(); // nom-prenom -> participant avec vrai ID

      // DEBUG: Vérifier la structure des groupes sauvegardés
      console.log("=== DEBUG STRUCTURE DES GROUPES SAUVEGARDÉS ===");
      console.log(`Nombre de groupes sauvegardés: ${savedGroupsList.length}`);
      savedGroupsList.forEach((group, index) => {
        console.log(`\nGroupe ${index + 1}:`, {
          id: group.id,
          nom: group.nom || group.name,
          participants: group.participants ? group.participants.length : 0,
          participantsStructure: group.participants
            ? group.participants.slice(0, 1).map((p) => ({
                hasParticipant: !!p.participant,
                participantId: p.participant?.id,
                directId: p.id,
                participantNom: p.participant?.nom || p.nom,
                participantPrenom: p.participant?.prenom || p.prenom,
              }))
            : "Aucun",
        });
      });

      // Parcourir tous les groupes pour extraire les participants avec les vrais IDs
      savedGroupsList.forEach((group, index) => {
        console.log(
          `\n=== EXTRACTION GROUPE ${index + 1} (ID: ${group.id}) ===`
        );
        if (group.participants && Array.isArray(group.participants)) {
          console.log(
            `${group.participants.length} participants dans ce groupe`
          );
          group.participants.forEach((p, pIndex) => {
            console.log(`\nParticipant ${pIndex + 1}:`, p);

            // Essayer différents formats de participants
            let participant = null;

            if (
              p.participant &&
              p.participant.id &&
              p.participant.nom &&
              p.participant.prenom
            ) {
              // Format: { participant: { id, nom, prenom } }
              participant = p.participant;
              console.log(
                `  -> Format relation: ${participant.prenom} ${participant.nom} (ID: ${participant.id})`
              );
            } else if (p.id && p.nom && p.prenom) {
              // Format direct: { id, nom, prenom }
              participant = p;
              console.log(
                `  -> Format direct: ${participant.prenom} ${participant.nom} (ID: ${participant.id})`
              );
            } else {
              console.log(`  -> Format non reconnu ou incomplet:`, p);
              return;
            }

            if (participant) {
              const key = `${participant.nom}-${participant.prenom}`;
              validParticipantsMap.set(key, participant);
              console.log(
                `  -> Ajouté à validParticipantsMap: "${key}" -> ID ${participant.id}`
              );
            }
          });
        } else {
          console.log("Pas de participants dans ce groupe ou format invalide");
        }
      });

      console.log(`\n=== RÉSUMÉ EXTRACTION ===`);
      console.log(
        `Total participants valides extraits: ${validParticipantsMap.size}`
      );

      // Afficher tous les participants dans la map pour debug
      if (validParticipantsMap.size > 0) {
        console.log("Contenu de validParticipantsMap:");
        Array.from(validParticipantsMap.entries()).forEach(
          ([key, participant], index) => {
            console.log(`  ${index + 1}. "${key}" -> ID: ${participant.id}`);
          }
        );
      } else {
        console.warn(
          "❌ validParticipantsMap est VIDE ! Aucun participant ne pourra être validé."
        );
      }

      // Fonction pour trouver un participant valide par nom et prénom
      const findValidParticipant = (searchParticipant) => {
        if (
          !searchParticipant ||
          !searchParticipant.nom ||
          !searchParticipant.prenom
        ) {
          return null;
        }
        const key = `${searchParticipant.nom}-${searchParticipant.prenom}`;
        return validParticipantsMap.get(key) || null;
      };

      // Générer les brackets avec les IDs de groupes corrects
      console.log(
        `\n🎯 DÉBUT GÉNÉRATION BRACKETS POUR ${categoryKeys.length} CATÉGORIES`
      );
      console.log(`Catégories à traiter:`, categoryKeys);

      categoryKeys.forEach((category, index) => {
        console.log(
          `\n🎯 TRAITEMENT CATÉGORIE ${index + 1}/${
            categoryKeys.length
          }: ${category}`
        );

        const categoryParticipants = groupedParticipants[category];
        console.log(
          `Participants dans cette catégorie:`,
          categoryParticipants?.length || 0
        );

        // Inclure aussi les catégories avec un seul participant (BYE en finale)
        if (categoryParticipants && categoryParticipants.length >= 1) {
          console.log(
            `✅ Catégorie ${category} a ${categoryParticipants.length} participants, traitement...`
          );
          // Trouver le groupe correspondant à cette catégorie
          let correspondingGroup = null;

          // Parsing correct pour gérer les tirets dans les catégories de poids
          const parts = category.split("-");
          const gender = parts[0]; // "female" ou "male"
          const ageCategory = parts[1]; // "Minime"
          // Pour weightCategory, rejoindre tout ce qui reste après les 2 premiers éléments
          const weightCategory = parts.slice(2).join("-"); // "-41kg" (avec le tiret)

          console.log(`Recherche correspondance pour: ${category}`);
          console.log(`  - gender: "${gender}"`);
          console.log(`  - ageCategory: "${ageCategory}"`);
          console.log(`  - weightCategory: "${weightCategory}"`);

          // DEBUG: Afficher TOUS les groupes sauvegardés pour cette recherche spécifique
          console.log(`\n=== DEBUG: TOUS LES GROUPES DISPONIBLES ===`);
          savedGroupsList.forEach((group, idx) => {
            const groupGender = group.gender;
            const groupAgeCategory =
              group.ageCategory?.name || group.ageCategoryName;
            let groupWeightCategory =
              group.weightCategory?.name || group.weightCategoryName;

            console.log(`Groupe ${idx + 1} (ID: ${group.id}):`);
            console.log(`  - gender: "${groupGender}"`);
            console.log(`  - ageCategory: "${groupAgeCategory}"`);
            console.log(`  - weightCategory: "${groupWeightCategory}"`);
            console.log(
              `  - reconstructed: "${groupGender}-${groupAgeCategory}-${groupWeightCategory}"`
            );
            console.log(`  - vs recherché: "${category}"`);
            console.log(
              `  - match complet: ${
                groupGender === gender &&
                groupAgeCategory === ageCategory &&
                groupWeightCategory === weightCategory
              }`
            );
          });

          correspondingGroup = savedGroupsList.find((group) => {
            const groupGender = group.gender;
            const groupAgeCategory =
              group.ageCategory?.name || group.ageCategoryName;
            let groupWeightCategory =
              group.weightCategory?.name || group.weightCategoryName;

            // CORRECTION AMÉLIORÉE: Normaliser les catégories de poids pour la correspondance
            // Gérer toutes les variations possibles
            let normalizedWeightCategory = weightCategory;
            let normalizedGroupWeightCategory = groupWeightCategory;

            // Fonction de normalisation pour enlever les tirets en début et uniformiser
            const normalizeWeight = (weight) => {
              if (!weight) return "";
              // Enlever tous les tirets en début
              let normalized = weight.replace(/^-+/, "");
              // Ajouter un seul tiret si pas présent
              if (!normalized.startsWith("-")) {
                normalized = "-" + normalized;
              }
              return normalized;
            };

            normalizedWeightCategory = normalizeWeight(
              normalizedWeightCategory
            );
            normalizedGroupWeightCategory = normalizeWeight(
              normalizedGroupWeightCategory
            );

            console.log(`  Comparaison avec groupe ${group.id}:`);
            console.log(
              `    - groupGender: "${groupGender}" (match: ${
                groupGender === gender
              })`
            );
            console.log(
              `    - groupAgeCategory: "${groupAgeCategory}" (match: ${
                groupAgeCategory === ageCategory
              })`
            );
            console.log(
              `    - groupWeightCategory: "${groupWeightCategory}" normalisé: "${normalizedGroupWeightCategory}"`
            );
            console.log(
              `    - categoryWeightCategory: "${weightCategory}" normalisé: "${normalizedWeightCategory}"`
            );
            console.log(
              `    - weightCategory match: ${
                normalizedGroupWeightCategory === normalizedWeightCategory
              }`
            );

            const isMatch =
              groupGender === gender &&
              groupAgeCategory === ageCategory &&
              normalizedGroupWeightCategory === normalizedWeightCategory;

            console.log(`    - MATCH FINAL: ${isMatch}`);

            return isMatch;
          });

          // CAS SPÉCIAL: Si toujours pas de correspondance trouvée, essayer une approche alternative
          if (!correspondingGroup && category === "male-Benjamin--24kg") {
            console.log(
              "🔍 CAS SPÉCIAL POUR male-Benjamin--24kg: Recherche alternative..."
            );

            // Essayer différentes variations pour -24kg
            const alternativeWeightFormats = [
              "-24kg",
              "--24kg",
              "24kg",
              "-24",
              "--24",
            ];

            for (const altWeight of alternativeWeightFormats) {
              console.log(`   Essai avec weightCategory: "${altWeight}"`);

              correspondingGroup = savedGroupsList.find((group) => {
                const groupGender = group.gender;
                const groupAgeCategory =
                  group.ageCategory?.name || group.ageCategoryName;
                const groupWeightCategory =
                  group.weightCategory?.name || group.weightCategoryName;

                console.log(
                  `     Test: ${groupGender} === ${gender} && ${groupAgeCategory} === ${ageCategory} && ${groupWeightCategory} === ${altWeight}`
                );

                return (
                  groupGender === gender &&
                  groupAgeCategory === ageCategory &&
                  groupWeightCategory === altWeight
                );
              });

              if (correspondingGroup) {
                console.log(
                  `✅ CORRESPONDANCE TROUVÉE avec format alternatif: "${altWeight}"`
                );
                break;
              }
            }
          }

          if (!correspondingGroup) {
            console.warn(
              `Aucun groupe correspondant trouvé pour la catégorie ${category}`
            );

            // SOLUTION DE FALLBACK: Créer automatiquement le groupe manquant
            console.log(
              `🔧 CRÉATION AUTOMATIQUE DU GROUPE MANQUANT POUR ${category}`
            );

            // Extraire les informations de la catégorie
            const parts = category.split("-");
            const gender = parts[0];
            const ageCategory = parts[1];
            const weightCategory = parts.slice(2).join("-");

            // Trouver les objets de configuration correspondants
            const ageCatObj = tournamentConfig.ageCategories?.find(
              (cat) => cat.name === ageCategory
            );
            const weightCatObj = tournamentConfig.weightCategories?.[
              gender
            ]?.find((cat) => cat.name === weightCategory);

            console.log(`Création du groupe avec:`);
            console.log(`  - gender: ${gender}`);
            console.log(
              `  - ageCategory: ${ageCategory} (obj: ${ageCatObj?.name})`
            );
            console.log(
              `  - weightCategory: ${weightCategory} (obj: ${weightCatObj?.name})`
            );
            console.log(`  - participants: ${categoryParticipants.length}`);

            // Créer un groupe temporaire (sera sauvegardé plus tard)
            const tempGroupId = Date.now() + index; // ID temporaire unique
            const tempPoolId = `temp-pool-${tempGroupId}`;

            correspondingGroup = {
              id: tempGroupId,
              nom: `Groupe ${category}`,
              name: `${
                gender === "male" ? "Hommes" : "Femmes"
              } ${ageCategory} ${weightCategory}`,
              gender: gender,
              ageCategory: ageCatObj || { name: ageCategory },
              weightCategory: weightCatObj || { name: weightCategory },
              participants: categoryParticipants.map((p) => ({
                participant: p,
              })), // Format attendu
              pools: [],
              type: "elimination",
              categoryIndex: index,
              eliminationPoolId: tempPoolId,
              isTemporary: true, // Marquer comme temporaire pour sauvegarde ultérieure
              needsSaving: true, // Flag pour indiquer qu'il faut sauvegarder ce groupe
            };

            console.log(`✅ Groupe temporaire créé avec ID: ${tempGroupId}`);
            console.log(
              `   Participants dans le groupe temporaire: ${correspondingGroup.participants.length}`
            );

            // Ajouter le groupe temporaire à savedGroupsList pour les autres catégories
            savedGroupsList.push(correspondingGroup);
          }

          // CORRECTION: Utiliser les participants des groupes existants avec fallback intelligent
          let realParticipants = [];

          console.log(`=== DEBUG PARTICIPANTS POUR ${category} ===`);
          console.log(`Groupe correspondant:`, correspondingGroup.id);
          console.log(
            `Participants du groupe (${
              correspondingGroup.participants?.length || 0
            }):`,
            correspondingGroup.participants
          );

          if (
            correspondingGroup.participants &&
            Array.isArray(correspondingGroup.participants) &&
            correspondingGroup.participants.length > 0
          ) {
            // Les participants des groupes en BDD suivent le format: { participant: { id, nom, prenom, ... } }
            realParticipants = correspondingGroup.participants
              .map((p, idx) => {
                console.log(`Participant ${idx}:`, p);

                let candidateParticipant = null;

                // Format principal: { participant: { id, nom, prenom } }
                if (
                  p.participant &&
                  p.participant.id &&
                  p.participant.nom &&
                  p.participant.prenom
                ) {
                  console.log(
                    `  -> Participant via relation: ${p.participant.prenom} ${p.participant.nom} (${p.participant.id})`
                  );
                  candidateParticipant = p.participant;
                }
                // Si c'est déjà un participant direct (cas rare)
                else if (p.id && p.nom && p.prenom) {
                  console.log(
                    `  -> Participant direct: ${p.prenom} ${p.nom} (${p.id})`
                  );
                  candidateParticipant = p;
                }
                // Si c'est juste un ID, essayer de trouver le participant dans groupedParticipants comme fallback
                else if (
                  typeof p === "string" ||
                  (p.participantId && !p.participant)
                ) {
                  const participantId =
                    typeof p === "string" ? p : p.participantId;
                  const fallbackParticipant = categoryParticipants.find(
                    (cp) => cp.id === participantId
                  );
                  if (fallbackParticipant) {
                    console.log(
                      `  -> Participant trouvé via fallback: ${fallbackParticipant.prenom} ${fallbackParticipant.nom} (${fallbackParticipant.id})`
                    );
                    candidateParticipant = fallbackParticipant;
                  } else {
                    console.warn(
                      `  -> Participant par ID ${participantId} non trouvé dans fallback`
                    );
                  }
                }

                // NOUVELLE VALIDATION: Vérifier que l'ID existe dans l'API et le corriger si nécessaire
                if (candidateParticipant && validParticipantsMap.size > 0) {
                  // Vérifier directement dans notre map de participants valides
                  const keyForValidation = `${candidateParticipant.nom}-${candidateParticipant.prenom}`;
                  const validParticipant =
                    validParticipantsMap.get(keyForValidation);

                  if (
                    validParticipant &&
                    validParticipant.id === candidateParticipant.id
                  ) {
                    console.log(
                      `    ✅ ID ${candidateParticipant.id} validé dans les groupes`
                    );
                    return candidateParticipant;
                  } else if (validParticipant) {
                    console.log(
                      `    ❌ ID ${candidateParticipant.id} NOT validé, mais participant trouvé dans les groupes...`
                    );
                    // Chercher le participant réel par nom et prénom
                    const realParticipant =
                      findValidParticipant(candidateParticipant);
                    if (realParticipant) {
                      console.log(
                        `    ✅ Participant trouvé dans les groupes: ${realParticipant.prenom} ${realParticipant.nom} (${realParticipant.id})`
                      );
                      console.log(
                        `    🔄 Remplacement ID: ${candidateParticipant.id} → ${realParticipant.id}`
                      );
                      return realParticipant;
                    } else {
                      console.log(
                        `    ❌ Participant ${candidateParticipant.prenom} ${candidateParticipant.nom} non trouvé dans les groupes`
                      );
                      return null;
                    }
                  } else {
                    console.log(
                      `    ❌ Participant ${candidateParticipant.prenom} ${candidateParticipant.nom} non trouvé dans les groupes`
                    );
                    return null;
                  }
                }

                if (candidateParticipant) {
                  console.log(
                    `    ⚠️  Pas de validation groupes disponible (validParticipantsMap vide), utilisation de l'ID existant`
                  );
                  return candidateParticipant;
                }

                console.log(`  -> Format non reconnu:`, p);
                return null;
              })
              .filter((p) => p && p.id && p.nom && p.prenom); // Garder seulement les participants complets
          } else {
            console.log(
              `Pas de participants dans le groupe existant, utilisation de categoryParticipants comme fallback`
            );
            // Fallback complet : utiliser les participants de groupedParticipants avec validation API
            const categoryParticipantsCandidates = categoryParticipants || [];
            realParticipants = categoryParticipantsCandidates
              .map((cp) => {
                if (validParticipantsMap.size > 0) {
                  const realParticipant = findValidParticipant(cp);
                  if (realParticipant) {
                    console.log(
                      `Fallback: ${cp.prenom} ${cp.nom} → ID groupes: ${realParticipant.id}`
                    );
                    return realParticipant;
                  } else {
                    console.log(
                      `Fallback: ${cp.prenom} ${cp.nom} non trouvé dans les groupes`
                    );
                    return null;
                  }
                }
                return cp;
              })
              .filter((p) => p);
          }

          console.log(
            `Participants finaux pour ${category}:`,
            realParticipants.length
          );
          console.log(
            `IDs des participants:`,
            realParticipants.map((p) => p.id)
          );
          console.log(
            `Noms des participants:`,
            realParticipants.map((p) => `${p.prenom} ${p.nom}`)
          );
          console.log(`=== FIN DEBUG PARTICIPANTS ===`);

          // Continuer même avec peu de participants pour permettre les tests
          const groupId = correspondingGroup.id;
          const poolId =
            correspondingGroup.eliminationPoolId || `temp-pool-${index}`;

          // Utiliser les participants trouvés (base ou fallback)
          const categoryMatches = generateInitialBracket(
            realParticipants, // Utiliser les participants trouvés
            category,
            groupId,
            poolId,
            index
          );

          // DEBUG SUPPLÉMENTAIRE: Vérifier les participants dans les matchs générés
          console.log(
            `\n=== VÉRIFICATION PARTICIPANTS DANS MATCHS GÉNÉRÉS POUR ${category} ===`
          );
          categoryMatches.forEach((match, matchIndex) => {
            if (match.participants && match.participants.length > 0) {
              console.log(
                `Match ${matchIndex + 1} (${
                  match.matchNumber || "pas de numéro"
                }):`
              );
              match.participants.forEach((p, pIndex) => {
                if (p && p.id && !p.isBye && p.id !== "bye") {
                  console.log(
                    `  Participant ${pIndex + 1}: ID=${p.id}, Nom=${
                      p.name || `${p.prenom} ${p.nom}`
                    }`
                  );

                  // Vérifier si ce participant était dans realParticipants
                  const wasInRealParticipants = realParticipants.find(
                    (rp) => rp.id === p.id
                  );
                  if (wasInRealParticipants) {
                    console.log(
                      `    ✅ Participant trouvé dans realParticipants`
                    );
                  } else {
                    console.log(
                      `    ❌ Participant NON trouvé dans realParticipants !`
                    );
                    console.log(
                      `    ❌ Ceci peut expliquer pourquoi l'ID est invalide`
                    );
                  }
                } else {
                  console.log(`  Participant ${pIndex + 1}: BYE ou vide`);
                }
              });
            }
          });
          console.log(`=== FIN VÉRIFICATION PARTICIPANTS DANS MATCHS ===\n`);

          console.log(
            `🎯 AJOUT DE ${categoryMatches.length} MATCHS POUR ${category} DANS newBrackets`
          );
          newBrackets[category] = categoryMatches;
          allMatchesFromAllCategories.push(...categoryMatches);
          console.log(
            `🎯 Total matchs accumulés: ${allMatchesFromAllCategories.length}`
          );
        } else {
          console.warn(
            `❌ Catégorie ${category} ignorée: ${
              categoryParticipants?.length || 0
            } participants (minimum 1 requis)`
          );
        }
      });

      console.log(
        `Total des matchs générés: ${allMatchesFromAllCategories.length}`
      );

      // SAUVEGARDER LES GROUPES TEMPORAIRES CRÉÉS AUTOMATIQUEMENT
      const temporaryGroups = savedGroupsList.filter(
        (group) => group.needsSaving
      );
      if (temporaryGroups.length > 0) {
        console.log(
          `\n💾 SAUVEGARDE DE ${temporaryGroups.length} GROUPES TEMPORAIRES...`
        );

        for (const tempGroup of temporaryGroups) {
          try {
            console.log(`💾 Sauvegarde du groupe ${tempGroup.nom}...`);

            const groupToSave = {
              nom: tempGroup.nom,
              name: tempGroup.name,
              gender: tempGroup.gender,
              ageCategory: tempGroup.ageCategory,
              weightCategory: tempGroup.weightCategory,
              participants: tempGroup.participants.map((p) => p.participant), // Extraire les participants
              pools: [],
              type: "elimination",
              categoryIndex: tempGroup.categoryIndex,
            };

            const saveGroupResult = await saveGroupsAndPools(competitionId, [
              groupToSave,
            ]);

            if (
              saveGroupResult.success &&
              saveGroupResult.savedGroups?.length > 0
            ) {
              const realSavedGroup = saveGroupResult.savedGroups[0];
              console.log(
                `✅ Groupe sauvegardé avec ID réel: ${realSavedGroup.id}`
              );

              // Mettre à jour l'ID temporaire par l'ID réel
              tempGroup.id = realSavedGroup.id;
              tempGroup.isTemporary = false;
              tempGroup.needsSaving = false;

              // Créer la pool d'élimination pour ce groupe
              try {
                const poolResponse = await fetch(`${API_URL}/pool`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    groupId: realSavedGroup.id,
                    poolIndex: 0,
                    type: "elimination",
                  }),
                });

                if (poolResponse.ok) {
                  const savedPool = await poolResponse.json();
                  tempGroup.eliminationPoolId = savedPool.id;
                  console.log(
                    `✅ Pool d'élimination créée avec ID: ${savedPool.id}`
                  );
                } else {
                  console.error(
                    `❌ Erreur lors de la création de la pool pour ${tempGroup.nom}`
                  );
                  // Utiliser un ID temporaire pour continuer
                  tempGroup.eliminationPoolId = `temp-pool-${tempGroup.id}`;
                }
              } catch (poolError) {
                console.error(
                  `❌ Erreur lors de la création de la pool pour ${tempGroup.nom}:`,
                  poolError
                );
                // Utiliser un ID temporaire pour continuer
                tempGroup.eliminationPoolId = `temp-pool-${tempGroup.id}`;
              }
            } else {
              console.error(
                `❌ Erreur lors de la sauvegarde du groupe ${tempGroup.nom}:`,
                saveGroupResult.errors
              );
              // Utiliser les IDs temporaires pour continuer
              console.log(
                `⚠️ Utilisation des IDs temporaires pour ${tempGroup.nom}`
              );
            }
          } catch (saveError) {
            console.error(
              `❌ Erreur lors de la sauvegarde automatique du groupe ${tempGroup.nom}:`,
              saveError
            );
            // Utiliser les IDs temporaires pour continuer
            console.log(
              `⚠️ Utilisation des IDs temporaires pour ${tempGroup.nom}`
            );
          }
        }

        console.log(`✅ Sauvegarde des groupes temporaires terminée`);
      }

      // NOUVELLE LOGIQUE: Numérotation des combats avec alternance par tour dans chaque aire
      // Organiser les matchs par aire
      const matchsByArea = {};
      allMatchesFromAllCategories.forEach((match) => {
        const areaNumber = match.areaNumber;
        if (!matchsByArea[areaNumber]) {
          matchsByArea[areaNumber] = [];
        }
        matchsByArea[areaNumber].push(match);
      });

      // Pour chaque aire, trier les matchs par tour et attribuer des numéros séquentiels
      Object.keys(matchsByArea).forEach((areaNumber) => {
        const areaMatches = matchsByArea[areaNumber];

        // Organiser par tour et par catégorie
        const matchesByRoundAndCategory = {};
        areaMatches.forEach((match) => {
          const key = `${match.round}-${match.categoryIndex}`;
          if (!matchesByRoundAndCategory[key]) {
            matchesByRoundAndCategory[key] = [];
          }
          matchesByRoundAndCategory[key].push(match);
        });

        // Obtenir les catégories de cette aire
        const categoriesInArea = [
          ...new Set(areaMatches.map((m) => m.categoryIndex)),
        ].sort();
        const maxRounds = Math.max(...areaMatches.map((m) => m.round));

        let areaMatchNumber = 1;

        // Pour chaque tour, alterner entre les catégories de cette aire
        for (let round = 1; round <= maxRounds; round++) {
          for (let catIndex of categoriesInArea) {
            const key = `${round}-${catIndex}`;
            const roundCategoryMatches = matchesByRoundAndCategory[key] || [];

            // Attribuer des numéros séquentiels à tous les matchs de cette catégorie pour ce tour
            roundCategoryMatches.forEach((match) => {
              // NOUVELLE LOGIQUE: Ne pas numéroter les matchs du premier tour avec BYE
              const hasAtLeastOneBye = match.participants.some((p) => p?.isBye);
              const isFirstRound = match.round === 1;
              const isMatchWithOnlyByes = match.participants.every(
                (p) => p?.isBye
              );

              // Conditions pour numéroter un match :
              // 1. Ce n'est pas un match avec que des BYEs
              // 2. Si c'est le premier tour avec un BYE, ne pas numéroter
              const shouldNumber =
                !isMatchWithOnlyByes && !(isFirstRound && hasAtLeastOneBye);

              if (shouldNumber) {
                match.matchNumber = calculateMatchNumber(
                  parseInt(areaNumber),
                  areaMatchNumber
                );
                match.name =
                  match.round ===
                  Math.log2(
                    getOptimalBracketSize(
                      groupedParticipants[categoryKeys[match.categoryIndex]]
                        ?.length || 0
                    )
                  )
                    ? `Finale ${match.matchNumber}`
                    : `Combat ${match.matchNumber}`;
                areaMatchNumber++;

                console.log(
                  `✅ Match numéroté: ${match.matchNumber} (Round ${match.round})`
                );
              } else {
                // Pas de numéro pour ce match
                match.matchNumber = null;
                match.name =
                  isFirstRound && hasAtLeastOneBye
                    ? "Qualification automatique"
                    : "Match non numéroté";

                console.log(
                  `⏭️ Match non numéroté: ${match.name} (Round ${match.round}, BYE: ${hasAtLeastOneBye})`
                );
              }
            });
          }
        }
      });

      console.log(
        `Numérotation terminée - Combats numérotés par aire selon le protocole taekwondo`
      );

      setBrackets(newBrackets);
      setEliminationMatches(allMatchesFromAllCategories);

      // Préparer les matchs pour la sauvegarde (format compatible avec saveGeneratedMatches)
      const matchesByPool = [];

      console.log(`\n🎯 PRÉPARATION MATCHESBYPOOL POUR SAUVEGARDE`);
      console.log(`Nombre de groupes sauvegardés: ${savedGroupsList.length}`);
      console.log(`Nombre de catégories générées: ${categoryKeys.length}`);
      console.log(
        `Catégories disponibles dans newBrackets:`,
        Object.keys(newBrackets)
      );

      savedGroupsList.forEach((group, index) => {
        const category = categoryKeys[index];
        console.log(
          `\n🎯 PRÉPARATION GROUPE ${index + 1}/${savedGroupsList.length}`
        );
        console.log(`  - Groupe ID: ${group.id}`);
        console.log(`  - Catégorie associée: ${category}`);
        console.log(`  - Pool d'élimination ID: ${group.eliminationPoolId}`);

        const categoryMatches = newBrackets[category] || [];
        console.log(
          `  - Matchs dans cette catégorie: ${categoryMatches.length}`
        );

        if (categoryMatches.length > 0) {
          // Utiliser l'ID de pool d'élimination réel créé en base de données
          const poolId = group.eliminationPoolId;

          if (!poolId) {
            console.error(
              `Pas d'ID de pool d'élimination pour le groupe ${group.id}`
            );
            return;
          }

          // Convertir les matchs au format attendu par saveGeneratedMatches
          const formattedMatches = categoryMatches
            .filter((match) => {
              // Ne sauvegarder que les matchs qui ont un numéro ET des participants réels
              const hasMatchNumber =
                match.matchNumber && match.matchNumber !== null;
              const hasRealParticipants = match.participants.some(
                (p) =>
                  p &&
                  p.id &&
                  !p.isBye &&
                  p.id !== null &&
                  p.id !== "bye" &&
                  p.name !== "À déterminer"
              );
              const realParticipantsCount = match.participants.filter(
                (p) =>
                  p &&
                  p.id &&
                  !p.isBye &&
                  p.id !== null &&
                  p.id !== "bye" &&
                  p.name !== "À déterminer"
              ).length;

              console.log(
                `🔍 FILTRE Match ${match.matchNumber || "SANS NUMÉRO"}:`,
                {
                  hasMatchNumber,
                  hasRealParticipants,
                  realParticipantsCount,
                  participants: match.participants.map((p) => ({
                    name: p?.name || "N/A",
                    id: p?.id || "N/A",
                    isBye: p?.isBye || false,
                  })),
                }
              );

              // CHANGEMENT: Permettre les matchs avec au moins 1 participant réel ET qui ont un numéro
              const shouldInclude =
                hasMatchNumber && realParticipantsCount >= 1;

              console.log(
                `${shouldInclude ? "✅ INCLUS" : "❌ EXCLU"} - Match ${
                  match.matchNumber || "SANS NUMÉRO"
                }`
              );

              return shouldInclude;
            })
            .map((match) => {
              // Préparer SEULEMENT les participants réels pour ce match
              const participants = [];

              console.log(
                `\n=== PRÉPARATION DU MATCH ${match.matchNumber} POUR SAUVEGARDE ===`
              );
              console.log(`Participants bruts du match:`, match.participants);

              match.participants.forEach((p, index) => {
                console.log(`\nParticipant ${index}:`, p);
                if (
                  p &&
                  p.id &&
                  !p.isBye &&
                  p.id !== null &&
                  p.id !== "bye" &&
                  p.name !== "À déterminer"
                ) {
                  // CORRECTION: Vérifier que l'ID est valide en le cherchant dans validParticipantsMap
                  const validParticipant = findValidParticipant(p);
                  let finalParticipantId = p.id;

                  if (validParticipant && validParticipant.id !== p.id) {
                    console.log(
                      `🔄 Correction ID: ${p.id} → ${validParticipant.id} pour ${p.prenom} ${p.nom}`
                    );
                    finalParticipantId = validParticipant.id;
                  } else if (!validParticipant) {
                    console.warn(
                      `⚠️ Participant ${p.prenom} ${p.nom} avec ID ${p.id} non trouvé dans les participants valides, ignoré`
                    );
                    return; // Ignorer ce participant invalide
                  }

                  // SIMPLIFICATION: Utiliser le même format que DrawGenerator (poules)
                  const participantData = {
                    id: finalParticipantId, // ← Utiliser l'ID VRAIMENT valide
                    position: p.position,
                  };
                  console.log(
                    `  -> Participant VALIDÉ pour sauvegarde (format simplifié):`,
                    participantData
                  );
                  participants.push(participantData);
                } else {
                  console.log(
                    `  -> Participant IGNORÉ (BYE, null, ou à déterminer):`,
                    p
                  );
                }
              });

              console.log(
                `Match ${match.matchNumber} préparé avec ${participants.length} participants:`
              );
              participants.forEach((p, i) => {
                console.log(
                  `  ${i + 1}. Position: ${p.position} - ID: ${p.id}`
                );
              });

              // VALIDATION FINALE: Un match doit avoir au moins 1 participant réel pour être sauvegardé
              if (participants.length === 0) {
                console.warn(
                  `⚠️ Match ${match.matchNumber} ignoré car aucun participant valide`
                );
                return null; // Sera filtré par .filter(Boolean) plus tard
              }

              console.log(
                `=== FIN PRÉPARATION MATCH ${match.matchNumber} ===\n`
              );

              return {
                number: match.matchNumber,
                poolId: poolId, // Utiliser l'ID réel de la pool d'élimination
                groupId: group.id,
                poolIndex: 0,
                areaNumber: match.areaNumber,
                startTime: match.startTime,
                participants: participants,
                // Métadonnées pour le bracket
                round: match.round,
                tournamentRoundText: match.tournamentRoundText,
                status: match.state || match.status || "PENDING",
                nextMatchId: match.nextMatchId,
                previousMatches: match.previousMatches || [],
              };
            })
            .filter(Boolean); // Supprimer les éléments null

          console.log(`\n📊 RÉSUMÉ POUR ${category}:`);
          console.log(`  - Matchs totaux générés: ${categoryMatches.length}`);
          console.log(
            `  - Matchs formatés pour sauvegarde: ${formattedMatches.length}`
          );

          if (formattedMatches.length > 0) {
            matchesByPool.push({
              poolId: poolId, // Utiliser l'ID réel de la pool d'élimination
              groupId: group.id,
              matches: formattedMatches,
            });
          } else {
            console.warn(`⚠️ Aucun match à sauvegarder pour ${category}`);
          }
        }
      });

      // Sauvegarder les matchs en base de données
      if (matchesByPool.length > 0) {
        console.log("=== SAUVEGARDE DES MATCHS D'ÉLIMINATION ===");
        console.log(`Nombre de pools à sauvegarder: ${matchesByPool.length}`);

        matchesByPool.forEach((poolItem, poolIndex) => {
          console.log(`\nPool ${poolIndex + 1} (ID: ${poolItem.poolId}):`);
          console.log(`  - Groupe ID: ${poolItem.groupId}`);
          console.log(`  - Nombre de matchs: ${poolItem.matches.length}`);

          poolItem.matches.forEach((match, matchIndex) => {
            console.log(`\n  Match ${matchIndex + 1} (${match.number}):`);
            console.log(`    - Pool ID: ${match.poolId}`);
            console.log(`    - Group ID: ${match.groupId}`);
            console.log(`    - Participants (${match.participants.length}):`);
            match.participants.forEach((p, pIndex) => {
              console.log(
                `      ${pIndex + 1}. ID: ${p.id}, Position: ${
                  p.position
                }, Nom: ${p.name}`
              );
            });
          });
        });

        console.log("\n=== APPEL À saveGeneratedMatches ===");
        const saveResult = await saveGeneratedMatches(
          competitionId,
          matchesByPool
        );
        console.log("Résultat de la sauvegarde:", saveResult);

        if (saveResult.success) {
          console.log("✅ Matchs d'élimination sauvegardés avec succès");
        } else {
          console.error("❌ Erreurs lors de la sauvegarde:", saveResult.errors);
        }
      } else {
        console.error("❌ AUCUN MATCH À SAUVEGARDER !");
        console.error(
          "matchesByPool est vide - vérifier la génération des brackets"
        );
        console.error("Catégories générées:", Object.keys(newBrackets));
        console.error(
          "Nombre de matchs par catégorie:",
          Object.keys(newBrackets).map((cat) => ({
            category: cat,
            matches: newBrackets[cat]?.length || 0,
          }))
        );
      }

      setCurrentStep("brackets");
      console.log("Brackets générés avec succès");
    } catch (error) {
      console.error("Erreur lors de la génération des brackets:", error);
      alert("Erreur lors de la génération des brackets: " + error.message);
    }
  };

  // Surveiller les matchs terminés et faire avancer les gagnants
  useEffect(() => {
    if (eliminationMatches.length === 0) return;

    const checkForCompletedMatches = async () => {
      try {
        console.log("Vérification des matchs terminés...");

        // CORRECTION: Utiliser l'endpoint standard pour récupérer TOUS les matchs
        // puis filtrer ceux des pools d'élimination
        try {
          const response = await fetch(
            `${API_URL}/competition/${competitionId}/matches?include=matchParticipants`
          );
          if (response.ok) {
            const allCompetitionMatches = await response.json();
            console.log(
              `${allCompetitionMatches.length} matchs récupérés de la compétition`
            );

            // Filtrer les matchs d'élimination (ceux qui appartiennent aux pools d'élimination)
            const eliminationPoolIds = savedGroups
              .map((group) => group.eliminationPoolId)
              .filter(Boolean);
            console.log("IDs des pools d'élimination:", eliminationPoolIds);

            const allDbMatches = allCompetitionMatches.filter((match) => {
              return eliminationPoolIds.includes(match.poolId);
            });

            console.log(
              `${allDbMatches.length} matchs d'élimination trouvés en BDD`
            );

            const completedDbMatches = allDbMatches.filter(
              (m) => m.status === "completed" || m.status === "DONE"
            );

            // Vérifier s'il y a de nouveaux matchs terminés
            for (const dbMatch of completedDbMatches) {
              const localMatch = eliminationMatches.find(
                (em) => em.matchNumber === dbMatch.number
              );

              if (localMatch && localMatch.state !== "DONE") {
                console.log(
                  `Match ${dbMatch.number} terminé détecté, progression du gagnant...`
                );

                // Mettre à jour le match local
                localMatch.state = "DONE";
                localMatch.status = "completed";

                // Trouver le gagnant
                const winner = dbMatch.participants?.find((p) => p.isWinner);
                if (winner && localMatch.nextMatchId) {
                  await progressWinnerToNextMatch(localMatch, winner);
                }
              }
            }
          } else {
            console.warn(
              `Erreur ${response.status} lors de la récupération des matchs de la compétition`
            );
          }
        } catch (error) {
          console.warn(
            `Erreur lors de la récupération des matchs de la compétition:`,
            error
          );
        }
      } catch (error) {
        console.error("Erreur lors de la vérification des matchs:", error);
      }
    };

    // Vérifier toutes les 3 secondes quand on est sur l'onglet brackets
    const interval = setInterval(checkForCompletedMatches, 3000);

    return () => clearInterval(interval);
  }, [eliminationMatches, savedGroups, competitionId]);

  // Faire progresser le gagnant vers le match suivant
  const progressWinnerToNextMatch = async (completedMatch, winner) => {
    try {
      console.log(
        `Progression du gagnant ${winner.participant?.prenom} ${winner.participant?.nom} du match ${completedMatch.matchNumber}`
      );

      // Trouver le match suivant
      const nextMatch = eliminationMatches.find(
        (m) => m.id === completedMatch.nextMatchId
      );
      if (!nextMatch) {
        console.log("Pas de match suivant trouvé");
        return;
      }

      // Déterminer la position dans le match suivant
      const previousMatches = nextMatch.previousMatches || [];
      const matchPosition = previousMatches.indexOf(completedMatch.id);
      const targetPosition = matchPosition === 0 ? 0 : 1;
      const positionLetter = targetPosition === 0 ? "A" : "B";

      // Mettre à jour le participant dans le match suivant
      const winnerParticipant = winner.participant || winner;
      nextMatch.participants[targetPosition] = {
        id: winnerParticipant.id,
        name: `${winnerParticipant.prenom} ${winnerParticipant.nom}`,
        prenom: winnerParticipant.prenom,
        nom: winnerParticipant.nom,
        position: positionLetter,
        isWinner: false,
        resultText: "",
      };

      console.log(
        `Gagnant ${winnerParticipant.prenom} ${winnerParticipant.nom} ajouté au match ${nextMatch.matchNumber} en position ${positionLetter}`
      );

      // Vérifier si le match suivant est maintenant prêt (2 participants réels)
      const realParticipants = nextMatch.participants.filter(
        (p) =>
          p &&
          p.id &&
          !p.isBye &&
          p.id !== null &&
          p.id !== "bye" &&
          p.name !== "À déterminer"
      );

      if (realParticipants.length === 2) {
        console.log(
          `Match ${nextMatch.matchNumber} est maintenant prêt avec 2 participants, création en BDD...`
        );
        nextMatch.state = "PENDING";

        // Créer le match suivant en base de données
        await createNextMatchInDatabase(nextMatch);
      }

      // Mettre à jour l'affichage des brackets
      setEliminationMatches([...eliminationMatches]);

      // Mettre à jour les brackets pour l'affichage
      const newBrackets = { ...brackets };
      Object.keys(newBrackets).forEach((category) => {
        newBrackets[category] = newBrackets[category].map((categoryMatch) => {
          if (categoryMatch.id === nextMatch.id) {
            return nextMatch;
          }
          if (categoryMatch.id === completedMatch.id) {
            return completedMatch;
          }
          return categoryMatch;
        });
      });
      setBrackets(newBrackets);
    } catch (error) {
      console.error("Erreur lors de la progression du gagnant:", error);
    }
  };

  // Créer le match suivant en base de données
  const createNextMatchInDatabase = async (nextMatch) => {
    try {
      console.log(`=== CRÉATION DU MATCH ${nextMatch.matchNumber} EN BDD ===`);

      // Préparer les participants pour la sauvegarde (FORMAT SIMPLIFIÉ comme les poules)
      const participants = [];
      nextMatch.participants.forEach((p) => {
        if (p && p.id && !p.isBye && p.id !== null && p.id !== "bye") {
          // CORRECTION: Vérifier l'ID et utiliser le format simplifié
          const validParticipant = findValidParticipant(p);
          let finalParticipantId = p.id;

          if (validParticipant && validParticipant.id !== p.id) {
            console.log(
              `🔄 Correction ID pour match suivant: ${p.id} → ${validParticipant.id}`
            );
            finalParticipantId = validParticipant.id;
          } else if (!validParticipant) {
            console.warn(
              `⚠️ Participant ${p.name} avec ID ${p.id} non valide pour match suivant`
            );
            return;
          }

          participants.push({
            id: finalParticipantId, // ← ID corrigé
            position: p.position,
          });
        }
      });

      console.log(
        `Participants à sauvegarder (format simplifié):`,
        participants
      );

      if (participants.length !== 2) {
        throw new Error(
          `Le match doit avoir exactement 2 participants, trouvé: ${participants.length}`
        );
      }

      // Format pour saveGeneratedMatches
      const matchToSave = {
        number: nextMatch.matchNumber,
        poolId: nextMatch.poolId,
        groupId: nextMatch.groupId,
        poolIndex: nextMatch.poolIndex || 0,
        areaNumber: nextMatch.areaNumber,
        startTime: nextMatch.startTime,
        participants: participants,
        round: nextMatch.round,
        tournamentRoundText: nextMatch.tournamentRoundText,
        status: nextMatch.state || nextMatch.status || "PENDING",
        nextMatchId: nextMatch.nextMatchId,
        previousMatches: nextMatch.previousMatches || [],
      };

      // Structure pour saveGeneratedMatches
      const matchesByPool = [
        {
          poolId: nextMatch.poolId,
          groupId: nextMatch.groupId,
          matches: [matchToSave],
        },
      ];

      // Sauvegarder le match en base de données
      console.log(`Sauvegarde du match ${nextMatch.matchNumber}...`);
      const saveResult = await saveGeneratedMatches(
        competitionId,
        matchesByPool
      );

      if (!saveResult.success) {
        throw new Error(
          `Erreur lors de la sauvegarde: ${
            saveResult.errors?.join(", ") || "Erreur inconnue"
          }`
        );
      }

      console.log(`✅ Match ${nextMatch.matchNumber} créé avec succès en BDD`);

      // Le match est créé, les matchParticipants sont automatiquement créés par saveGeneratedMatches
      console.log(
        `✅ MatchParticipants créés automatiquement par saveGeneratedMatches`
      );
    } catch (error) {
      console.error(
        `❌ Erreur lors de la création du match ${nextMatch.matchNumber}:`,
        error
      );
      throw error;
    }
  };

  // Mettre à jour le ranking d'un participant
  const updateRanking = (participantId, ranking) => {
    setParticipantRankings((prev) => ({
      ...prev,
      [participantId]: parseInt(ranking) || 1,
    }));
  };

  // Sauvegarder et passer à l'étape suivante
  const handleSave = async () => {
    setIsSaving(true);
    try {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        nextStep();
      }, 1500);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Convertir nos données de matchs au format rounds/seeds attendu par react-brackets
  const convertMatchesToRounds = (matchesData, category) => {
    if (!matchesData || !Array.isArray(matchesData)) {
      return [];
    }

    // Organiser les matchs par tour
    const roundsMap = {};
    matchesData.forEach((match) => {
      const roundText = match.tournamentRoundText || "Tour";
      if (!roundsMap[roundText]) {
        roundsMap[roundText] = [];
      }
      roundsMap[roundText].push(match);
    });

    // Convertir au format attendu par react-brackets
    const rounds = Object.entries(roundsMap).map(([title, matches]) => ({
      title,
      seeds: matches.map((match) => {
        // Déterminer si c'est une finale
        const isFinale =
          match.tournamentRoundText === "Finale" || title === "Finale";

        return {
          id: match.id,
          date: new Date().toDateString(),
          teams: [
            {
              name: (() => {
                const p = match.participants[0];
                if (p && p.id && !p.isBye && p.id !== "bye") {
                  return p.name;
                } else if (p && p.isBye) {
                  return "BYE";
                } else if (p && p.name === "À déterminer") {
                  // Afficher la dépendance vers le match précédent
                  const previousMatchIndex = 0; // Position A = premier match précédent
                  const previousMatchId =
                    match.previousMatches?.[previousMatchIndex];
                  if (previousMatchId) {
                    const previousMatch = matchesData.find(
                      (m) => m.id === previousMatchId
                    );
                    return previousMatch?.matchNumber
                      ? `Gagnant combat ${previousMatch.matchNumber}`
                      : "À déterminer";
                  }
                  return "À déterminer";
                } else {
                  return "À déterminer";
                }
              })(),
              winner: match.participants[0]?.isWinner || false,
            },
            {
              name: (() => {
                const p = match.participants[1];
                if (p && p.id && !p.isBye && p.id !== "bye") {
                  return p.name;
                } else if (p && p.isBye) {
                  return "BYE";
                } else if (p && p.name === "À déterminer") {
                  // Afficher la dépendance vers le match précédent
                  const previousMatchIndex = 1; // Position B = deuxième match précédent
                  const previousMatchId =
                    match.previousMatches?.[previousMatchIndex];
                  if (previousMatchId) {
                    const previousMatch = matchesData.find(
                      (m) => m.id === previousMatchId
                    );
                    return previousMatch?.matchNumber
                      ? `Gagnant combat ${previousMatch.matchNumber}`
                      : "À déterminer";
                  }
                  return "À déterminer";
                } else {
                  return "À déterminer";
                }
              })(),
              winner: match.participants[1]?.isWinner || false,
            },
          ],
          // Données personnalisées pour l'affichage amélioré
          matchNumber: match.matchNumber,
          areaNumber: match.areaNumber,
          status: match.state || match.status,
          participants: match.participants,
          // Attributs data pour les styles CSS avancés
          "data-match-number": match.matchNumber || "",
          "data-status": match.state || match.status || "PENDING",
          "data-area-number": match.areaNumber || 1,
          "data-round-type": isFinale ? "finale" : "normal",
          "data-clickable":
            match.state === "PENDING" &&
            match.participants[0]?.id &&
            match.participants[1]?.id &&
            !match.participants[0]?.isBye &&
            !match.participants[1]?.isBye
              ? "true"
              : "false",
          // Gestionnaire de clic personnalisé
          onSeedClick: () => handleMatchClick(match, category),
        };
      }),
    }));

    return rounds;
  };

  // Gérer le clic sur un match dans le bracket
  const handleMatchClick = (match, category) => {
    if (
      match.state === "PENDING" &&
      match.participants[0]?.id &&
      match.participants[1]?.id &&
      !match.participants[0]?.isBye &&
      !match.participants[1]?.isBye
    ) {
      console.log(`Ouverture de la saisie pour le match ${match.matchNumber}`);
      // Redirection vers l'onglet Saisie des scores existant
      nextStep();
    }
  };

  // Fonction pour aller directement à l'étape ScoreInput
  const goToScoreInput = async () => {
    console.log("Navigation vers ScoreInput avec les matchs d'élimination");
    console.log("Matchs locaux disponibles:", eliminationMatches.length);

    // Passer les groupes pour la cohérence avec l'architecture existante
    setGroups(savedGroups);

    try {
      // Récupérer TOUS les matchs de la compétition et filtrer ceux d'élimination
      console.log("Récupération des matchs depuis l'API standard...");
      const response = await fetch(
        `${API_URL}/competition/${competitionId}/matches?include=matchParticipants`
      );

      if (!response.ok) {
        throw new Error(
          `Erreur lors de la récupération des matchs: ${response.status}`
        );
      }

      const matchesData = await response.json();
      console.log("Données reçues de l'API:", matchesData);

      let allMatches = [];
      if (matchesData && matchesData.data && matchesData.data.matches) {
        allMatches = matchesData.data.matches;
      } else if (Array.isArray(matchesData)) {
        allMatches = matchesData;
      }

      console.log(`${allMatches.length} matchs récupérés au total`);

      // Filtrer les matchs d'élimination (ceux qui appartiennent aux groupes d'élimination)
      const eliminationPoolIds = savedGroups
        .map((group) => group.eliminationPoolId)
        .filter(Boolean);
      console.log("IDs des pools d'élimination:", eliminationPoolIds);

      const eliminationMatches = allMatches.filter((match) => {
        return eliminationPoolIds.includes(match.poolId);
      });

      console.log(`${eliminationMatches.length} matchs d'élimination trouvés`);

      // Pour l'instant, utiliser tous les matchs d'élimination
      // ScoreInput pourra gérer ceux qui n'ont pas encore de participants
      console.log(
        `Utilisation de tous les ${eliminationMatches.length} matchs d'élimination`
      );

      // Log des premiers matchs pour vérification
      eliminationMatches.slice(0, 3).forEach((match, index) => {
        console.log(`Match ${index + 1}:`, {
          id: match.id,
          number: match.matchNumber,
          areaId: match.areaId,
          poolId: match.poolId,
          status: match.status,
        });
      });

      const readyMatches = eliminationMatches; // Utiliser tous les matchs

      // Utiliser la fonction directe si disponible
      if (goDirectlyToScoreInput) {
        goDirectlyToScoreInput(readyMatches);
      } else {
        // Fallback : utiliser nextStep avec délai
        console.log("Fonction directe non disponible, utilisation du fallback");
        nextStep(); // Étape 4 (MatchSchedule)
        setTimeout(() => {
          console.log("Navigation vers étape 5 (ScoreInput)");
          nextStep(); // Étape 5 (ScoreInput)
        }, 200);
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des matchs depuis la BDD:",
        error
      );
      alert("Erreur lors de la récupération des matchs. Veuillez réessayer.");
    }
  };

  // Fonction pour basculer le tri par club pour une catégorie
  const toggleSortByClub = (category) => {
    setSortByClub((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Fonction pour trier les participants d'une catégorie
  const getSortedParticipants = (categoryParticipants, category) => {
    if (!categoryParticipants) return [];

    let sortedParticipants = [...categoryParticipants];

    if (sortByClub[category]) {
      // Trier par club puis par nom
      sortedParticipants.sort((a, b) => {
        const clubA = a.club || a.clubName || a.clubId || "Sans club";
        const clubB = b.club || b.clubName || b.clubId || "Sans club";

        // D'abord par club
        if (clubA !== clubB) {
          return clubA.localeCompare(clubB);
        }

        // Ensuite par nom si même club
        const nameA = `${a.nom} ${a.prenom}`;
        const nameB = `${b.nom} ${b.prenom}`;
        return nameA.localeCompare(nameB);
      });
    } else {
      // Trier par rang puis par nom
      sortedParticipants.sort((a, b) => {
        const rankA = participantRankings[a.id] || 1;
        const rankB = participantRankings[b.id] || 1;

        // D'abord par rang
        if (rankA !== rankB) {
          return rankA - rankB;
        }

        // Ensuite par nom si même rang
        const nameA = `${a.nom} ${a.prenom}`;
        const nameB = `${b.nom} ${b.prenom}`;
        return nameA.localeCompare(nameB);
      });
    }

    return sortedParticipants;
  };

  // Fonction pour grouper les participants par club (si tri par club activé)
  const getParticipantsByClub = (categoryParticipants, category) => {
    if (!sortByClub[category]) {
      return { all: getSortedParticipants(categoryParticipants, category) };
    }

    const participantsByClub = {};
    const sortedParticipants = getSortedParticipants(
      categoryParticipants,
      category
    );

    sortedParticipants.forEach((participant) => {
      const clubName =
        participant.club ||
        participant.clubName ||
        participant.clubId ||
        "Sans club";
      if (!participantsByClub[clubName]) {
        participantsByClub[clubName] = [];
      }
      participantsByClub[clubName].push(participant);
    });

    return participantsByClub;
  };

  // Rendu de l'étape de ranking
  const renderRankingStep = () => (
    <div className="ranking-step">
      <div className="bracket-header">
        <h2>Classement des participants</h2>
        <p>
          Définissez le classement de chaque participant dans sa catégorie. Les
          mieux classés (rang 1) auront les meilleures positions dans le
          bracket.
        </p>
        <div className="tournament-info">
          <p>Catégories: {Object.keys(groupedParticipants).length}</p>
          <p>Participants total: {participants.length}</p>
          <p>
            Aires configurées:{" "}
            {tournamentConfig.numAreas || tournamentConfig.numberOfAreas || 1}
          </p>
          <p>
            Aires utilisées:{" "}
            {Math.min(
              Object.keys(groupedParticipants).length,
              tournamentConfig.numAreas || tournamentConfig.numberOfAreas || 1
            )}
          </p>
        </div>
      </div>

      <div className="groups-ranking">
        {Object.keys(groupedParticipants).map((category, index) => {
          const categoryParticipants = groupedParticipants[category];
          const areaNumber = getAreaForCategory(index);
          const participantsByClub = getParticipantsByClub(
            categoryParticipants,
            category
          );
          const isSortedByClub = sortByClub[category];

          return (
            <div key={category} className="group-section">
              <h3>
                Catégorie {category} (Aire {areaNumber})
              </h3>
              <div className="category-stats">
                <span>Participants: {categoryParticipants?.length || 0}</span>
                <span>
                  Taille bracket:{" "}
                  {getOptimalBracketSize(categoryParticipants?.length || 0)}
                </span>
                <span>
                  Aire: {areaNumber}/
                  {tournamentConfig.numAreas ||
                    tournamentConfig.numberOfAreas ||
                    1}
                </span>
              </div>

              {/* Boutons de tri */}
              <div
                className="sorting-controls"
                style={{
                  margin: "10px 0",
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: "bold", fontSize: "14px" }}>
                  Tri:
                </span>
                <button
                  onClick={() => toggleSortByClub(category)}
                  className={!isSortedByClub ? "btn-primary" : "btn-secondary"}
                  style={{
                    padding: "5px 10px",
                    fontSize: "12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    backgroundColor: !isSortedByClub ? "#3498db" : "#95a5a6",
                    color: "white",
                  }}
                >
                  📊 Par rang
                </button>
                <button
                  onClick={() => toggleSortByClub(category)}
                  className={isSortedByClub ? "btn-primary" : "btn-secondary"}
                  style={{
                    padding: "5px 10px",
                    fontSize: "12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    backgroundColor: isSortedByClub ? "#3498db" : "#95a5a6",
                    color: "white",
                  }}
                >
                  🏪 Par club
                </button>
                {isSortedByClub && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontStyle: "italic",
                    }}
                  >
                    {Object.keys(participantsByClub).length} club(s)
                  </span>
                )}
              </div>

              <div className="participants-ranking">
                {Object.keys(participantsByClub).map((clubName) => {
                  const clubParticipants = participantsByClub[clubName];

                  return (
                    <div key={clubName}>
                      {/* Afficher le nom du club si tri par club */}
                      {isSortedByClub && (
                        <div
                          style={{
                            backgroundColor: "#ecf0f1",
                            padding: "8px 12px",
                            margin: "10px 0 5px 0",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            color: "#2c3e50",
                            borderLeft: "4px solid #3498db",
                          }}
                        >
                          🏪 {clubName} ({clubParticipants.length} participant
                          {clubParticipants.length > 1 ? "s" : ""})
                        </div>
                      )}

                      {clubParticipants.map((participant) => (
                        <div
                          key={participant.id}
                          className="participant-ranking"
                          style={{
                            marginLeft: isSortedByClub ? "20px" : "0",
                            marginBottom: "8px",
                          }}
                        >
                          <div className="participant-info">
                            <div className="participant-name">
                              {participant.prenom} {participant.nom}
                            </div>
                            <div className="participant-details">
                              {participant.age} ans • {participant.poids} kg
                              {(participant.club ||
                                participant.clubName ||
                                participant.clubId) &&
                                !isSortedByClub && (
                                  <>
                                    {" • "}
                                    <span
                                      className="participant-club"
                                      style={{
                                        color: "#2c3e50",
                                        fontWeight: "500",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      {participant.club ||
                                        participant.clubName ||
                                        `Club ID: ${participant.clubId}`}
                                    </span>
                                  </>
                                )}
                            </div>
                          </div>
                          <div className="ranking-section">
                            <label>Rang:</label>
                            <input
                              type="number"
                              min="1"
                              value={participantRankings[participant.id] || 1}
                              onChange={(e) =>
                                updateRanking(participant.id, e.target.value)
                              }
                              className="ranking-input"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bracket-actions">
        <button className="btn-secondary" onClick={prevStep}>
          Retour
        </button>
        <button
          className="btn-primary"
          onClick={generateBrackets}
          disabled={Object.keys(groupedParticipants).length === 0}
        >
          Générer les brackets
        </button>
      </div>
    </div>
  );

  // Rendu de l'étape des brackets
  const renderBracketsStep = () => {
    const configuredAreas =
      tournamentConfig.numAreas || tournamentConfig.numberOfAreas || 1;
    const usedAreas = Math.min(Object.keys(brackets).length, configuredAreas);

    return (
      <div className="elimination-bracket-container">
        <div className="bracket-header">
          <h2>Tableaux d'élimination directe</h2>
          <p>
            Combats générés avec numérotation et attribution d'aires (un groupe
            = une aire)
          </p>
          <div className="tournament-info">
            <p>Aires configurées: {configuredAreas}</p>
            <p>Aires utilisées: {usedAreas}</p>
            <p>Catégories: {Object.keys(brackets).length}</p>
            <p>Total combats: {eliminationMatches.length}</p>
          </div>
        </div>

        {/* Affichage de la répartition des aires */}
        <div className="areas-distribution">
          <h4>Répartition équilibrée des catégories par aire :</h4>
          <p className="distribution-explanation">
            Les catégories sont réparties pour équilibrer le nombre de combats
            par aire.
            <br />
            Les catégories avec le plus de combats sont assignées aux aires les
            moins chargées.
            <br />
            Au sein de chaque aire, les tours alternent entre les catégories
            assignées.
          </p>
          <div className="areas-grid">
            {Array.from({ length: configuredAreas }, (_, i) => i + 1).map(
              (areaNumber) => {
                // Pour chaque aire, afficher les catégories assignées
                const categoryKeys = Object.keys(groupedParticipants);
                const categoriesInThisArea = categoryKeys.filter(
                  (category, index) => getAreaForCategory(index) === areaNumber
                );

                // Calculer le nombre total de combats pour cette aire
                const totalCombatsThisArea = categoriesInThisArea.reduce(
                  (total, category) => {
                    const categoryParticipants = groupedParticipants[category];
                    const participantCount = categoryParticipants?.length || 0;
                    const bracketSize = getOptimalBracketSize(participantCount);
                    const combats = bracketSize - 1;
                    return total + combats;
                  },
                  0
                );

                return (
                  <div key={areaNumber} className="area-card">
                    <h5>Aire {areaNumber}</h5>
                    <div className="categories-list">
                      {categoriesInThisArea.length > 0 ? (
                        categoriesInThisArea.map((category, idx) => {
                          const categoryParticipants =
                            groupedParticipants[category];
                          const participantCount =
                            categoryParticipants?.length || 0;
                          const bracketSize =
                            getOptimalBracketSize(participantCount);
                          const combats = bracketSize - 1;

                          return (
                            <div
                              key={idx}
                              className="category-tag"
                              title={`${participantCount} participants → ${combats} combats`}
                            >
                              {category}
                              <small
                                style={{
                                  display: "block",
                                  fontSize: "0.7em",
                                  opacity: 0.8,
                                }}
                              >
                                {combats} combats
                              </small>
                            </div>
                          );
                        })
                      ) : (
                        <span className="no-category">Aucune catégorie</span>
                      )}
                    </div>
                    <div className="area-stats">
                      Numérotation: {areaNumber}01, {areaNumber}02, {areaNumber}
                      03...
                    </div>
                    <div
                      className="area-stats"
                      style={{
                        fontWeight: "bold",
                        color: totalCombatsThisArea > 0 ? "#2c3e50" : "#7f8c8d",
                        fontSize: "1.1em",
                      }}
                    >
                      🥊 {totalCombatsThisArea} combats total
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        <div className="brackets-container">
          {Object.keys(groupedParticipants).map((category, index) => {
            const categoryMatches = brackets[category];
            if (!categoryMatches || !Array.isArray(categoryMatches)) {
              return null;
            }

            const rounds = convertMatchesToRounds(categoryMatches, category);

            // Statistiques de la catégorie
            const pendingMatches = categoryMatches.filter(
              (m) => m.state === "PENDING"
            ).length;
            const completedMatches = categoryMatches.filter(
              (m) => m.state === "DONE"
            ).length;

            // Aires utilisées par cette catégorie
            const aireAssignee = getAreaForCategory(index);

            return (
              <div
                key={category}
                className="category-bracket"
                data-category={category}
              >
                <h3>Catégorie {category}</h3>
                <div className="category-stats">
                  <span>
                    Participants: {groupedParticipants[category]?.length || 0}
                  </span>
                  <span>Total combats: {categoryMatches.length}</span>
                  <span>En attente: {pendingMatches}</span>
                  <span>Terminés: {completedMatches}</span>
                  <span>Aire assignée: {aireAssignee}</span>
                </div>

                <div className="matches-list">
                  <h4>Liste des combats (numérotation par aire)</h4>
                  <div className="matches-grid">
                    {categoryMatches.map((match) => (
                      <div
                        key={match.id}
                        className={`match-card ${match.state.toLowerCase()}`}
                      >
                        <div className="match-header">
                          <span className="match-number">
                            {match.matchNumber
                              ? `Combat #${match.matchNumber}`
                              : match.name || "Qualification automatique"}
                          </span>
                          <span className="match-round">
                            {match.tournamentRoundText}
                          </span>
                          <span className="match-area">
                            {match.matchNumber
                              ? `Aire ${match.areaNumber}`
                              : ""}
                          </span>
                        </div>
                        <div className="match-participants">
                          <div
                            className={`participant blue ${
                              match.participants[0]?.isWinner ? "winner" : ""
                            }`}
                          >
                            <span className="position">BLEU</span>
                            <div className="participant-info">
                              <span className="name">
                                {(() => {
                                  const p = match.participants[0];
                                  if (p && p.id && !p.isBye && p.id !== "bye") {
                                    return p.name;
                                  } else if (p && p.isBye) {
                                    return "BYE";
                                  } else if (p && p.name === "À déterminer") {
                                    // Afficher la dépendance vers le match précédent
                                    const previousMatchIndex = 0; // Position A = premier match précédent
                                    const previousMatchId =
                                      match.previousMatches?.[
                                        previousMatchIndex
                                      ];
                                    if (previousMatchId) {
                                      const previousMatch =
                                        categoryMatches.find(
                                          (m) => m.id === previousMatchId
                                        );
                                      return previousMatch?.matchNumber
                                        ? `Gagnant du combat ${previousMatch.matchNumber}`
                                        : "À déterminer";
                                    }
                                    return "À déterminer";
                                  } else {
                                    return "À déterminer";
                                  }
                                })()}
                              </span>
                              {(() => {
                                const p = match.participants[0];
                                if (p && p.club && !p.isBye && p.id !== "bye") {
                                  return (
                                    <span
                                      className="club"
                                      style={{
                                        display: "block",
                                        fontSize: "0.8em",
                                        fontStyle: "italic",
                                        color: "#666",
                                        marginTop: "2px",
                                      }}
                                    >
                                      {p.club}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                          <div className="vs">VS</div>
                          <div
                            className={`participant red ${
                              match.participants[1]?.isWinner ? "winner" : ""
                            }`}
                          >
                            <span className="position">ROUGE</span>
                            <div className="participant-info">
                              <span className="name">
                                {(() => {
                                  const p = match.participants[1];
                                  if (p && p.id && !p.isBye && p.id !== "bye") {
                                    return p.name;
                                  } else if (p && p.isBye) {
                                    return "BYE";
                                  } else if (p && p.name === "À déterminer") {
                                    // Afficher la dépendance vers le match précédent
                                    const previousMatchIndex = 1; // Position B = deuxième match précédent
                                    const previousMatchId =
                                      match.previousMatches?.[
                                        previousMatchIndex
                                      ];
                                    if (previousMatchId) {
                                      const previousMatch =
                                        categoryMatches.find(
                                          (m) => m.id === previousMatchId
                                        );
                                      return previousMatch?.matchNumber
                                        ? `Gagnant du combat ${previousMatch.matchNumber}`
                                        : "À déterminer";
                                    }
                                    return "À déterminer";
                                  } else {
                                    return "À déterminer";
                                  }
                                })()}
                              </span>
                              {(() => {
                                const p = match.participants[1];
                                if (p && p.club && !p.isBye && p.id !== "bye") {
                                  return (
                                    <span
                                      className="club"
                                      style={{
                                        display: "block",
                                        fontSize: "0.8em",
                                        fontStyle: "italic",
                                        color: "#666",
                                        marginTop: "2px",
                                      }}
                                    >
                                      {p.club}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="match-status">
                          {match.state === "DONE" ? "Terminé" : "En attente"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bracket-wrapper">
                  <Bracket
                    rounds={rounds}
                    bracketClassName="custom-bracket-enhanced"
                    roundClassName="custom-round-enhanced"
                    matchClassName="custom-match-enhanced"
                    seedClassName="custom-seed-enhanced"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bracket-actions">
          <button
            className="btn-secondary"
            onClick={() => setCurrentStep("ranking")}
          >
            Modifier les rankings
          </button>
          <button
            className="btn-export"
            onClick={exportToPDF}
            disabled={Object.keys(brackets).length === 0}
            style={{
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "5px",
              cursor: "pointer",
              marginRight: "10px",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            📄 Exporter Tout en PDF
          </button>
          <button
            className="btn-export-brackets"
            onClick={exportBracketsOnlyToPDF}
            disabled={Object.keys(brackets).length === 0}
            style={{
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "5px",
              cursor: "pointer",
              marginRight: "10px",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            🏆 Exporter Brackets PDF
          </button>
          <button
            className="btn-primary"
            onClick={goToScoreInput}
            disabled={eliminationMatches.length === 0 || isSaving}
          >
            {isSaving ? "Sauvegarde..." : "Gérer les combats"}
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Sauvegarde..." : "Sauvegarder et continuer"}
          </button>
        </div>
      </div>
    );
  };

  // Fonction d'export PDF des brackets
  const exportToPDF = async () => {
    try {
      console.log("Début de l'export PDF...");

      // Créer un nouveau PDF en format A4 paysage pour plus d'espace
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      let isFirstPage = true;

      // Approche alternative : capturer tous les brackets d'un coup
      const bracketsContainer = document.querySelector(".brackets-container");

      if (!bracketsContainer) {
        console.error("Container des brackets non trouvé");
        alert("Impossible de trouver les tableaux à exporter");
        return;
      }

      // Pour chaque catégorie visible
      const categoryElements =
        bracketsContainer.querySelectorAll(".category-bracket");

      if (categoryElements.length === 0) {
        alert("Aucun tableau à exporter");
        return;
      }

      console.log(`Export de ${categoryElements.length} catégories...`);

      for (const [index, categoryElement] of Array.from(
        categoryElements
      ).entries()) {
        const categoryName =
          categoryElement.getAttribute("data-category") ||
          `Catégorie ${index + 1}`;
        console.log(`Export de ${categoryName}...`);

        // Si ce n'est pas la première page, ajouter une nouvelle page
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        try {
          // Capturer l'élément en tant qu'image avec des options optimisées
          const canvas = await html2canvas(categoryElement, {
            scale: 1.5, // Qualité élevée mais raisonnable
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false, // Réduire les logs
            width: categoryElement.scrollWidth,
            height: categoryElement.scrollHeight,
          });

          // Convertir en image
          const imgData = canvas.toDataURL("image/jpeg", 0.8); // JPEG pour fichier plus léger

          // Calculer les dimensions pour s'adapter à la page
          const pageWidth = pdf.internal.pageSize.getWidth() - 20; // Marges
          const pageHeight = pdf.internal.pageSize.getHeight() - 40; // Marges + espace titre

          const imgWidth = canvas.width;
          const imgHeight = canvas.height;

          // Calculer le ratio pour ajuster l'image
          const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
          const finalWidth = imgWidth * ratio;
          const finalHeight = imgHeight * ratio;

          // Centrer l'image sur la page
          const x = (pdf.internal.pageSize.getWidth() - finalWidth) / 2;
          const y = 30; // Espace pour le titre

          // Ajouter le titre de la catégorie
          pdf.setFontSize(16);
          pdf.setTextColor(0, 0, 0);
          pdf.text(
            `Tableau d'élimination - ${categoryName}`,
            pdf.internal.pageSize.getWidth() / 2,
            20,
            { align: "center" }
          );

          // Ajouter l'image au PDF
          pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);

          console.log(`✅ ${categoryName} exporté`);
        } catch (elementError) {
          console.error(
            `Erreur lors de l'export de ${categoryName}:`,
            elementError
          );
          // Continuer avec les autres catégories
        }
      }

      // Ajouter une page de couverture au début
      pdf.insertPage(1);
      pdf.setPage(1);

      // Page de couverture
      pdf.setFontSize(24);
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        "Tableaux d'élimination directe",
        pdf.internal.pageSize.getWidth() / 2,
        60,
        { align: "center" }
      );

      pdf.setFontSize(16);
      const currentDate = new Date().toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      pdf.text(
        `Généré le ${currentDate}`,
        pdf.internal.pageSize.getWidth() / 2,
        80,
        { align: "center" }
      );

      pdf.setFontSize(14);
      pdf.text(
        `${categoryElements.length} catégories`,
        pdf.internal.pageSize.getWidth() / 2,
        100,
        { align: "center" }
      );
      pdf.text(
        `${eliminationMatches.length} combats au total`,
        pdf.internal.pageSize.getWidth() / 2,
        120,
        { align: "center" }
      );

      // Télécharger le PDF
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[T:]/g, "-");
      pdf.save(`tableaux-elimination-${timestamp}.pdf`);

      console.log("✅ Export PDF terminé avec succès !");
      alert(
        `PDF exporté avec succès !\n${categoryElements.length} catégories, ${eliminationMatches.length} combats`
      );
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      alert("Erreur lors de l'export PDF: " + error.message);
    }
  };

  // Fonction d'export PDF des brackets uniquement (sans la liste des combats)
  const exportBracketsOnlyToPDF = async () => {
    try {
      console.log("Début de l'export PDF des brackets seulement...");

      // Créer un nouveau PDF en format A4 paysage pour plus d'espace
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      let isFirstPage = true;

      // Trouver tous les bracket-wrapper (les tableaux visuels uniquement)
      const bracketElements = document.querySelectorAll(".bracket-wrapper");

      if (bracketElements.length === 0) {
        alert("Aucun bracket visuel à exporter");
        return;
      }

      console.log(`Export de ${bracketElements.length} brackets visuels...`);

      for (const [index, bracketElement] of Array.from(
        bracketElements
      ).entries()) {
        // Récupérer le nom de la catégorie depuis l'élément parent
        const categoryElement = bracketElement.closest(".category-bracket");
        const categoryName =
          categoryElement?.getAttribute("data-category") ||
          `Bracket ${index + 1}`;

        console.log(`Export du bracket visuel: ${categoryName}...`);

        // Si ce n'est pas la première page, ajouter une nouvelle page
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        try {
          // Capturer seulement le bracket visuel avec des options optimisées
          const canvas = await html2canvas(bracketElement, {
            scale: 2, // Qualité plus élevée pour les brackets
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
            width: bracketElement.scrollWidth,
            height: bracketElement.scrollHeight,
          });

          // Convertir en image
          const imgData = canvas.toDataURL("image/png", 1.0); // PNG haute qualité pour les brackets

          // Calculer les dimensions pour s'adapter à la page
          const pageWidth = pdf.internal.pageSize.getWidth() - 10; // Marges minimales
          const pageHeight = pdf.internal.pageSize.getHeight() - 30; // Espace pour le titre

          const imgWidth = canvas.width;
          const imgHeight = canvas.height;

          // Calculer le ratio pour ajuster l'image
          const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
          const finalWidth = imgWidth * ratio;
          const finalHeight = imgHeight * ratio;

          // Centrer l'image sur la page
          const x = (pdf.internal.pageSize.getWidth() - finalWidth) / 2;
          const y = 20; // Espace pour le titre

          // Ajouter le titre de la catégorie
          pdf.setFontSize(14);
          pdf.setTextColor(0, 0, 0);
          pdf.text(
            `${categoryName}`,
            pdf.internal.pageSize.getWidth() / 2,
            15,
            { align: "center" }
          );

          // Ajouter l'image au PDF
          pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);

          console.log(`✅ Bracket ${categoryName} exporté`);
        } catch (elementError) {
          console.error(
            `Erreur lors de l'export du bracket ${categoryName}:`,
            elementError
          );
          // Continuer avec les autres brackets
        }
      }

      // Télécharger le PDF
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[T:]/g, "-");
      pdf.save(`brackets-elimination-${timestamp}.pdf`);

      console.log("✅ Export PDF des brackets terminé avec succès !");
      alert(
        `Brackets exportés avec succès !\n${bracketElements.length} tableaux visuels`
      );
    } catch (error) {
      console.error("Erreur lors de l'export PDF des brackets:", error);
      alert("Erreur lors de l'export PDF des brackets: " + error.message);
    }
  };

  // Rendu principal - Plus d'interface ScoreInput séparée
  return (
    <div className="elimination-bracket-wrapper">
      {currentStep === "ranking" && renderRankingStep()}
      {currentStep === "brackets" && renderBracketsStep()}

      {saveSuccess && (
        <div className="save-success">Brackets sauvegardés avec succès !</div>
      )}
    </div>
  );
};

export default EliminationBracket;
