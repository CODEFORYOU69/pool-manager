import React, { useEffect, useRef, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  checkExistingGroupsAndPools,
  fetchFormattedMatches,
  saveGeneratedMatches,
  saveGroupsAndPools,
} from "../services/dbService";
import "../styles/MatchSchedule.css";
import { generateMatches } from "../utils/matchGenerator";
import { createSchedule } from "../utils/scheduleManager";
// Correction de l'importation pour la génération PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { findPssInfo } from "../utils/categories";
import { findPowerThreshold } from "../utils/constants";

const MatchSchedule = ({
  groups,
  tournamentConfig,
  setMatches,
  setSchedule,
  nextStep,
  prevStep,
  matches,
  schedule,
}) => {
  const { competitionId, competitionName } = useCompetition();
  const [generatedMatches, setGeneratedMatches] = useState([]);
  const [generatedSchedule, setGeneratedSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleStats, setScheduleStats] = useState({
    totalMatches: 0,
    totalAreas: 0,
    estimatedDuration: 0,
    estimatedEndTime: null,
  });
  const [viewMode, setViewMode] = useState("byGroup"); // 'byGroup' ou 'byArea'
  const [exportLoading, setExportLoading] = useState({
    pdf: false,
    csv: false,
  });
  const [dataSource, setDataSource] = useState(""); // 'new' ou 'existing'
  // Ajouter des états pour les filtres
  const [areaFilter, setAreaFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [ligueFilter, setLigueFilter] = useState("");
  const [displayAllAreas, setDisplayAllAreas] = useState(true);
  // Nouvel état pour stocker l'information si les matchs ont déjà été chargés
  const [matchesAlreadyLoaded, setMatchesAlreadyLoaded] = useState(false);
  const [info, setInfo] = useState(null);
  // État pour stocker les informations PSS par match
  const [matchesPssInfo, setMatchesPssInfo] = useState({});
  // Référence pour éviter les appels multiples à la génération des matchs
  const isLoadingOrGenerating = useRef(false);

  useEffect(() => {
    if (groups && groups.length > 0 && tournamentConfig && competitionId) {
      // Vérifier si on est déjà en train de charger/générer des matchs
      if (isLoadingOrGenerating.current) {
        console.log("Chargement/génération déjà en cours, opération ignorée");
        return;
      }

      // Définir le drapeau pour éviter les appels multiples
      isLoadingOrGenerating.current = true;

      // Vérifier si des matchs ont déjà été fournis en props
      if (matches && matches.length > 0 && schedule && schedule.length > 0) {
        console.log(
          "Utilisation des matchs et du planning fournis:",
          matches.length
        );
        setGeneratedMatches(matches);
        setGeneratedSchedule(schedule);
        calculateStats(matches, schedule);
        setMatchesAlreadyLoaded(true);
        setDataSource("existing");
        setIsLoading(false);
        isLoadingOrGenerating.current = false;
      }
      // Si les matchs ont déjà été chargés dans le state, ne pas les recharger
      else if (generatedMatches.length > 0 && matchesAlreadyLoaded) {
        console.log("Matchs déjà chargés, utilisation des données en cache");
        setIsLoading(false);
        isLoadingOrGenerating.current = false;
      }
      // Sinon, essayer de charger les matchs existants
      else {
        console.log(
          "Chargement des matchs existants ou génération de nouveaux matchs"
        );
        loadExistingMatches()
          .then(() => {
            isLoadingOrGenerating.current = false;
          })
          .catch(() => {
            isLoadingOrGenerating.current = false;
          });
      }
    }
  }, [groups, tournamentConfig, competitionId, matches, schedule]);

  useEffect(() => {
    if (!matchesAlreadyLoaded) {
      // Afficher un message d'information sur les améliorations apportées
      setInfo({
        type: "info",
        message:
          "Le système de génération des matchs a été optimisé pour éviter les duplications. Les matchs ne seront générés qu'une seule fois pour chaque combinaison unique de participants.",
      });
    }
  }, [matchesAlreadyLoaded]);

  // Fonction pour charger les matchs existants sans les générer
  const loadExistingMatches = async () => {
    setIsLoading(true);
    try {
      console.log("Tentative de chargement des matchs existants...");

      // Essayer de charger les matchs directement, sans passer par checkExistingMatches
      const { matches: loadedMatches, schedule: loadedSchedule } =
        await fetchFormattedMatches(competitionId);

      if (loadedMatches && loadedMatches.length > 0) {
        console.log(
          `${loadedMatches.length} matchs chargés depuis la base de données`
        );
        console.log(`${loadedSchedule.length} éléments de planning chargés`);

        setGeneratedMatches(loadedMatches);
        setGeneratedSchedule(loadedSchedule);
        setDataSource("existing");

        // Calculer les statistiques
        calculateStats(loadedMatches, loadedSchedule);

        // Marquer les matchs comme chargés
        setMatchesAlreadyLoaded(true);
        setError(null);
      } else {
        console.log("Aucun match existant trouvé dans la base de données");
        // Simplement marquer comme chargé sans erreur, sans générer automatiquement
        setIsLoading(false);
        setMatchesAlreadyLoaded(true);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des matchs existants:", error);
      setIsLoading(false);
      // Ne pas lancer d'erreur, simplement noter qu'aucun match n'a été trouvé
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Utilitaire pour calculer les statistiques
  const calculateStats = (matches, schedule) => {
    // Vérifier si nous avons des matchs à traiter
    if (!schedule || schedule.length === 0) {
      setScheduleStats({
        totalMatches: matches.length,
        totalAreas: 0,
        estimatedDuration: 0,
        estimatedEndTime: new Date(),
      });
      return;
    }

    // Déterminer le nombre d'aires à partir des matchs
    const airesUtilisees = new Set();
    matches.forEach((match) => {
      if (match.areaNumber) airesUtilisees.add(match.areaNumber);
      else if (match.area && match.area.areaNumber)
        airesUtilisees.add(match.area.areaNumber);
    });

    // S'assurer que la valeur de configuration est un nombre
    let configAreas = 1;
    if (tournamentConfig && tournamentConfig.numAreas) {
      // Conversion explicite en nombre entier
      configAreas = parseInt(tournamentConfig.numAreas, 10);
      if (isNaN(configAreas)) configAreas = 1; // Valeur par défaut si la conversion échoue
    }

    // Utiliser le nombre d'aires configuré, mais au minimum le nombre d'aires détectées
    const numAreas = Math.max(airesUtilisees.size, configAreas);

    console.log(
      "Nombre d'aires de combat dans calculateStats:",
      numAreas,
      "Aires détectées:",
      Array.from(airesUtilisees),
      "Aires configurées:",
      configAreas,
      "tournamentConfig:",
      tournamentConfig
    );

    // Trouver l'heure de début du premier match et l'heure de fin du dernier match pour chaque aire
    const areaTimings = {};

    schedule.forEach((item) => {
      if (!item.areaNumber || !item.startTime) return;

      if (!areaTimings[item.areaNumber]) {
        areaTimings[item.areaNumber] = {
          firstMatch: null,
          lastMatch: null,
        };
      }

      const startTime = new Date(item.startTime);
      const endTime = item.endTime ? new Date(item.endTime) : null;

      // Mettre à jour l'heure du premier match si nécessaire
      if (
        !areaTimings[item.areaNumber].firstMatch ||
        startTime < areaTimings[item.areaNumber].firstMatch
      ) {
        areaTimings[item.areaNumber].firstMatch = startTime;
      }

      // Mettre à jour l'heure du dernier match si nécessaire
      if (
        endTime &&
        (!areaTimings[item.areaNumber].lastMatch ||
          endTime > areaTimings[item.areaNumber].lastMatch)
      ) {
        areaTimings[item.areaNumber].lastMatch = endTime;
      }
    });

    // Calculer la durée totale pour chaque aire (du premier au dernier match)
    let maxDuration = 0;
    let earliestStart = null;
    let latestEnd = null;

    for (const areaNum in areaTimings) {
      const area = areaTimings[areaNum];
      if (area.firstMatch && area.lastMatch) {
        // Garder trace du début le plus tôt et de la fin la plus tardive
        if (!earliestStart || area.firstMatch < earliestStart) {
          earliestStart = area.firstMatch;
        }
        if (!latestEnd || area.lastMatch > latestEnd) {
          latestEnd = area.lastMatch;
        }

        // Calculer la durée pour cette aire
        const areaDuration = (area.lastMatch - area.firstMatch) / 60000; // en minutes
        console.log(
          `Aire ${areaNum}: Début ${area.firstMatch.toLocaleTimeString()}, Fin ${area.lastMatch.toLocaleTimeString()}, Durée ${areaDuration.toFixed(
            1
          )} minutes`
        );

        if (areaDuration > maxDuration) {
          maxDuration = areaDuration;
        }
      }
    }

    // Utiliser la durée totale du tournoi (du début du premier match à la fin du dernier)
    let tournamentDuration = 0;
    if (earliestStart && latestEnd) {
      tournamentDuration = (latestEnd - earliestStart) / 60000; // en minutes
      console.log(
        `Durée totale du tournoi: du ${earliestStart.toLocaleTimeString()} au ${latestEnd.toLocaleTimeString()} = ${tournamentDuration.toFixed(
          1
        )} minutes`
      );
    } else {
      // Fallback si les calculs précédents échouent
      tournamentDuration = (matches.length * 5) / numAreas; // Estimation grossière basée sur 5 minutes par match
    }

    // Ajouter un facteur d'ajustement pour tenir compte des imprévus
    const estimatedDuration = tournamentDuration * 1.05; // +5% de marge

    // Calculer l'heure de fin estimée
    const now = new Date();
    const endTime = new Date(now.getTime() + estimatedDuration * 60000);

    setScheduleStats({
      totalMatches: matches.length,
      totalAreas: numAreas,
      estimatedDuration: estimatedDuration,
      estimatedEndTime: endTime,
    });
  };

  // Nouvelle fonction pour vérifier l'existence des matchs et charger ou générer selon le cas
  const loadOrGenerateMatchSchedule = async () => {
    // Utiliser directement forceLoadExistingMatches pour éviter les problèmes
    await loadExistingMatches();
  };

  // Fonction pour générer le planning et les matchs
  const handleGenerateSchedule = async () => {
    // Vérifier si on est déjà en train de charger/générer des matchs
    if (isLoadingOrGenerating.current) {
      console.log("Génération déjà en cours, opération ignorée");
      return;
    }

    try {
      // Définir le drapeau pour éviter les appels multiples
      isLoadingOrGenerating.current = true;
      setIsLoading(true);
      setError(null);

      // Vérifier d'abord s'il existe déjà des matchs pour cette compétition
      try {
        // Vérifier si les matchs existent déjà
        const matchesResponse = await fetch(
          `${API_URL}/competition/${competitionId}/matches`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (matchesResponse.ok) {
          const existingMatches = await matchesResponse.json();

          if (existingMatches && existingMatches.length > 0) {
            // Des matchs existent déjà, charger ces matchs au lieu d'en générer de nouveaux
            try {
              const { matches: loadedMatches, schedule: loadedSchedule } =
                await fetchFormattedMatches(competitionId);

              if (loadedMatches && loadedMatches.length > 0) {
                setGeneratedMatches(loadedMatches);
                setGeneratedSchedule(loadedSchedule);
                setDataSource("existing");
                calculateStats(loadedMatches, loadedSchedule);
                setMatchesAlreadyLoaded(true);
                setIsLoading(false);
                isLoadingOrGenerating.current = false;
                return; // Sortir de la fonction, pas besoin de générer de nouveaux matchs
              }
            } catch (loadError) {
              console.error(
                "Erreur lors du chargement des matchs existants:",
                loadError
              );
              // Continuer avec la génération
            }
          }
        }
      } catch (checkError) {
        console.warn(
          "Erreur lors de la vérification des matchs existants:",
          checkError
        );
        // Continuer avec la génération
      }

      // Générer tous les combats pour toutes les poules
      const allMatches = generateMatches(groups);

      // Créer le planning des combats
      const {
        schedule: generatedSchedule,
        updatedMatches,
        stats,
      } = createSchedule(allMatches, tournamentConfig);

      // Utiliser les matchs mis à jour avec leurs numéros et aires attribués
      const matchesWithSchedule = updatedMatches;

      // Mettre à jour les matchs avec les numéros et horaires du planning
      const matchesWithNumbers = matchesWithSchedule.map((match) => {
        const scheduledMatch = generatedSchedule.find(
          (s) => s.matchId === match.id
        );
        if (scheduledMatch) {
          return {
            ...match,
            number: scheduledMatch.matchNumber,
            areaNumber: scheduledMatch.areaNumber,
            startTime: scheduledMatch.startTime,
          };
        }
        return match;
      });

      // Au lieu de sauvegarder les groupes à chaque fois, vérifier d'abord s'ils existent déjà
      checkExistingGroupsAndPools(competitionId)
        .then((existingGroupsResult) => {
          if (
            existingGroupsResult.exists &&
            existingGroupsResult.groups &&
            existingGroupsResult.groups.length > 0
          ) {
            // Utiliser directement les groupes existants
            const savedGroups = existingGroupsResult.groups;

            // Mettre à jour les IDs des groupes dans les matchs
            const updatedMatches = matchesWithNumbers.map((match) => {
              if (!match.groupId || !Array.isArray(groups)) {
                console.error("Données de match invalides:", match);
                return match;
              }

              const originalGroup = groups.find((g) => g.id === match.groupId);
              if (!originalGroup) {
                console.error(
                  "Groupe original non trouvé pour le match:",
                  match
                );
                return match;
              }

              const savedGroup = savedGroups.find(
                (sg) =>
                  sg &&
                  sg.gender === originalGroup.gender &&
                  sg.ageCategoryName === originalGroup.ageCategory.name &&
                  sg.weightCategoryName === originalGroup.weightCategory.name
              );

              if (!savedGroup) {
                console.error(
                  "Groupe sauvegardé non trouvé pour le match:",
                  match
                );
                return match;
              }

              return {
                ...match,
                groupId: savedGroup.id,
              };
            });

            // Organiser les matchs par poule comme attendu par saveGeneratedMatches
            const matchesByPool = [];

            // Récupérer toutes les poules uniques
            const uniquePools = new Set();
            updatedMatches.forEach((match) => {
              if (match.poolId) {
                uniquePools.add(match.poolId);
              }
            });

            // Si nous n'avons pas directement des poolId, utiliser les combinaisons groupId et poolIndex
            if (uniquePools.size === 0) {
              // Grouper par combinaison groupId + poolIndex
              const poolMap = new Map();
              updatedMatches.forEach((match) => {
                const key = `${match.groupId}-${match.poolIndex}`;
                if (!poolMap.has(key)) {
                  poolMap.set(key, []);
                }
                poolMap.get(key).push(match);
              });

              // Récupérer les pools de chaque groupe
              savedGroups.forEach((group) => {
                // Récupérer toutes les pools pour ce groupe
                fetch(`${API_URL}/group/${group.id}/pools`, {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  },
                })
                  .then((response) => response.json())
                  .then((pools) => {
                    pools.forEach((pool, index) => {
                      const matches = poolMap.get(
                        `${group.id}-${pool.poolIndex}`
                      );
                      if (matches && matches.length > 0) {
                        matchesByPool.push({
                          poolId: pool.id,
                          matches: matches,
                        });
                      }
                    });

                    // Sauvegarder les matchs une fois que toutes les pools sont traitées
                    if (matchesByPool.length > 0) {
                      saveGeneratedMatches(competitionId, matchesByPool)
                        .then(handleSaveMatchesSuccess)
                        .catch(handleSaveError);
                    } else {
                      setError(
                        "Aucun match à sauvegarder. Vérifiez que les poules ont été correctement configurées."
                      );
                      setIsLoading(false);
                    }
                  })
                  .catch((error) => {
                    console.error(
                      "Erreur lors de la récupération des pools:",
                      error
                    );
                    setError(
                      `Erreur lors de la récupération des pools: ${error.message}`
                    );
                    setIsLoading(false);
                  });
              });

              return; // Sortir de la fonction ici car l'appel asynchrone ci-dessus continuera le traitement
            } else {
              // Si nous avons des poolId, nous pouvons les utiliser directement
              uniquePools.forEach((poolId) => {
                const poolMatches = updatedMatches.filter(
                  (match) => match.poolId === poolId
                );
                if (poolMatches.length > 0) {
                  matchesByPool.push({
                    poolId: poolId,
                    matches: poolMatches,
                  });
                }
              });
            }

            // Vérifier si nous avons des matchs à sauvegarder
            if (matchesByPool.length === 0) {
              throw new Error(
                "Impossible d'organiser les matchs par poule. Vérifiez que les poules ont été correctement sauvegardées."
              );
            }

            // Sauvegarder les matchs avec le format attendu
            return saveGeneratedMatches(competitionId, matchesByPool)
              .then(handleSaveMatchesSuccess)
              .catch(handleSaveError);
          } else {
            // Si les groupes n'existent pas, les sauvegarder d'abord
            return saveGroupsAndPools(competitionId, groups)
              .then((savedGroupsResult) => {
                const savedGroups = savedGroupsResult.savedGroups || [];

                // Mettre à jour les IDs des groupes dans les matchs
                const updatedMatches = matchesWithNumbers.map((match) => {
                  if (!match.groupId || !Array.isArray(groups)) {
                    console.error("Données de match invalides:", match);
                    return match;
                  }

                  const originalGroup = groups.find(
                    (g) => g.id === match.groupId
                  );
                  if (!originalGroup) {
                    console.error(
                      "Groupe original non trouvé pour le match:",
                      match
                    );
                    return match;
                  }

                  const savedGroup = savedGroups.find(
                    (sg) =>
                      sg &&
                      sg.gender === originalGroup.gender &&
                      sg.ageCategoryName === originalGroup.ageCategory.name &&
                      sg.weightCategoryName ===
                        originalGroup.weightCategory.name
                  );

                  if (!savedGroup) {
                    console.error(
                      "Groupe sauvegardé non trouvé pour le match:",
                      match
                    );
                    return match;
                  }

                  return {
                    ...match,
                    groupId: savedGroup.id,
                  };
                });

                // Organiser les matchs par poule comme attendu par saveGeneratedMatches
                const matchesByPool = [];

                // Récupérer toutes les poules uniques
                const uniquePools = new Set();
                updatedMatches.forEach((match) => {
                  if (match.poolId) {
                    uniquePools.add(match.poolId);
                  }
                });

                // Si nous n'avons pas directement des poolId, utiliser les combinaisons groupId et poolIndex
                if (uniquePools.size === 0) {
                  // Grouper par combinaison groupId + poolIndex
                  const poolMap = new Map();
                  updatedMatches.forEach((match) => {
                    const key = `${match.groupId}-${match.poolIndex}`;
                    if (!poolMap.has(key)) {
                      poolMap.set(key, []);
                    }
                    poolMap.get(key).push(match);
                  });

                  // Pour chaque savedGroup, trouver ses poules et les ajouter à matchesByPool
                  savedGroups.forEach((group) => {
                    const groupPools = group.poolIds || [];
                    groupPools.forEach((poolId, index) => {
                      const matches = poolMap.get(`${group.id}-${index}`);
                      if (matches && matches.length > 0) {
                        matchesByPool.push({
                          poolId: poolId,
                          matches: matches,
                        });
                      }
                    });
                  });
                } else {
                  // Si nous avons des poolId, nous pouvons les utiliser directement
                  uniquePools.forEach((poolId) => {
                    const poolMatches = updatedMatches.filter(
                      (match) => match.poolId === poolId
                    );
                    if (poolMatches.length > 0) {
                      matchesByPool.push({
                        poolId: poolId,
                        matches: poolMatches,
                      });
                    }
                  });
                }

                // Vérifier si nous avons des matchs à sauvegarder
                if (matchesByPool.length === 0) {
                  throw new Error(
                    "Impossible d'organiser les matchs par poule. Vérifiez que les poules ont été correctement sauvegardées."
                  );
                }

                // Sauvegarder les matchs avec le format attendu
                return saveGeneratedMatches(competitionId, matchesByPool);
              })
              .then(handleSaveMatchesSuccess)
              .catch(handleSaveError);
          }
        })
        .catch((error) => {
          console.error(
            "Erreur lors de la vérification des groupes existants:",
            error
          );
          setError(
            `Erreur lors de la vérification des groupes existants: ${error.message}`
          );
          setIsLoading(false);
        });

      // Fonction de gestion du succès de la sauvegarde des matchs
      const handleSaveMatchesSuccess = (savedMatches) => {
        setGeneratedMatches(matchesWithSchedule);
        setGeneratedSchedule(generatedSchedule);

        // Calculer l'heure de fin estimée
        const now = new Date();
        const endTime = new Date(now.getTime() + stats.totalDuration * 60000);

        // S'assurer que le nombre d'aires est correctement défini
        const numAreas =
          tournamentConfig && tournamentConfig.numAreas
            ? tournamentConfig.numAreas
            : 1;
        console.log(
          "Nombre d'aires de combat dans handleSaveMatchesSuccess:",
          numAreas
        );

        setScheduleStats({
          totalMatches: matchesWithSchedule.length,
          totalAreas: numAreas,
          estimatedDuration: stats.totalDuration,
          estimatedEndTime: endTime,
        });

        setError(null);
        setIsLoading(false);
        isLoadingOrGenerating.current = false;
      };

      // Fonction de gestion des erreurs
      const handleSaveError = (error) => {
        console.error("Erreur lors de la sauvegarde:", error);
        setError(`Erreur lors de la sauvegarde: ${error.message}`);
        setIsLoading(false);
        isLoadingOrGenerating.current = false;
      };
    } catch (err) {
      setError(`Erreur lors de la génération du planning: ${err.message}`);
      setIsLoading(false);
      isLoadingOrGenerating.current = false;
    }
  };

  // Fonction pour continuer vers l'étape suivante
  const handleContinue = () => {
    // Mettre à jour l'état global avec les matchs et le planning
    setMatches(generatedMatches);
    setSchedule(generatedSchedule);
    nextStep();
  };

  // Formatage de la durée en heures et minutes
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };

  // Formatage de l'heure
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Formatage de la date
  const formatDate = (date) => {
    return date.toLocaleDateString();
  };

  // Obtenir le nom du participant
  const getParticipantName = (matchInfo, position) => {
    try {
      // Si position est un nombre, convertir en position A ou B
      if (typeof position === "number") {
        position = position === 0 ? "A" : "B";
      }

      // Vérifier si nous avons des données de match
      if (!matchInfo) {
        console.log("getParticipantName: matchInfo est null ou undefined");
        return "-";
      }

      // Débogage: afficher la structure du match pour le premier appel
      if (position === "A" && !window._debuggedGetParticipantName) {
        console.log("Structure du match pour getParticipantName:", {
          id: matchInfo.id,
          hasMatchParticipants: !!matchInfo.matchParticipants,
          matchParticipantsLength: matchInfo.matchParticipants?.length,
          hasParticipants: !!matchInfo.participants,
          participantsLength: matchInfo.participants?.length,
        });
        window._debuggedGetParticipantName = true;
      }

      // Vérifier d'abord dans matchParticipants (structure DB)
      if (
        matchInfo.matchParticipants &&
        matchInfo.matchParticipants.length > 0
      ) {
        const participantData = matchInfo.matchParticipants.find(
          (p) => p.position === position
        );

        if (participantData && participantData.participant) {
          const participant = participantData.participant;
          return (
            `${participant.prenom || ""} ${participant.nom || ""}`.trim() || "-"
          );
        }
      }

      // Chercher ensuite dans la version avec position intégrée
      if (matchInfo.participants && matchInfo.participants.length > 0) {
        // Essayer d'abord avec la propriété position
        const participantWithPosition = matchInfo.participants.find(
          (p) => p.position === position
        );

        if (participantWithPosition) {
          return (
            `${participantWithPosition.prenom || ""} ${
              participantWithPosition.nom || ""
            }`.trim() || "-"
          );
        }

        // Fallback à l'ancienne méthode par index
        const participantIndex = position === "A" ? 0 : 1;
        if (participantIndex < matchInfo.participants.length) {
          const participant = matchInfo.participants[participantIndex];
          return (
            `${participant.prenom || ""} ${participant.nom || ""}`.trim() || "-"
          );
        }
      }

      // Si nous arrivons ici, aucun participant trouvé
      console.log(
        `Aucun participant trouvé pour la position ${position} dans le match ID: ${matchInfo.id}`
      );
      return "-";
    } catch (error) {
      console.error("Erreur lors de l'accès aux informations de nom:", error, {
        matchId: matchInfo?.id,
        position,
      });
      return "-";
    }
  };

  // Obtenir la ligue du participant
  const getParticipantLigue = (matchInfo, position) => {
    try {
      // Si position est un nombre (index), convertir en position A ou B
      if (typeof position === "number") {
        // Index 0 correspond à A (bleu), 1 correspond à B (rouge)
        position = position === 0 ? "A" : "B";
      }

      // Vérifier si nous avons des données de match
      if (!matchInfo) {
        return "-";
      }

      // Vérifier si nous avons la structure matchParticipants (version BD)
      if (
        matchInfo.matchParticipants &&
        matchInfo.matchParticipants.length > 0
      ) {
        const participantData = matchInfo.matchParticipants.find(
          (p) => p.position === position
        );

        if (participantData && participantData.participant) {
          const participant = participantData.participant;
          if (!participant.ligue && !participant.club) return "-";
          // Retourner le club si disponible, sinon la ligue
          return participant.club || participant.ligue || "-";
        }
      }

      // Sinon, utiliser l'ancienne structure participants (version mémoire)
      if (matchInfo.participants && matchInfo.participants.length > 0) {
        // Essayer d'abord avec la propriété position
        const participantWithPosition = matchInfo.participants.find(
          (p) => p.position === position
        );

        if (participantWithPosition) {
          // Si l'information est dans athleteInfo
          if (participantWithPosition.athleteInfo) {
            if (participantWithPosition.athleteInfo.club) {
              return participantWithPosition.athleteInfo.club;
            }
            if (participantWithPosition.athleteInfo.ligue) {
              return participantWithPosition.athleteInfo.ligue;
            }
          }
          // Si l'information est directement dans le participant
          if (participantWithPosition.club) {
            return participantWithPosition.club;
          }
          if (participantWithPosition.ligue) {
            return participantWithPosition.ligue;
          }
          return "-";
        }

        // Fallback à la méthode par index
        const participantIndex = position === "A" ? 0 : 1;
        const participant = matchInfo?.participants?.[participantIndex];
        if (!participant) {
          return "-";
        }

        // Si l'information est dans athleteInfo
        if (participant.athleteInfo) {
          if (participant.athleteInfo.club) {
            return participant.athleteInfo.club;
          }
          if (participant.athleteInfo.ligue) {
            return participant.athleteInfo.ligue;
          }
        }
        // Si l'information est directement dans le participant
        if (participant.club) {
          return participant.club;
        }
        if (participant.ligue) {
          return participant.ligue;
        }
      }

      return "-";
    } catch (error) {
      console.error(
        "Erreur lors de l'accès aux informations de ligue/club:",
        error,
        {
          matchId: matchInfo?.id,
          position,
        }
      );
      return "-";
    }
  };

  // Fonction pour récupérer directement les informations PSS d'un match par son numéro
  const fetchPssInfoByMatchNumber = async (matchNumber) => {
    try {
      console.log(
        `Récupération des informations PSS pour le match #${matchNumber}`
      );

      // Vérifier d'abord si nous avons déjà ces informations en cache
      if (matchesPssInfo[matchNumber]) {
        return matchesPssInfo[matchNumber];
      }

      // Rechercher le match dans le planning généré
      const scheduleItem = generatedSchedule.find(
        (item) => item.matchNumber === matchNumber
      );
      if (!scheduleItem || !scheduleItem.matchId) {
        console.log(`Match #${matchNumber} non trouvé dans le planning`);
        return null;
      }

      // Trouver le match correspondant
      const match = generatedMatches.find((m) => m.id === scheduleItem.matchId);
      if (!match) {
        console.log(`Match avec ID ${scheduleItem.matchId} non trouvé`);
        return null;
      }

      // Trouver le groupe correspondant
      const group = groups.find((g) => g.id === match.groupId);
      if (!group) {
        console.log(`Groupe avec ID ${match.groupId} non trouvé`);
        return null;
      }

      // Extraire les informations nécessaires
      const ageCategory = group.ageCategory?.name || group.ageCategoryName;
      const gender = group.gender;
      const weightCategory =
        group.weightCategory?.name || group.weightCategoryName;

      // Vérifier que nous avons toutes les informations nécessaires
      if (!ageCategory || !gender || !weightCategory) {
        console.log(`Informations manquantes pour le match #${matchNumber}:`, {
          ageCategory,
          gender,
          weightCategory,
        });
        return null;
      }

      // Essayer d'abord avec findPssInfo
      const pssInfo = findPssInfo(ageCategory, gender, weightCategory);

      // Stocker les informations en cache
      if (pssInfo) {
        setMatchesPssInfo((prev) => ({
          ...prev,
          [matchNumber]: pssInfo,
        }));
        console.log(
          `Informations PSS trouvées pour le match #${matchNumber}:`,
          pssInfo
        );
        return pssInfo;
      }

      // Fallback à findPowerThreshold
      const powerThreshold = findPowerThreshold(
        ageCategory,
        gender,
        weightCategory
      );
      if (powerThreshold) {
        setMatchesPssInfo((prev) => ({
          ...prev,
          [matchNumber]: powerThreshold,
        }));
        console.log(
          `Informations PSS trouvées via fallback pour le match #${matchNumber}:`,
          powerThreshold
        );
        return powerThreshold;
      }

      console.log(
        `Aucune information PSS trouvée pour le match #${matchNumber}`
      );
      return null;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des informations PSS pour le match #${matchNumber}:`,
        error
      );
      return null;
    }
  };

  // Obtenir les informations de seuil de puissance et de plastron pour un match
  const getPowerThresholdInfo = (match) => {
    try {
      if (!match) return null;

      // Trouver le numéro du match dans le planning
      const scheduleItem = generatedSchedule.find(
        (item) => item.matchId === match.id
      );
      if (!scheduleItem) return null;

      const matchNumber = scheduleItem.matchNumber;

      // Si nous avons déjà les informations en cache, les utiliser
      if (matchesPssInfo[matchNumber]) {
        return matchesPssInfo[matchNumber];
      }

      // Sinon, lancer une requête asynchrone pour les récupérer
      // Cette fonction ne retournera rien immédiatement, mais mettra à jour l'état quand les données seront disponibles
      fetchPssInfoByMatchNumber(matchNumber);

      return null;
    } catch (error) {
      console.error(
        "Erreur lors de l'obtention des informations de seuil PSS:",
        error
      );
      return null;
    }
  };

  // Génération du fichier PDF
  const handleGeneratePDF = () => {
    try {
      setExportLoading((prev) => ({ ...prev, pdf: true }));

      // Créer un nouveau document PDF
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;

      // Ajouter un titre
      doc.setFontSize(18);
      doc.text(competitionName || "Tournoi de Taekwondo", pageWidth / 2, 20, {
        align: "center",
      });

      // Ajouter la date du jour
      const today = new Date();
      doc.setFontSize(12);
      doc.text(`Planning généré le ${formatDate(today)}`, pageWidth / 2, 30, {
        align: "center",
      });

      // Résumé du tournoi
      doc.setFontSize(10);
      const summaryText = [
        `Total des combats: ${scheduleStats.totalMatches}`,
        `Nombre d'aires: ${scheduleStats.totalAreas}`,
        `Durée estimée: ${formatDuration(scheduleStats.estimatedDuration)}`,
        `Fin estimée: ${formatTime(
          scheduleStats.estimatedEndTime
        )} (si démarrage immédiat)`,
      ];
      doc.text(summaryText, pageWidth - margin, 40, { align: "right" });

      // En-tête de logo si disponible (à implémenter si nécessaire)
      // doc.addImage('path/to/logo.png', 'PNG', margin, 10, 30, 15);

      let yPosition = 50;
      const chunkSize = 15; // Nombre de lignes par bloc d'affichage

      // Organisation des données pour le PDF
      let pdfData = [];

      // Si l'affichage est par aire
      if (viewMode === "byArea") {
        // Par défaut, génération par aire car c'est le format le plus utile pour les arbitres
        for (
          let areaNumber = 1;
          areaNumber <= tournamentConfig.numAreas;
          areaNumber++
        ) {
          // Filtrer le planning pour cette aire
          const areaItems = generatedSchedule
            .filter((item) => item.areaNumber === areaNumber)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

          if (areaItems.length === 0) continue;

          // Titre de l'aire
          yPosition += 10;
          doc.setFontSize(14);
          doc.text(`Aire ${areaNumber}`, margin, yPosition);
          yPosition += 5;

          // Préparation des données du tableau
          const tableData = [];
          for (const item of areaItems) {
            if (item.type === "break") {
              tableData.push([
                "-",
                formatTime(new Date(item.startTime)),
                `PAUSE (${tournamentConfig.breakDuration} min)`,
                "",
                "",
                "",
                "",
                "",
              ]);
              continue;
            }

            // Trouver le match correspondant
            const match = generatedMatches.find((m) => m.id === item.matchId);
            if (!match) continue;

            // Trouver le groupe correspondant
            const group = groups.find((g) => g.id === match.groupId);
            if (!group) continue;

            // Préparation des données du match
            const groupText = `${group.gender === "male" ? "H" : "F"} ${
              group.ageCategory?.name || ""
            } ${group.weightCategory?.name || ""}`;

            const poolText =
              match.poolIndex !== undefined ? match.poolIndex + 1 : "-";

            const blueAthlete = getParticipantName(match, "A");
            const redAthlete = getParticipantName(match, "B");

            // Récupérer les informations de seuil de puissance
            const powerInfo = getPowerThresholdInfo(match);
            const plastronText = powerInfo ? powerInfo.pss : "-";
            const hitLevelText = powerInfo ? powerInfo.hitLevel : "-";

            tableData.push([
              item.matchNumber,
              formatTime(new Date(item.startTime)),
              groupText,
              poolText,
              blueAthlete,
              redAthlete,
              "Combat",
              plastronText,
              hitLevelText,
            ]);
          }

          // Diviser les données en chunks si nécessaire pour les grandes aires
          const dataChunks = [];
          for (let i = 0; i < tableData.length; i += chunkSize) {
            dataChunks.push(tableData.slice(i, i + chunkSize));
          }

          for (
            let chunkIndex = 0;
            chunkIndex < dataChunks.length;
            chunkIndex++
          ) {
            const chunk = dataChunks[chunkIndex];

            if (yPosition > pageHeight - 50) {
              // Nouvelle page
              doc.addPage();
              yPosition = 20;
              doc.setFontSize(12);
              doc.text(`Aire ${areaNumber} (suite)`, margin, yPosition);
              yPosition += 10;
            }

            // Générer le tableau pour ce chunk
            doc.setFontSize(9);
            autoTable(doc, {
              startY: yPosition,
              head: [
                [
                  "N°",
                  "Horaire",
                  "Catégorie",
                  "Poule",
                  "Athlète BLEU",
                  "Athlète ROUGE",
                  "Type",
                  "Plastron",
                  "Niveau de Frappe",
                ],
              ],
              body: chunk,
              theme: "grid",
              styles: {
                fontSize: 8,
                cellPadding: 2,
              },
              columnStyles: {
                0: { cellWidth: 10 }, // N°
                1: { cellWidth: 20 }, // Horaire
                2: { cellWidth: 30 }, // Catégorie
                3: { cellWidth: 15 }, // Poule
                4: { cellWidth: 35 }, // Athlète BLEU
                5: { cellWidth: 35 }, // Athlète ROUGE
                6: { cellWidth: 20 }, // Type
                7: { cellWidth: 25 }, // Plastron
                8: { cellWidth: 25 }, // Niveau de Frappe
              },
              headStyles: {
                fillColor: [66, 66, 66],
              },
            });

            yPosition = (doc.lastAutoTable.finalY || yPosition) + 15;
          }

          // Espace entre les aires
          yPosition += 10;
        }
      }

      // Numéro de page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} sur ${pageCount}`, pageWidth / 2, pageHeight - 10, {
          align: "center",
        });
      }

      // Télécharger le PDF
      doc.save(
        `Planning_${competitionName || "Tournoi"}_${formatDate(today).replace(
          /\//g,
          "-"
        )}.pdf`
      );
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert(
        "Une erreur est survenue lors de la génération du PDF. Veuillez réessayer."
      );
    } finally {
      setExportLoading((prev) => ({ ...prev, pdf: false }));
    }
  };

  // Génération du fichier CSV
  const handleGenerateCSV = () => {
    try {
      setExportLoading((prev) => ({ ...prev, csv: true }));

      console.log("Début de l'exportation CSV");
      console.log("Nombre de matchs générés:", generatedMatches.length);
      console.log("Nombre d'éléments de planning:", generatedSchedule.length);
      console.log("Nombre d'aires de combat:", tournamentConfig.numAreas);

      // Vérifier que nous avons des données à exporter
      if (!generatedSchedule || generatedSchedule.length === 0) {
        alert(
          "Aucun planning disponible. Veuillez d'abord générer le planning des matchs."
        );
        setExportLoading((prev) => ({ ...prev, csv: false }));
        return;
      }

      if (!generatedMatches || generatedMatches.length === 0) {
        alert(
          "Aucun match disponible. Veuillez d'abord générer le planning des matchs."
        );
        setExportLoading((prev) => ({ ...prev, csv: false }));
        return;
      }

      // Préparation des en-têtes CSV
      const headers = [
        "N° Combat",
        "Aire",
        "Horaire",
        "Catégorie",
        "Poule",
        "Athlète BLEU",
        "Athlète ROUGE",
        "Plastron",
        "Niveau de Frappe",
      ];

      // Préparation des données
      let csvContent = headers.join(",") + "\n";

      // Si la vue est par aire
      if (viewMode === "byArea") {
        // Par défaut, génération par aire car c'est le format le plus utile
        for (
          let areaNumber = 1;
          areaNumber <= tournamentConfig.numAreas;
          areaNumber++
        ) {
          // Filtrer le planning pour cette aire
          const areaItems = generatedSchedule
            .filter((item) => item.areaNumber === areaNumber)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

          for (const item of areaItems) {
            if (item.type === "break") {
              csvContent += `"-",${areaNumber},"${formatTime(
                new Date(item.startTime)
              )}","PAUSE (${
                tournamentConfig.breakDuration
              } min)","","","","",""\n`;
              continue;
            }

            // Trouver le match correspondant
            const match = generatedMatches.find((m) => m.id === item.matchId);
            if (!match) continue;

            // Trouver le groupe correspondant
            const group = groups.find((g) => g.id === match.groupId);
            if (!group) continue;

            // Préparation des données du match
            const groupText = `${group.gender === "male" ? "H" : "F"} ${
              group.ageCategory?.name || ""
            } ${group.weightCategory?.name || ""}`;

            const poolText =
              match.poolIndex !== undefined ? match.poolIndex + 1 : "-";

            const blueAthlete = getParticipantName(match, "A");
            const redAthlete = getParticipantName(match, "B");

            // Récupérer les informations de seuil de puissance
            const powerInfo = getPowerThresholdInfo(match);
            const plastronText = powerInfo ? powerInfo.pss : "-";
            const hitLevelText = powerInfo ? powerInfo.hitLevel : "-";

            // Échapper les virgules dans les textes
            csvContent += `${item.matchNumber},${areaNumber},"${formatTime(
              new Date(item.startTime)
            )}","${groupText}","${poolText}","${blueAthlete.replace(
              /"/g,
              '""'
            )}","${redAthlete.replace(
              /"/g,
              '""'
            )}","${plastronText}","${hitLevelText}"\n`;
          }
        }
      }

      // Création d'un objet Blob pour le téléchargement
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Planning_${
          competitionName ? competitionName.replace(/\s+/g, "_") : "Tournoi"
        }_${formatDate(new Date()).replace(/\//g, "-")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erreur lors de la génération du CSV:", error);
      alert(
        "Une erreur est survenue lors de la génération du CSV. Veuillez réessayer."
      );
    } finally {
      setExportLoading((prev) => ({ ...prev, csv: false }));
    }
  };

  // Ajouter une fonction pour filtrer les matchs selon les critères
  const filterMatches = (match, scheduleItem) => {
    // Si nous n'avons pas de match valide, retourner false
    if (!match) {
      // Si c'est une pause, on l'accepte quand même
      return scheduleItem.type === "break";
    }

    // Si l'aire est filtrée et ne correspond pas, ne pas afficher
    if (
      areaFilter !== "all" &&
      scheduleItem.areaNumber !== parseInt(areaFilter)
    ) {
      return false;
    }

    // Recherche par nom d'athlète ou par ligue
    if (searchTerm || ligueFilter) {
      let participantMatchFound = false;
      let ligueMatchFound = false;

      // Cas 1: Vérifier dans la structure matchParticipants (version BD)
      if (match.matchParticipants && match.matchParticipants.length > 0) {
        // Filtrer par terme de recherche (nom ou prénom)
        if (searchTerm) {
          const searchTermLower = searchTerm.toLowerCase();
          participantMatchFound = match.matchParticipants.some((mp) => {
            const participant = mp.participant;
            if (!participant) return false;

            return (
              (participant.nom &&
                participant.nom.toLowerCase().includes(searchTermLower)) ||
              (participant.prenom &&
                participant.prenom.toLowerCase().includes(searchTermLower))
            );
          });

          if (searchTerm && !participantMatchFound) {
            return false;
          }
        } else {
          participantMatchFound = true;
        }

        // Filtrer par ligue
        if (ligueFilter) {
          const ligueFilterLower = ligueFilter.toLowerCase();
          ligueMatchFound = match.matchParticipants.some((mp) => {
            const participant = mp.participant;
            if (!participant || !participant.ligue) return false;

            return participant.ligue.toLowerCase().includes(ligueFilterLower);
          });

          if (ligueFilter && !ligueMatchFound) {
            return false;
          }
        } else {
          ligueMatchFound = true;
        }
      }
      // Cas 2: Vérifier dans la structure participants (version mémoire)
      else if (match.participants && match.participants.length > 0) {
        // Filtrer par terme de recherche (nom ou prénom)
        if (searchTerm) {
          const searchTermLower = searchTerm.toLowerCase();
          participantMatchFound = match.participants.some(
            (p) =>
              (p.nom && p.nom.toLowerCase().includes(searchTermLower)) ||
              (p.prenom && p.prenom.toLowerCase().includes(searchTermLower))
          );

          if (searchTerm && !participantMatchFound) {
            return false;
          }
        } else {
          participantMatchFound = true;
        }

        // Filtrer par ligue
        if (ligueFilter) {
          const ligueFilterLower = ligueFilter.toLowerCase();
          ligueMatchFound = match.participants.some((p) => {
            // Vérifier si la ligue est dans athleteInfo
            if (p.athleteInfo && p.athleteInfo.ligue) {
              return p.athleteInfo.ligue
                .toLowerCase()
                .includes(ligueFilterLower);
            }
            // Ou directement dans le participant
            else if (p.ligue) {
              return p.ligue.toLowerCase().includes(ligueFilterLower);
            }
            return false;
          });

          if (ligueFilter && !ligueMatchFound) {
            return false;
          }
        } else {
          ligueMatchFound = true;
        }
      }
      // Si aucune structure de participants n'existe, retourner false
      else if (searchTerm || ligueFilter) {
        return false;
      }

      // Si on arrive ici et qu'il y avait des filtres, vérifions si on a trouvé des correspondances
      if (
        (searchTerm && !participantMatchFound) ||
        (ligueFilter && !ligueMatchFound)
      ) {
        return false;
      }
    }

    return true;
  };

  // Ajouter la section de filtres avant le rendu de la vue
  const renderFilters = () => {
    // Déterminer le nombre réel d'aires utilisées dans le planning
    const usedAreas = new Set();
    generatedSchedule.forEach((item) => {
      if (item.areaNumber) {
        usedAreas.add(item.areaNumber);
      }
    });

    // Convertir en array et trier numériquement
    const usedAreasArray = Array.from(usedAreas).sort((a, b) => a - b);

    // S'assurer que nous avons au moins le nombre d'aires configurées
    const configuredAreas = tournamentConfig.numAreas || 0;
    const maxAreaNumber = Math.max(...usedAreasArray, configuredAreas);

    // Créer un tableau allant de 1 jusqu'au numéro d'aire maximal
    const allAreas = Array.from({ length: maxAreaNumber }, (_, i) => i + 1);

    console.log("Aires dans le planning:", usedAreasArray);
    console.log("Nombre d'aires configurées:", configuredAreas);
    console.log("Toutes les aires disponibles pour le filtre:", allAreas);

    return (
      <div className="filters-container">
        <div className="filter-group">
          <label htmlFor="areaFilter">Aire:</label>
          <select
            id="areaFilter"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="all">Toutes les aires</option>
            {allAreas.map((areaNum) => (
              <option key={areaNum} value={areaNum}>
                Aire {areaNum}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="displayMode">Affichage:</label>
          <select
            id="displayMode"
            value={displayAllAreas ? "all" : "filtered"}
            onChange={(e) => setDisplayAllAreas(e.target.value === "all")}
          >
            <option value="all">Toutes les aires</option>
            <option value="filtered">Aires filtrées uniquement</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="searchTerm">Recherche par nom:</label>
          <input
            type="text"
            id="searchTerm"
            placeholder="Nom ou prénom de l'athlète..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="ligueFilter">Recherche par ligue:</label>
          <input
            type="text"
            id="ligueFilter"
            placeholder="Nom de la ligue..."
            value={ligueFilter}
            onChange={(e) => setLigueFilter(e.target.value)}
          />
        </div>
      </div>
    );
  };

  const renderScheduleView = () => {
    // Vérifier si nous avons des matchs valides
    if (generatedMatches.length === 0 || generatedSchedule.length === 0) {
      return (
        <div className="no-matches">
          <p>Aucun match planifié. Veuillez générer un planning.</p>
        </div>
      );
    }

    // Calculer la distribution des matchs par aire pour l'affichage du résumé
    const matchesByArea = {};
    generatedSchedule.forEach((item) => {
      if (!matchesByArea[item.areaNumber]) {
        matchesByArea[item.areaNumber] = 0;
      }
      matchesByArea[item.areaNumber]++;
    });

    return (
      <div className="schedule-view">
        <h3>Planning par aires de combat</h3>

        {/* Afficher un résumé des matchs par aire */}
        <div className="area-summary">
          {Object.entries(matchesByArea).map(([area, count]) => (
            <span key={area} className="area-count">
              Aire {area}: {count} matchs
            </span>
          ))}
        </div>

        {/* Modifions la façon dont nous itérons sur les aires pour s'assurer qu'elles sont toutes visibles */}
        {Array.from({ length: tournamentConfig.numAreas }).map(
          (_, areaIndex) => {
            const areaNumber = areaIndex + 1;

            // Si on n'affiche pas toutes les aires et que l'aire n'est pas celle filtrée, passer
            if (
              !displayAllAreas &&
              areaFilter !== "all" &&
              areaNumber !== parseInt(areaFilter)
            ) {
              return null;
            }

            // Récupérer tous les matchs pour cette aire
            const areaScheduleItems = generatedSchedule.filter(
              (item) => item.areaNumber === areaNumber
            );

            // Déterminer lesquels doivent être affichés selon les filtres
            const filteredAreaScheduleItems = areaScheduleItems
              .filter((scheduleItem) => {
                const matchDetails = generatedMatches.find(
                  (m) => m.id === scheduleItem.matchId
                );
                return filterMatches(matchDetails, scheduleItem);
              })
              .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            return (
              <div key={areaIndex} className="area-schedule">
                <h4>
                  Aire {areaNumber} ({filteredAreaScheduleItems.length} matchs)
                </h4>

                {filteredAreaScheduleItems.length === 0 ? (
                  <div className="no-matches-for-area">
                    <p>
                      Aucun match ne correspond aux critères de filtrage pour
                      cette aire.
                    </p>
                  </div>
                ) : (
                  <table className="matches-table">
                    <thead>
                      <tr>
                        <th>N° Combat</th>
                        <th>Horaire</th>
                        <th>Groupe</th>
                        <th>Poule</th>
                        <th>Athlète BLEU</th>
                        <th>Athlète ROUGE</th>
                        <th>Type</th>
                        <th>Seuils PSS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAreaScheduleItems.map(
                        (scheduleItem, scheduleIndex) => {
                          // Trouver le match correspondant
                          const match = generatedMatches.find(
                            (m) => m.id === scheduleItem.matchId
                          );

                          if (!match && scheduleItem.type === "break") {
                            return (
                              <tr
                                key={`break-${scheduleIndex}`}
                                className="break-row"
                              >
                                <td colSpan="8">
                                  Pause ({tournamentConfig.breakDuration} min) -
                                  {formatTime(new Date(scheduleItem.startTime))}{" "}
                                  à {formatTime(new Date(scheduleItem.endTime))}
                                </td>
                              </tr>
                            );
                          }

                          if (!match) {
                            console.log(
                              `Match introuvable pour scheduleItem ${scheduleIndex}, ID: ${scheduleItem.matchId}`
                            );
                            return null;
                          }

                          // Afficher des infos de débogage pour ce match
                          if (scheduleIndex === 0) {
                            console.log("Structure du premier match:", {
                              matchId: match.id,
                              hasMatchParticipants: !!match.matchParticipants,
                              matchParticipantsLength:
                                match.matchParticipants?.length,
                              hasParticipants: !!match.participants,
                              participantsLength: match.participants?.length,
                            });
                          }

                          // Obtenir les noms des participants
                          const blueAthleteName = getParticipantName(
                            match,
                            "A"
                          );
                          const redAthleteName = getParticipantName(match, "B");

                          // Débogage si les noms sont manquants
                          if (
                            blueAthleteName === "-" ||
                            redAthleteName === "-"
                          ) {
                            console.log(
                              `Noms d'athlètes manquants dans le match ${scheduleItem.matchNumber}:`,
                              {
                                bleu: blueAthleteName,
                                rouge: redAthleteName,
                                matchId: match.id,
                                hasMatchParticipants: !!match.matchParticipants,
                                hasParticipants: !!match.participants,
                              }
                            );
                          }

                          // Trouver le groupe correspondant
                          const group = groups.find(
                            (g) => g.id === match.groupId
                          );

                          // Récupérer les informations de seuil de puissance
                          const powerInfo = getPowerThresholdInfo(match);

                          return (
                            <tr key={scheduleIndex}>
                              <td>{scheduleItem.matchNumber}</td>
                              <td>
                                {formatTime(new Date(scheduleItem.startTime))}
                              </td>
                              <td>
                                {group
                                  ? `${group.gender === "male" ? "H" : "F"} ${
                                      group.ageCategory?.name || ""
                                    } ${group.weightCategory?.name || ""}`
                                  : "-"}
                              </td>
                              <td>
                                {match.poolIndex !== undefined
                                  ? match.poolIndex + 1
                                  : "-"}
                              </td>
                              <td className="blue-athlete">
                                {blueAthleteName}
                              </td>
                              <td className="red-athlete">{redAthleteName}</td>
                              <td>Combat</td>
                              <td className="pss-info">
                                {powerInfo ? (
                                  <>
                                    <span className="pss-body">
                                      {powerInfo.pss}
                                    </span>
                                    <span className="pss-level">
                                      Niveau {powerInfo.hitLevel}
                                    </span>
                                  </>
                                ) : (
                                  <span>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            );
          }
        )}
      </div>
    );
  };

  // Ajouter un bouton pour forcer la régénération si nécessaire
  const handleForceRegenerate = async () => {
    if (
      window.confirm(
        "ATTENTION: Vous êtes sur le point de supprimer tous les matchs existants et d'en générer de nouveaux. Cette action est irréversible et supprimera tous les résultats de matchs déjà saisis. Voulez-vous vraiment continuer?"
      )
    ) {
      // Vérifier si une génération est déjà en cours
      if (isLoadingOrGenerating.current) {
        console.log("Génération déjà en cours, opération ignorée");
        return;
      }

      isLoadingOrGenerating.current = true;
      setIsLoading(true);

      try {
        // Supprimer d'abord les matchs existants
        const deleteResponse = await fetch(
          `${API_URL}/match/deleteByCompetition/${competitionId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (deleteResponse.ok) {
          const result = await deleteResponse.json();

          setMatchesAlreadyLoaded(false);
          setGeneratedMatches([]);
          setGeneratedSchedule([]);

          // Après avoir supprimé les matchs, générer de nouveaux matchs
          const allMatches = generateMatches(groups);

          // Créer le planning des combats
          const {
            schedule: generatedSchedule,
            updatedMatches,
            stats,
          } = createSchedule(allMatches, tournamentConfig);

          // Sauvegarder les nouveaux matchs
          await handleSaveNewMatches(
            allMatches,
            updatedMatches,
            generatedSchedule,
            stats
          );

          setMatchesAlreadyLoaded(true);
        } else {
          console.error(
            "Erreur lors de la suppression des matchs:",
            deleteResponse.status
          );
          setError(
            `Erreur lors de la suppression des matchs: ${deleteResponse.statusText}`
          );
          setIsLoading(false);
          isLoadingOrGenerating.current = false;
        }
      } catch (error) {
        console.error("Erreur lors de la régénération des matchs:", error);
        setError(`Erreur lors de la régénération des matchs: ${error.message}`);
        setIsLoading(false);
        isLoadingOrGenerating.current = false;
      }
    }
  };

  // Fonction pour sauvegarder de nouveaux matchs générés
  const handleSaveNewMatches = async (
    allMatches,
    updatedMatches,
    schedule,
    stats
  ) => {
    try {
      // Au lieu de sauvegarder les groupes à chaque fois, vérifier d'abord s'ils existent déjà
      const existingGroupsResult = await checkExistingGroupsAndPools(
        competitionId
      );

      let savedGroups = [];
      if (
        existingGroupsResult.exists &&
        existingGroupsResult.groups &&
        existingGroupsResult.groups.length > 0
      ) {
        savedGroups = existingGroupsResult.groups;
      } else {
        // Si les groupes n'existent pas, les sauvegarder d'abord
        const savedGroupsResult = await saveGroupsAndPools(
          competitionId,
          groups
        );
        savedGroups = savedGroupsResult.savedGroups || [];
      }

      // Mettre à jour les IDs des groupes dans les matchs
      const matchesWithNumbers = updatedMatches.map((match) => {
        const scheduledMatch = schedule.find((s) => s.matchId === match.id);
        if (scheduledMatch) {
          return {
            ...match,
            number: scheduledMatch.matchNumber,
            areaNumber: scheduledMatch.areaNumber,
            startTime: scheduledMatch.startTime,
          };
        }
        return match;
      });

      // Organiser les matchs par poule
      const poolMap = new Map();
      matchesWithNumbers.forEach((match) => {
        if (!match.groupId || !Array.isArray(groups)) {
          return;
        }

        const originalGroup = groups.find((g) => g.id === match.groupId);
        if (!originalGroup) {
          return;
        }

        const savedGroup = savedGroups.find(
          (sg) =>
            sg &&
            sg.gender === originalGroup.gender &&
            sg.ageCategoryName === originalGroup.ageCategory.name &&
            sg.weightCategoryName === originalGroup.weightCategory.name
        );

        if (!savedGroup) {
          return;
        }

        const key = `${savedGroup.id}-${match.poolIndex}`;
        if (!poolMap.has(key)) {
          poolMap.set(key, []);
        }

        // Mettre à jour l'ID du groupe
        poolMap.get(key).push({
          ...match,
          groupId: savedGroup.id,
        });
      });

      // Récupérer les pools pour chaque groupe
      const matchesByPool = [];
      for (const group of savedGroups) {
        try {
          const poolsResponse = await fetch(
            `${API_URL}/group/${group.id}/pools`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (poolsResponse.ok) {
            const pools = await poolsResponse.json();

            pools.forEach((pool) => {
              const matches = poolMap.get(`${group.id}-${pool.poolIndex}`);
              if (matches && matches.length > 0) {
                matchesByPool.push({
                  poolId: pool.id,
                  matches: matches,
                });
              }
            });
          }
        } catch (error) {
          console.error(
            `Erreur lors de la récupération des pools pour le groupe ${group.id}:`,
            error
          );
        }
      }

      // Sauvegarder les matchs
      if (matchesByPool.length > 0) {
        const savedMatches = await saveGeneratedMatches(
          competitionId,
          matchesByPool
        );

        setGeneratedMatches(updatedMatches);
        setGeneratedSchedule(schedule);

        // Calculer l'heure de fin estimée
        const now = new Date();
        const endTime = new Date(now.getTime() + stats.totalDuration * 60000);

        // S'assurer que le nombre d'aires est correctement défini
        const numAreas =
          tournamentConfig && tournamentConfig.numAreas
            ? tournamentConfig.numAreas
            : 1;
        console.log(
          "Nombre d'aires de combat dans handleSaveNewMatches:",
          numAreas
        );

        setScheduleStats({
          totalMatches: updatedMatches.length,
          totalAreas: numAreas,
          estimatedDuration: stats.totalDuration,
          estimatedEndTime: endTime,
        });

        setError(null);
      } else {
        setError(
          "Aucun match à sauvegarder. Vérifiez que les poules ont été correctement configurées."
        );
      }

      setIsLoading(false);
      isLoadingOrGenerating.current = false;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des nouveaux matchs:", error);
      setError(
        `Erreur lors de la sauvegarde des nouveaux matchs: ${error.message}`
      );
      setIsLoading(false);
      isLoadingOrGenerating.current = false;
    }
  };

  // Précharger les informations PSS pour les matchs visibles
  useEffect(() => {
    if (generatedSchedule.length > 0 && generatedMatches.length > 0) {
      console.log("Préchargement des informations PSS pour les matchs");
      // Limiter à un nombre raisonnable pour éviter trop de requêtes
      const matchesToPreload = 20;
      let count = 0;

      // Traiter d'abord les matchs qui seront affichés en premier
      for (const scheduleItem of generatedSchedule) {
        if (
          scheduleItem.type === "match" &&
          scheduleItem.matchNumber &&
          count < matchesToPreload
        ) {
          fetchPssInfoByMatchNumber(scheduleItem.matchNumber);
          count++;
        }

        if (count >= matchesToPreload) break;
      }
    }
  }, [generatedSchedule, generatedMatches]);

  const styles = `
    .match-schedule-container {
      padding: 20px;
      max-width: 100%;
      overflow-x: auto;
    }

    .alert {
      padding: 12px 20px;
      margin-bottom: 20px;
      border-radius: 4px;
      position: relative;
    }

    .alert-info {
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }

    .alert-warning {
      background-color: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
    }

    .alert-success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .close-btn {
      position: absolute;
      top: 10px;
      right: 15px;
      cursor: pointer;
      background: none;
      border: none;
      font-size: 18px;
      font-weight: bold;
      color: inherit;
    }

    .tabs {
      display: flex;
      margin-bottom: 10px;
    }
  `;

  return (
    <div className="match-schedule-container">
      <style>{styles}</style>
      <h2>Étape 4: Planning des combats</h2>

      {/* Afficher le message d'information s'il existe */}
      {info && (
        <div className={`alert alert-${info.type}`}>
          <p>{info.message}</p>
          <button className="close-btn" onClick={() => setInfo(null)}>
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="loading">
          <p>
            {dataSource === "existing"
              ? "Chargement des matchs existants..."
              : "Génération du planning des combats en cours..."}
          </p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadOrGenerateMatchSchedule} className="retry-btn">
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {generatedMatches.length === 0 ? (
            <div className="no-matches-container">
              <div className="info-message">
                <p>Aucun match n'a encore été généré pour cette compétition.</p>
                <p>
                  Vous devez d'abord générer les matchs pour pouvoir les
                  visualiser et les planifier.
                </p>
              </div>
              <button
                onClick={handleGenerateSchedule}
                className="generate-btn primary-btn"
              >
                Générer les matchs
              </button>
            </div>
          ) : (
            <>
              <div className="schedule-stats">
                <h3>Résumé du planning</h3>
                <p>Nombre total de combats: {scheduleStats.totalMatches}</p>
                <p>Nombre d'aires de combat: {scheduleStats.totalAreas}</p>
                <p>
                  Durée estimée:{" "}
                  {formatDuration(scheduleStats.estimatedDuration)}
                </p>
                <p>
                  Heure de fin estimée:{" "}
                  {formatTime(scheduleStats.estimatedEndTime)}
                </p>
                {dataSource === "existing" && (
                  <p className="info">
                    Les matchs ont été chargés depuis la base de données.
                  </p>
                )}

                <div className="export-buttons">
                  <button
                    className="export-btn pdf-btn"
                    onClick={handleGeneratePDF}
                    disabled={
                      exportLoading.pdf || generatedMatches.length === 0
                    }
                  >
                    {exportLoading.pdf ? "Génération..." : "Générer PDF"}
                  </button>
                  <button
                    className="export-btn csv-btn"
                    onClick={handleGenerateCSV}
                    disabled={
                      exportLoading.csv || generatedMatches.length === 0
                    }
                  >
                    {exportLoading.csv ? "Génération..." : "Générer CSV"}
                  </button>
                  {dataSource === "existing" && (
                    <button
                      className="danger-btn"
                      onClick={handleForceRegenerate}
                    >
                      Régénérer les matchs
                    </button>
                  )}
                </div>
              </div>

              <div className="view-selector">
                <button
                  className={`view-btn ${
                    viewMode === "byGroup" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("byGroup")}
                >
                  Vue par groupe
                </button>
                <button
                  className={`view-btn ${
                    viewMode === "byArea" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("byArea")}
                >
                  Vue par aire
                </button>
              </div>

              {viewMode === "byArea" && renderFilters()}

              {viewMode === "byGroup" ? (
                <div className="groups-matches">
                  <h3>Combats par groupe</h3>

                  {groups.map((group, groupIndex) => (
                    <div key={groupIndex} className="group-matches">
                      <h4>
                        Groupe: {group.gender === "male" ? "Hommes" : "Femmes"}{" "}
                        {group.ageCategory.name} {group.weightCategory.name}
                      </h4>

                      {group.pools.map((pool, poolIndex) => (
                        <div key={poolIndex} className="pool-matches">
                          <h5>Poule {poolIndex + 1}</h5>

                          <table className="matches-table">
                            <thead>
                              <tr>
                                <th>N° Combat</th>
                                <th>Athlète BLEU</th>
                                <th>Athlète ROUGE</th>
                                <th>Aire</th>
                                <th>Horaire prévu</th>
                                <th>Seuils PSS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {generatedMatches
                                .filter(
                                  (match) =>
                                    match.groupId === group.id &&
                                    match.poolIndex === poolIndex
                                )
                                .map((match, matchIndex) => {
                                  // Trouver le combat dans le planning
                                  const scheduledMatch = generatedSchedule.find(
                                    (s) => s.matchId === match.id
                                  );

                                  // Récupérer les informations de seuil de puissance
                                  const powerInfo =
                                    getPowerThresholdInfo(match);

                                  return (
                                    <tr key={matchIndex}>
                                      <td>
                                        {scheduledMatch
                                          ? scheduledMatch.matchNumber
                                          : "-"}
                                      </td>
                                      <td className="blue-athlete">
                                        {getParticipantName(match, "A")}
                                      </td>
                                      <td className="red-athlete">
                                        {getParticipantName(match, "B")}
                                      </td>
                                      <td>
                                        {scheduledMatch
                                          ? scheduledMatch.areaNumber
                                          : "-"}
                                      </td>
                                      <td>
                                        {scheduledMatch
                                          ? formatTime(
                                              new Date(scheduledMatch.startTime)
                                            )
                                          : "-"}
                                      </td>
                                      <td className="pss-info">
                                        {powerInfo ? (
                                          <>
                                            <span className="pss-body">
                                              {powerInfo.pss}
                                            </span>
                                            <span className="pss-level">
                                              Niveau {powerInfo.hitLevel}
                                            </span>
                                          </>
                                        ) : (
                                          <span>-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="areas-view">
                  <h3>Planning par aires de combat</h3>

                  {/* Afficher un résumé des matchs par aire */}
                  <div className="area-summary">
                    {Object.entries(
                      generatedSchedule.reduce((acc, item) => {
                        if (!acc[item.areaNumber]) acc[item.areaNumber] = 0;
                        acc[item.areaNumber]++;
                        return acc;
                      }, {})
                    ).map(([area, count]) => (
                      <span key={area} className="area-count">
                        Aire {area}: {count} matchs
                      </span>
                    ))}
                  </div>

                  {/* CORRECTION: Affichage de débogage supplémentaire */}
                  {generatedSchedule.length === 0 && (
                    <div className="debug-info">
                      <p>
                        Aucun élément de planning trouvé. Ceci peut indiquer un
                        problème de chargement des données.
                      </p>
                    </div>
                  )}

                  {/* CORRECTION: Vérifier si nous avons des données valides avant de filtrer */}
                  {generatedMatches.length === 0 && (
                    <div className="debug-info">
                      <p>
                        Aucun match trouvé. Ceci peut indiquer un problème de
                        génération ou de chargement des matchs.
                      </p>
                    </div>
                  )}

                  {/* NOUVELLE APPROCHE: Afficher tous les matchs par aire, sans filtrage complexe pour déboguer */}
                  {(dataSource === "existing" || generatedMatches.length > 0) &&
                    Array.from({
                      length: Math.max(tournamentConfig.numAreas, 1),
                    }).map((_, areaIndex) => {
                      const areaNumber = areaIndex + 1;

                      // Si on n'affiche pas toutes les aires et que l'aire n'est pas celle filtrée, passer
                      if (
                        !displayAllAreas &&
                        areaFilter !== "all" &&
                        areaNumber !== parseInt(areaFilter)
                      ) {
                        return null;
                      }

                      // CORRECTION: Trouver d'abord les éléments de planning pour cette aire spécifique
                      const areaScheduleItems = generatedSchedule.filter(
                        (item) => item.areaNumber === areaNumber
                      );
                      console.log(
                        `Aire ${areaNumber}: ${areaScheduleItems.length} matchs trouvés`
                      );

                      // CORRECTION: Ensuite, pour chaque élément de planning, trouver le match correspondant
                      const matchesForArea = areaScheduleItems
                        .map((scheduleItem) => {
                          const match = generatedMatches.find(
                            (m) => m.id === scheduleItem.matchId
                          );
                          return {
                            scheduleItem,
                            match,
                          };
                        })
                        .filter((item) => {
                          // Filtrage de base: ne garder que les matchs valides ou les pauses
                          if (!item.match)
                            return item.scheduleItem.type === "break";

                          // Filtrage par nom si nécessaire
                          if (searchTerm) {
                            const searchTermLower = searchTerm.toLowerCase();
                            if (
                              !item.match.participants ||
                              !item.match.participants.some(
                                (p) =>
                                  (p.nom &&
                                    p.nom
                                      .toLowerCase()
                                      .includes(searchTermLower)) ||
                                  (p.prenom &&
                                    p.prenom
                                      .toLowerCase()
                                      .includes(searchTermLower))
                              )
                            ) {
                              return false;
                            }
                          }

                          // Filtrage par ligue si nécessaire
                          if (ligueFilter) {
                            const ligueFilterLower = ligueFilter.toLowerCase();
                            if (
                              !item.match.participants ||
                              !item.match.participants.some(
                                (p) =>
                                  p.ligue &&
                                  p.ligue
                                    .toLowerCase()
                                    .includes(ligueFilterLower)
                              )
                            ) {
                              return false;
                            }
                          }

                          return true;
                        });

                      console.log(
                        `Aire ${areaNumber}: ${matchesForArea.length} matchs après filtrage`
                      );

                      // Si aucun match après filtrage et pas en mode affichage de toutes les aires, passer
                      if (matchesForArea.length === 0 && !displayAllAreas) {
                        return null;
                      }

                      return (
                        <div key={areaIndex} className="area-schedule">
                          <h4>
                            Aire {areaNumber} ({matchesForArea.length} matchs)
                          </h4>

                          {matchesForArea.length === 0 ? (
                            <div className="no-matches-for-area">
                              <p>
                                Aucun match ne correspond aux critères de
                                filtrage pour cette aire.
                              </p>
                            </div>
                          ) : (
                            <table className="matches-table">
                              <thead>
                                <tr>
                                  <th>N° Combat</th>
                                  <th>Horaire</th>
                                  <th>Groupe</th>
                                  <th>Poule</th>
                                  <th>Athlète BLEU</th>
                                  <th>Athlète ROUGE</th>
                                  <th>Type</th>
                                  <th>Seuils PSS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchesForArea.map(
                                  ({ scheduleItem, match }, index) => {
                                    // Traitement des pauses
                                    if (
                                      !match &&
                                      scheduleItem.type === "break"
                                    ) {
                                      return (
                                        <tr
                                          key={`break-${index}`}
                                          className="break-row"
                                        >
                                          <td colSpan="8">
                                            Pause (
                                            {tournamentConfig.breakDuration}{" "}
                                            min) -
                                            {formatTime(
                                              new Date(scheduleItem.startTime)
                                            )}{" "}
                                            à{" "}
                                            {formatTime(
                                              new Date(scheduleItem.endTime)
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    }

                                    // Si pas de match valide malgré le filtrage, passer (ne devrait pas arriver)
                                    if (!match) return null;

                                    // Trouver le groupe correspondant
                                    const group = groups.find(
                                      (g) => g.id === match.groupId
                                    );

                                    // Récupérer les informations de seuil de puissance
                                    const powerInfo =
                                      getPowerThresholdInfo(match);

                                    return (
                                      <tr key={index}>
                                        <td>
                                          {scheduleItem.matchNumber ||
                                            index + 1}
                                        </td>
                                        <td>
                                          {formatTime(
                                            new Date(scheduleItem.startTime)
                                          )}
                                        </td>
                                        <td>
                                          {group
                                            ? `${
                                                group.gender === "male"
                                                  ? "H"
                                                  : "F"
                                              } ${
                                                group.ageCategory?.name || ""
                                              } ${
                                                group.weightCategory?.name || ""
                                              }`
                                            : "-"}
                                        </td>
                                        <td>
                                          {match.poolIndex !== undefined
                                            ? match.poolIndex + 1
                                            : "-"}
                                        </td>
                                        <td className="blue-athlete">
                                          {getParticipantName(match, "A")}
                                        </td>
                                        <td className="red-athlete">
                                          {getParticipantName(match, "B")}
                                        </td>
                                        <td>Combat</td>
                                        <td className="pss-info">
                                          {powerInfo ? (
                                            <>
                                              <span className="pss-body">
                                                {powerInfo.pss}
                                              </span>
                                              <span className="pss-level">
                                                Niveau {powerInfo.hitLevel}
                                              </span>
                                            </>
                                          ) : (
                                            <span>-</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={prevStep} disabled={isLoading}>
          Précédent
        </button>
        <button
          className="next-btn"
          onClick={handleContinue}
          disabled={
            isLoading ||
            (dataSource !== "existing" && generatedMatches.length === 0)
          }
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default MatchSchedule;
