import { jsPDF } from "jspdf";
import "jspdf-autotable";
import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  getCompletedMatches,
  getMatchByNumber,
  loadMatches,
  loadResults,
  saveMatchResult,
  updateMatchResult,
} from "../services/dbService";
import "../styles/ScoreInput.css";
import { findPssInfo } from "../utils/categories";
import { findPowerThreshold } from "../utils/constants";

// Définition de l'URL de l'API
// const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

const ScoreInput = ({ matches, schedule, setResults, nextStep, prevStep }) => {
  const { competitionId } = useCompetition();
  const [currentMatches, setCurrentMatches] = useState([]);
  const [matchResults, setMatchResults] = useState({});
  const [currentFilter, setCurrentFilter] = useState("all"); // 'all', 'pending', 'completed'
  const [currentArea, setCurrentArea] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [areasCount, setAreasCount] = useState(0);
  const [completedMatches, setCompletedMatches] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [savingMatch, setSavingMatch] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editedScores, setEditedScores] = useState(null);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(""); // 'new' ou 'existing'
  const [exportingPdf, setExportingPdf] = useState(false);
  // Nouvel état pour suivre les retards par aire et les heures de fin estimées
  const [areasDelayInfo, setAreasDelayInfo] = useState({});
  const [groups, setGroups] = useState([]);
  const [matchesWithPssInfo, setMatchesWithPssInfo] = useState({});
  const [pendingPssRequests, setPendingPssRequests] = useState(new Set());
  const [isThrottling, setIsThrottling] = useState(false);

  // Charger les combats terminés depuis la base de données au chargement
  useEffect(() => {
    if (matches && matches.length > 0) {
      // Utiliser les matchs fournis en props
      console.log(
        "Utilisation des matchs fournis par les props:",
        matches.length
      );
      setCurrentMatches(matches);
      setAreasCount(Math.max(...matches.map((m) => m.areaNumber || 1)));

      // Charger les matchs terminés
      loadCompletedMatches();

      setIsLoading(false);
    } else if (competitionId) {
      // Si pas de matchs passés en props mais un ID de compétition, tenter de charger depuis la DB
      loadMatchesAndResults();
    } else {
      setIsLoading(false);
    }
  }, [matches, competitionId]);

  // Charger les matchs et les résultats
  const loadMatchesAndResults = async () => {
    try {
      setIsLoading(true);
      // Charger les matchs
      const matchesRes = await loadMatches(competitionId);
      if (matchesRes && matchesRes.data) {
        const allMatches = matchesRes.data.matches || [];
        setCurrentMatches(allMatches);
        setAreasCount(Math.max(...allMatches.map((m) => m.areaNumber || 1)));

        // Récupérer les groupes pour les informations PSS
        if (matchesRes.data.groups) {
          setGroups(matchesRes.data.groups);
        }
      }

      // Charger les résultats
      const res = await loadResults(competitionId);
      if (res && res.data) {
        setResults(res.data);
      }

      // Charger les matchs terminés
      await loadCompletedMatches();

      setIsLoading(false);
    } catch (error) {
      console.error(
        "Erreur lors du chargement des matchs et résultats:",
        error
      );
      setIsLoading(false);
    }
  };

  // Charger les combats terminés depuis la base de données
  const loadCompletedMatches = async () => {
    try {
      console.log(
        "Chargement des matchs terminés pour la compétition:",
        competitionId
      );
      const completedMatchesData = await getCompletedMatches(competitionId);

      if (completedMatchesData && completedMatchesData.length > 0) {
        console.log(
          `${completedMatchesData.length} matchs terminés chargés avec succès`
        );
        setCompletedMatches(completedMatchesData);

        // Synchroniser les matchs terminés avec l'état local
        syncCompletedMatchesWithState(completedMatchesData);

        // Recalculer les retards immédiatement après le chargement des matchs terminés
        if (schedule && schedule.length > 0) {
          const delayInfo = calculateAreasDelayInfo(completedMatchesData);
          setAreasDelayInfo(delayInfo);
        }
      } else {
        console.log("Aucun match terminé trouvé");
        setCompletedMatches([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des matchs terminés:", error);
    }
  };

  // Synchroniser les matchs terminés avec l'état local
  const syncCompletedMatchesWithState = (completedMatches) => {
    const updatedMatchResults = { ...matchResults };

    completedMatches.forEach((match) => {
      // Pour chaque match terminé, vérifier s'il est dans l'état local
      // Si non, ou s'il n'est pas marqué comme terminé, le mettre à jour
      const matchId = match.id;
      const matchNumber = match.matchNumber;

      // Transformer les données du match de l'API au format local attendu
      const matchResultData = {
        completed: true,
        winner:
          match.winner ===
          match.matchParticipants.find((p) => p.position === "A")?.participantId
            ? "A"
            : "B",
        rounds: match.rounds.map((round) => ({
          fighterA: round.scoreA,
          fighterB: round.scoreB,
          winner: round.winner,
        })),
      };

      // Mettre à jour l'état local avec ce match
      updatedMatchResults[matchId] = matchResultData;

      // Mettre à jour dans la liste des matchs en cours
      setCurrentMatches((prev) =>
        prev.map((m) =>
          m.id === matchId || m.matchNumber === matchNumber
            ? { ...m, status: "completed" }
            : m
        )
      );
    });

    // Mettre à jour l'état avec tous les matchs terminés
    setMatchResults(updatedMatchResults);
    console.log("État local synchronisé avec les matchs terminés");
  };

  // Calculer les retards et les temps de fin estimés pour chaque aire
  const calculateAreasDelayInfo = (completedMatchesOverride = null) => {
    // Si pas de matchs ou pas d'horaire, on ne peut pas calculer
    if (!currentMatches.length || !schedule || !schedule.length) {
      return {};
    }

    // Utiliser les matchs complétés fournis ou ceux de l'état
    const matchesToUse = completedMatchesOverride || completedMatches;

    // Récupérer l'heure actuelle
    const now = new Date();

    // Trouver l'heure de début prévue de la compétition (premier match du planning)
    const sortedSchedule = [...schedule].sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );
    const competitionStartTime =
      sortedSchedule.length > 0 ? new Date(sortedSchedule[0].startTime) : null;

    // Grouper les matchs par aire
    const matchesByArea = {};
    // Trouver le dernier match prévu par aire
    const lastScheduledMatchByArea = {};
    // Trouver le dernier match terminé par aire
    const lastCompletedMatchByArea = {};
    // Identifier toutes les aires utilisées dans le planning
    const allAreas = new Set();

    // Identifier toutes les aires utilisées dans le planning
    schedule.forEach((item) => {
      if (item.areaNumber) {
        allAreas.add(item.areaNumber);
      }
    });

    // Initialiser les structures de données
    currentMatches.forEach((match) => {
      const areaNumber = match.areaNumber || 1;
      allAreas.add(areaNumber);
      if (!matchesByArea[areaNumber]) {
        matchesByArea[areaNumber] = [];
      }
      matchesByArea[areaNumber].push(match);
    });

    // Trouver le dernier match prévu pour chaque aire
    schedule.forEach((item) => {
      if (item.type === "match") {
        const areaNumber = item.areaNumber || 1;
        if (
          !lastScheduledMatchByArea[areaNumber] ||
          new Date(item.startTime) >
            new Date(lastScheduledMatchByArea[areaNumber].startTime)
        ) {
          lastScheduledMatchByArea[areaNumber] = item;
        }
      }
    });

    // Trouver le dernier match terminé pour chaque aire
    // Nous utilisons maintenant la liste des matchs terminés la plus à jour (potentiellement fournie en paramètre)
    matchesToUse.forEach((match) => {
      const areaNumber = match.area?.areaNumber || 1;
      if (
        !lastCompletedMatchByArea[areaNumber] ||
        (match.endTime &&
          (!lastCompletedMatchByArea[areaNumber].endTime ||
            new Date(match.endTime) >
              new Date(lastCompletedMatchByArea[areaNumber].endTime)))
      ) {
        lastCompletedMatchByArea[areaNumber] = match;
      }
    });

    // Calculer le retard et l'heure de fin estimée pour chaque aire
    const result = {};

    // Traiter toutes les aires identifiées
    Array.from(allAreas).forEach((areaNumber) => {
      const area = parseInt(areaNumber);
      const lastScheduled = lastScheduledMatchByArea[area];
      const lastCompleted = lastCompletedMatchByArea[area];

      // Cas 1: L'aire a des matchs terminés
      if (lastScheduled && lastCompleted && lastCompleted.endTime) {
        // Trouver le match prévu correspondant au dernier match terminé
        const scheduledMatchForCompleted = schedule.find(
          (item) =>
            item.matchId === lastCompleted.id ||
            item.matchNumber === lastCompleted.matchNumber
        );

        if (scheduledMatchForCompleted) {
          // Calculer le retard en minutes
          const scheduledEndTime = new Date(scheduledMatchForCompleted.endTime);
          const actualEndTime = new Date(lastCompleted.endTime);
          const delayInMs = actualEndTime - scheduledEndTime;
          const delayInMinutes = Math.round(delayInMs / 60000);

          // Calculer la nouvelle heure de fin estimée
          const originalScheduledEndTime = new Date(lastScheduled.endTime);
          const newEstimatedEndTime = new Date(
            originalScheduledEndTime.getTime() + delayInMs
          );

          result[area] = {
            delayInMinutes,
            originalEndTime: originalScheduledEndTime,
            estimatedEndTime: newEstimatedEndTime,
            lastCompletedMatch: lastCompleted.matchNumber,
            message:
              delayInMinutes > 0
                ? `Retard de ${delayInMinutes} min. basé sur le match #${lastCompleted.matchNumber}`
                : delayInMinutes < 0
                ? `Avance de ${Math.abs(
                    delayInMinutes
                  )} min. basé sur le match #${lastCompleted.matchNumber}`
                : `Dans les temps. Dernier match complété: #${lastCompleted.matchNumber}`,
            hasResults: true,
          };
        }
      }
      // Cas 2: L'aire n'a pas encore de matchs terminés mais a des matchs prévus
      else if (lastScheduled && competitionStartTime) {
        // Calculer le retard basé sur l'heure de début prévue de la compétition
        const timeSinceScheduledStart = now - competitionStartTime;
        const delayInMinutes = Math.round(timeSinceScheduledStart / 60000);

        // Ne compter comme retard que si l'heure actuelle est après l'heure prévue de début
        const actualDelayInMinutes = delayInMinutes > 0 ? delayInMinutes : 0;

        // Calculer la nouvelle heure de fin estimée
        const originalScheduledEndTime = new Date(lastScheduled.endTime);
        const newEstimatedEndTime = new Date(
          originalScheduledEndTime.getTime() + actualDelayInMinutes * 60000
        );

        // Premier match prévu pour cette aire
        const firstMatchForArea = sortedSchedule.find(
          (item) => item.type === "match" && item.areaNumber === area
        );
        const firstMatchNumber = firstMatchForArea
          ? firstMatchForArea.matchNumber
          : "N/A";

        result[area] = {
          delayInMinutes: actualDelayInMinutes,
          originalEndTime: originalScheduledEndTime,
          estimatedEndTime: newEstimatedEndTime,
          lastCompletedMatch: null,
          message:
            actualDelayInMinutes > 0
              ? `Retard estimé de ${actualDelayInMinutes} min. La compétition aurait dû commencer à ${formatTime(
                  competitionStartTime
                )}`
              : `Pas encore de résultats. Premier match prévu: #${firstMatchNumber}`,
          hasResults: false,
        };
      }
    });

    return result;
  };

  useEffect(() => {
    if (completedMatches.length > 0 && schedule && schedule.length > 0) {
      const delayInfo = calculateAreasDelayInfo();
      setAreasDelayInfo(delayInfo);
    }
  }, [completedMatches, schedule]);

  useEffect(() => {
    if (schedule) {
      setIsLoading(true);

      // Création de la liste des matchs avec les infos de planification
      const matchesWithSchedule = matches.map((match) => {
        const scheduleInfo = schedule.find(
          (s) => s.matchId === match.id && s.type === "match"
        );
        return {
          ...match,
          scheduled: !!scheduleInfo,
          ...(scheduleInfo || {}),
          status: matchResults[match.id] ? "completed" : "pending",
        };
      });

      setCurrentMatches(matchesWithSchedule);

      // Déterminer le nombre d'aires
      if (schedule && schedule.length > 0) {
        const maxArea = Math.max(...schedule.map((s) => s.areaNumber || 0));
        setAreasCount(maxArea);
      }

      setIsLoading(false);
    }
  }, [matches, schedule, matchResults]);

  // Gestion de la saisie des scores
  const handleScoreChange = (matchId, roundIndex, fighter, value) => {
    const scoreValue = parseInt(value, 10) || 0;

    setMatchResults((prev) => {
      // Récupérer ou initialiser les résultats du match
      const matchResult = prev[matchId] || {
        rounds: [
          { fighterA: 0, fighterB: 0, winner: null },
          { fighterA: 0, fighterB: 0, winner: null },
          { fighterA: 0, fighterB: 0, winner: null },
        ],
        winner: null,
        completed: false,
      };

      // Mettre à jour le score du round
      const updatedRounds = [...matchResult.rounds];
      if (fighter === "A") {
        updatedRounds[roundIndex] = {
          ...updatedRounds[roundIndex],
          fighterA: scoreValue,
        };
      } else {
        updatedRounds[roundIndex] = {
          ...updatedRounds[roundIndex],
          fighterB: scoreValue,
        };
      }

      // Déterminer le vainqueur du round
      const round = updatedRounds[roundIndex];
      if (round.fighterA > round.fighterB) {
        round.winner = "A";
      } else if (round.fighterB > round.fighterA) {
        round.winner = "B";
      } else {
        round.winner = null;
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          rounds: updatedRounds,
        },
      };
    });
  };

  // Finaliser un match
  const finalizeMatch = (matchId) => {
    setMatchResults((prev) => {
      const matchResult = prev[matchId];

      if (!matchResult) return prev;

      // Compter les rounds gagnés
      const roundsWonByA = matchResult.rounds.filter(
        (r) => r.winner === "A"
      ).length;
      const roundsWonByB = matchResult.rounds.filter(
        (r) => r.winner === "B"
      ).length;

      // Déterminer le vainqueur du match
      let winner = null;
      if (roundsWonByA > roundsWonByB) {
        winner = "A";
      } else if (roundsWonByB > roundsWonByA) {
        winner = "B";
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          winner,
          completed: true,
        },
      };
    });
  };

  // Finaliser et sauvegarder un match
  const finalizeAndSaveMatch = async (matchId) => {
    setSavingMatch(matchId);
    console.log("=== Début de finalizeAndSaveMatch ===");
    console.log("ID du match à sauvegarder:", matchId);
    console.log("Type de l'ID:", typeof matchId);

    try {
      // D'abord finaliser le match localement
      finalizeMatch(matchId);
      console.log("Match finalisé localement");

      // Attendre un cycle pour s'assurer que le state est à jour
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Récupérer les résultats du match
      const matchResult = matchResults[matchId];
      console.log("État complet de matchResults:", matchResults);
      console.log("Résultats du match à sauvegarder:", matchResult);

      // Récupérer le match depuis la liste des matchs actuels
      const matchData = currentMatches.find((m) => m.id === matchId);
      if (!matchData) {
        throw new Error("Match non trouvé dans les données locales");
      }

      // Récupérer le match par son numéro depuis l'API (pour obtenir l'ID correct)
      console.log(
        `Recherche du match par son numéro: ${
          matchData.matchNumber || matchData.number
        }`
      );
      const matchNumber = matchData.matchNumber || matchData.number;

      try {
        // Utiliser la nouvelle fonction getMatchByNumber
        const dbMatch = await getMatchByNumber(competitionId, matchNumber);
        console.log(
          `Match #${matchNumber} trouvé dans la DB avec l'ID: ${dbMatch.id}`
        );

        // Vérifier que les participants sont correctement mappés
        console.log(
          "Participants du match dans la base de données:",
          dbMatch.matchParticipants
        );
        console.log("Participants locaux:", matchData.participants);

        // Créer une copie du résultat du match pour éviter de modifier l'original
        const resultToSave = { ...matchResult };

        // Vérifier si les positions A et B correspondent entre l'interface et la base de données
        if (
          dbMatch.matchParticipants &&
          dbMatch.matchParticipants.length >= 2
        ) {
          const dbParticipantA = dbMatch.matchParticipants.find(
            (p) => p.position === "A"
          )?.participant;
          const dbParticipantB = dbMatch.matchParticipants.find(
            (p) => p.position === "B"
          )?.participant;

          // Comparer avec les participants locaux pour voir s'il y a une inversion
          const localParticipantA = matchData.participants
            ? matchData.participants[0]
            : null;
          const localParticipantB = matchData.participants
            ? matchData.participants[1]
            : null;

          if (
            dbParticipantA &&
            dbParticipantB &&
            localParticipantA &&
            localParticipantB
          ) {
            console.log(
              "DB Participant A:",
              dbParticipantA.prenom,
              dbParticipantA.nom,
              "ID:",
              dbParticipantA.id
            );
            console.log(
              "DB Participant B:",
              dbParticipantB.prenom,
              dbParticipantB.nom,
              "ID:",
              dbParticipantB.id
            );
            console.log(
              "Local Participant A:",
              localParticipantA.prenom,
              localParticipantA.nom,
              "ID:",
              localParticipantA.id
            );
            console.log(
              "Local Participant B:",
              localParticipantB.prenom,
              localParticipantB.nom,
              "ID:",
              localParticipantB.id
            );

            // Vérifier s'il y a une inversion des participants
            const positionsInverted =
              localParticipantA.id === dbParticipantB.id &&
              localParticipantB.id === dbParticipantA.id;

            if (positionsInverted) {
              console.log(
                "ATTENTION: Les positions des participants sont inversées entre l'interface et la base de données"
              );

              // Inverser les scores des rounds
              resultToSave.rounds = resultToSave.rounds.map((round) => ({
                fighterA: round.fighterB,
                fighterB: round.fighterA,
                winner:
                  round.winner === "A"
                    ? "B"
                    : round.winner === "B"
                    ? "A"
                    : null,
              }));

              // Inverser le vainqueur global
              if (resultToSave.winner === "A") {
                resultToSave.winner = "B";
              } else if (resultToSave.winner === "B") {
                resultToSave.winner = "A";
              }

              console.log("Résultats corrigés après inversion:", resultToSave);
            }
          }
        }

        // Utiliser l'ID correct de la base de données
        const correctMatchId = dbMatch.id;

        if (resultToSave) {
          // Sauvegarder dans la base de données en utilisant l'ID correct
          console.log("Tentative de sauvegarde avec les données:", {
            matchId: correctMatchId,
            matchResult: resultToSave,
          });
          const saveResult = await saveMatchResult(
            correctMatchId,
            resultToSave
          );
          console.log("Réponse de saveMatchResult:", saveResult);

          if (saveResult.success) {
            // Recharger les combats terminés pour avoir la liste la plus à jour
            await loadCompletedMatches();
            console.log("Combats terminés rechargés avec succès");

            // Marquer le match comme complété dans la liste locale
            setCurrentMatches((prev) =>
              prev.map((m) =>
                m.id === matchId ? { ...m, status: "completed" } : m
              )
            );

            // Mettre à jour l'état local des matchResults pour marquer ce match comme complété
            // C'est cette partie qui assure la persistance des données
            setMatchResults((prev) => {
              const updatedResults = { ...prev };
              if (updatedResults[matchId]) {
                updatedResults[matchId] = {
                  ...updatedResults[matchId],
                  completed: true,
                };
              }

              // Ajouter également une entrée avec l'ID correct de la base de données
              if (correctMatchId !== matchId) {
                updatedResults[correctMatchId] = {
                  ...resultToSave,
                  completed: true,
                };
              }

              return updatedResults;
            });

            // Mettre à jour les résultats globaux
            setResults((prevResults) => ({
              ...prevResults,
              [matchId]: resultToSave,
              [correctMatchId]: resultToSave, // Ajouter également avec l'ID correct
            }));

            // Basculer vers l'onglet des combats terminés après un court délai
            setTimeout(() => {
              setShowCompleted(true);

              // Obtenir la liste la plus à jour des matchs terminés
              getCompletedMatches(competitionId)
                .then((newCompletedMatches) => {
                  // Mettre à jour l'état local
                  setCompletedMatches(newCompletedMatches);

                  // Recalculer les retards avec les données les plus récentes
                  const updatedDelayInfo =
                    calculateAreasDelayInfo(newCompletedMatches);
                  setAreasDelayInfo(updatedDelayInfo);

                  // Utiliser directement les données du participant vainqueur renvoyées par l'API
                  // au lieu de se baser sur winnerPosition
                  if (saveResult.winnerParticipant) {
                    const winnerName = `${saveResult.winnerParticipant.prenom} ${saveResult.winnerParticipant.nom}`;
                    alert(
                      "Match terminé avec succès! Vainqueur: " +
                        winnerName +
                        " - 3 points attribués"
                    );
                  } else {
                    // Fallback au cas où winnerParticipant n'est pas disponible
                    let winnerName = "Pas de vainqueur";
                    if (resultToSave.winner === "A") {
                      const participantA = dbMatch.matchParticipants.find(
                        (p) => p.position === "A"
                      )?.participant;
                      if (participantA) {
                        winnerName = `${participantA.prenom} ${participantA.nom}`;
                      }
                    } else if (resultToSave.winner === "B") {
                      const participantB = dbMatch.matchParticipants.find(
                        (p) => p.position === "B"
                      )?.participant;
                      if (participantB) {
                        winnerName = `${participantB.prenom} ${participantB.nom}`;
                      }
                    }

                    alert(
                      "Match terminé avec succès! Vainqueur: " +
                        winnerName +
                        " - 3 points attribués"
                    );
                  }
                })
                .catch((err) => {
                  console.error(
                    "Erreur lors de la récupération des matchs terminés après sauvegarde:",
                    err
                  );

                  // Fallback: utiliser calculateAreasDelayInfo avec les données actuelles
                  const updatedDelayInfo = calculateAreasDelayInfo();
                  setAreasDelayInfo(updatedDelayInfo);
                });
            }, 500);
          }
        } else {
          throw new Error("Match ou résultats non trouvés");
        }
      } catch (error) {
        // Vérifier si c'est une erreur 404 (match non trouvé)
        if (
          error.message &&
          (error.message.includes("404") ||
            error.message.includes("non trouvé"))
        ) {
          console.warn(
            "Match non trouvé dans la base de données (404):",
            matchId
          );

          // Message à l'utilisateur
          alert(
            `Erreur lors de la sauvegarde du match #${matchNumber}. La base de données et l'interface sont désynchronisées. Veuillez rafraîchir la page.`
          );
        } else {
          // Autre type d'erreur
          throw error;
        }
      }
    } catch (error) {
      console.error("Erreur détaillée lors de la sauvegarde du match:", error);
      console.error("Stack trace:", error.stack);
      alert("Erreur lors de la sauvegarde du match: " + error.message);
    } finally {
      setSavingMatch(null);
    }
  };

  // Fonction pour commencer l'édition d'un match
  const startEditMatch = (match) => {
    setEditingMatch(match);
    setEditedScores({
      rounds: match.rounds.map((round) => ({
        scoreA: round.scoreA,
        scoreB: round.scoreB,
        winner: round.winner,
      })),
      winner: match.winner,
    });
  };

  // Fonction pour mettre à jour un score pendant l'édition
  const handleEditScoreChange = (roundIndex, fighter, value) => {
    const newScores = { ...editedScores };
    const round = newScores.rounds[roundIndex];

    if (fighter === "A") {
      round.scoreA = parseInt(value) || 0;
    } else {
      round.scoreB = parseInt(value) || 0;
    }

    // Déterminer le vainqueur du round
    if (round.scoreA > round.scoreB) {
      round.winner = "A";
    } else if (round.scoreB > round.scoreA) {
      round.winner = "B";
    } else {
      round.winner = null;
    }

    // Déterminer le vainqueur du match
    const roundsWonByA = newScores.rounds.filter(
      (r) => r.winner === "A"
    ).length;
    const roundsWonByB = newScores.rounds.filter(
      (r) => r.winner === "B"
    ).length;

    if (roundsWonByA > roundsWonByB) {
      newScores.winner = "A";
    } else if (roundsWonByB > roundsWonByA) {
      newScores.winner = "B";
    } else {
      newScores.winner = null;
    }

    setEditedScores(newScores);
  };

  // Fonction pour sauvegarder les modifications
  const saveEditedMatch = async () => {
    try {
      const participantA = editingMatch.matchParticipants?.find(
        (p) => p.position === "A"
      )?.participant;

      const participantB = editingMatch.matchParticipants?.find(
        (p) => p.position === "B"
      )?.participant;

      if (!participantA || !participantB) {
        throw new Error("Participants du match incomplets");
      }

      console.log("Édition du match:", editingMatch);
      console.log("Scores édités:", editedScores);
      console.log(
        "Participant A:",
        participantA.prenom,
        participantA.nom,
        "ID:",
        participantA.id
      );
      console.log(
        "Participant B:",
        participantB.prenom,
        participantB.nom,
        "ID:",
        participantB.id
      );

      // Déterminer l'ID du participant vainqueur
      let winnerId = null;
      if (editedScores.winner === "A") {
        winnerId = participantA.id;
      } else if (editedScores.winner === "B") {
        winnerId = participantB.id;
      }

      // Créer des rounds avec les bons IDs de participants
      const updatedRounds = editedScores.rounds.map((round) => {
        let roundWinnerId = null;
        if (round.winner === "A") {
          roundWinnerId = participantA.id;
        } else if (round.winner === "B") {
          roundWinnerId = participantB.id;
        }

        return {
          scoreA: round.scoreA,
          scoreB: round.scoreB,
          winner: roundWinnerId,
          winnerPosition: round.winner,
        };
      });

      const updatedMatch = {
        ...editingMatch,
        rounds: updatedRounds,
        winner: winnerId, // Utiliser l'ID du participant au lieu de "A" ou "B"
        status: "completed",
        endTime: new Date(),
        pointMatch: winnerId ? 3 : 0, // 3 points pour une victoire, 0 pour un match nul
      };

      await updateMatchResult(editingMatch.id, updatedMatch);
      await loadCompletedMatches(); // Recharger la liste des matchs

      // Recalculer les retards après la modification d'un match
      const updatedDelayInfo = calculateAreasDelayInfo();
      setAreasDelayInfo(updatedDelayInfo);

      setEditingMatch(null);
      setEditedScores(null);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du match:", error);
      alert("Erreur lors de la mise à jour du match. Veuillez réessayer.");
    }
  };

  // Filtrer les matchs
  const getFilteredMatches = () => {
    return currentMatches
      .filter((match) => {
        // Vérifier si le match est considéré comme terminé
        const isCompleted =
          matchResults[match.id]?.completed || // Vérifie dans l'état local
          match.status === "completed" || // Vérifie le status dans les données du match
          completedMatches.some(
            (cm) => cm.id === match.id || cm.matchNumber === match.matchNumber
          ); // Vérifie dans la liste des matchs terminés

        // Filtre par statut
        if (currentFilter === "pending" && isCompleted) {
          return false;
        }
        if (currentFilter === "completed" && !isCompleted) {
          return false;
        }

        // Filtre par aire
        if (
          currentArea !== "all" &&
          match.areaNumber !== parseInt(currentArea, 10)
        ) {
          return false;
        }

        // Filtre par recherche
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const participantNames = match.participants.map((p) =>
            `${p.prenom} ${p.nom}`.toLowerCase()
          );

          if (
            !participantNames.some((name) => name.includes(searchLower)) &&
            !match.matchNumber.toString().includes(searchLower)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Tri par aire puis par horaire
        if (a.areaNumber !== b.areaNumber) {
          return a.areaNumber - b.areaNumber;
        }
        return new Date(a.startTime || 0) - new Date(b.startTime || 0);
      });
  };

  // Continuer vers l'étape suivante
  const handleContinue = () => {
    // Calculer les statistiques pour tous les combats terminés
    setResults(matchResults);
    nextStep();
  };

  // Formatage du nom du participant
  const getParticipantName = (match, position) => {
    try {
      const participant = match?.participants?.[position];
      if (!participant) return "Inconnu";

      if (participant.athleteInfo) {
        const nom = participant.athleteInfo.nom || "";
        const prenom = participant.athleteInfo.prenom || "";
        return `${prenom} ${nom}`.trim() || "Inconnu";
      } else if (participant.nom || participant.prenom) {
        return `${participant.prenom || ""} ${participant.nom || ""}`.trim();
      } else if (participant.name) {
        return participant.name;
      }

      return "Inconnu";
    } catch (error) {
      console.error("Erreur lors de l'obtention du nom du participant:", error);
      return "Inconnu";
    }
  };

  // Obtenir les informations de seuil de puissance et de plastron pour un match
  const getPowerThresholdInfo = (match) => {
    try {
      if (!match) return null;

      const matchNumber = match.matchNumber;

      // Si nous avons déjà récupéré les infos pour ce match, les utiliser
      if (matchesWithPssInfo[matchNumber]) {
        return matchesWithPssInfo[matchNumber];
      }

      // Sinon, lancer une requête asynchrone pour les récupérer
      // Cette fonction ne retournera rien immédiatement, mais mettra à jour l'état quand les données seront disponibles
      fetchPssInfoForMatch(matchNumber);

      return null;
    } catch (error) {
      console.error(
        "Erreur lors de l'obtention des informations de seuil PSS:",
        error
      );
      return null;
    }
  };

  // Fonction pour récupérer et stocker les informations PSS d'un match
  const fetchPssInfoForMatch = async (matchNumber) => {
    try {
      // Vérifier si nous avons déjà ces infos ou si une requête est déjà en cours
      if (
        matchesWithPssInfo[matchNumber] ||
        pendingPssRequests.has(matchNumber)
      )
        return;

      // Ajouter à la liste des requêtes en cours
      setPendingPssRequests((prev) => new Set(prev).add(matchNumber));

      // Récupérer les infos
      const pssInfo = await fetchPssInfoByMatchNumber(matchNumber);

      if (pssInfo) {
        // Mettre à jour l'état avec les nouvelles infos
        setMatchesWithPssInfo((prev) => ({
          ...prev,
          [matchNumber]: pssInfo,
        }));
      }

      // Retirer de la liste des requêtes en cours
      setPendingPssRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(matchNumber);
        return newSet;
      });
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des infos PSS pour le match #${matchNumber}:`,
        error
      );

      // Également retirer en cas d'erreur
      setPendingPssRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(matchNumber);
        return newSet;
      });
    }
  };

  // Formatage de l'heure
  const formatTime = (dateString) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Ajouter un onglet de navigation pour les combats terminés
  const renderTabs = () => (
    <div className="tabs">
      <button
        className={`tab-btn ${!showCompleted ? "active" : ""}`}
        onClick={() => setShowCompleted(false)}
      >
        Combats en cours
      </button>
      <button
        className={`tab-btn ${showCompleted ? "active" : ""}`}
        onClick={() => setShowCompleted(true)}
      >
        Combats terminés ({completedMatches.length})
      </button>
    </div>
  );

  const filteredMatches = getFilteredMatches();

  // Fonction helper pour vérifier si un match est terminé
  const isMatchCompleted = (match) => {
    return (
      matchResults[match.id]?.completed ||
      match.status === "completed" ||
      completedMatches.some(
        (cm) => cm.id === match.id || cm.matchNumber === match.matchNumber
      )
    );
  };

  // Calculer les statistiques de combats terminés/en attente
  const completedCount = currentMatches.filter(isMatchCompleted).length;
  const pendingCount = currentMatches.length - completedCount;

  // Modifier le rendu des matchs terminés pour inclure l'édition
  const renderCompletedMatches = () => (
    <div className="completed-matches">
      <h3>Combats terminés</h3>

      {completedMatches.length === 0 ? (
        <p>Aucun combat terminé pour le moment.</p>
      ) : (
        <table className="completed-matches-table">
          <thead>
            <tr>
              <th>N° Combat</th>
              <th>Aire</th>
              <th>Athlète A</th>
              <th>Score</th>
              <th>Athlète B</th>
              <th>Vainqueur</th>
              <th>Heure de fin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {completedMatches.map((match) => {
              const participantA = match.matchParticipants?.find(
                (p) => p.position === "A"
              )?.participant;
              const participantB = match.matchParticipants?.find(
                (p) => p.position === "B"
              )?.participant;

              if (!participantA || !participantB) return null;

              // Déterminer le vainqueur en se basant sur l'ID stocké
              const isWinnerA = match.winner === participantA.id;
              const isWinnerB = match.winner === participantB.id;
              const winnerName = isWinnerA
                ? `${participantA.prenom} ${participantA.nom}`
                : isWinnerB
                ? `${participantB.prenom} ${participantB.nom}`
                : "Match nul";

              if (editingMatch?.id === match.id) {
                return (
                  <tr key={match.id} className="editing">
                    <td>{match.matchNumber}</td>
                    <td>{match.area.areaNumber}</td>
                    <td>{`${participantA.prenom} ${participantA.nom}`}</td>
                    <td>
                      {editedScores.rounds.map((round, i) => (
                        <div key={i} className="round-score-edit">
                          <input
                            type="number"
                            min="0"
                            value={round.scoreA}
                            onChange={(e) =>
                              handleEditScoreChange(i, "A", e.target.value)
                            }
                          />
                          {" - "}
                          <input
                            type="number"
                            min="0"
                            value={round.scoreB}
                            onChange={(e) =>
                              handleEditScoreChange(i, "B", e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </td>
                    <td>{`${participantB.prenom} ${participantB.nom}`}</td>
                    <td>
                      {editedScores.winner === "A"
                        ? `${participantA.prenom} ${participantA.nom}`
                        : editedScores.winner === "B"
                        ? `${participantB.prenom} ${participantB.nom}`
                        : "Pas de vainqueur"}
                    </td>
                    <td>{formatTime(match.endTime)}</td>
                    <td>
                      <button onClick={saveEditedMatch} className="save-btn">
                        Sauvegarder
                      </button>
                      <button
                        onClick={() => setEditingMatch(null)}
                        className="cancel-btn"
                      >
                        Annuler
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={match.id}>
                  <td>{match.matchNumber}</td>
                  <td>{match.area.areaNumber}</td>
                  <td className={isWinnerA ? "winner" : ""}>
                    {`${participantA.prenom} ${participantA.nom}`}
                  </td>
                  <td>
                    {match.rounds.map((round, i) => (
                      <div key={i} className="round-score">
                        {round.scoreA} - {round.scoreB}
                      </div>
                    ))}
                  </td>
                  <td className={isWinnerB ? "winner" : ""}>
                    {`${participantB.prenom} ${participantB.nom}`}
                  </td>
                  <td>{winnerName}</td>
                  <td>{formatTime(match.endTime)}</td>
                  <td>
                    <button
                      onClick={() => startEditMatch(match)}
                      className="edit-btn"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  // Fonction pour exporter les fiches de poules au format PDF pour les arbitres
  const handleExportPoolSheetsPDF = () => {
    try {
      setExportingPdf(true);

      // Créer un nouveau document PDF en format paysage pour plus d'espace
      const doc = new jsPDF("landscape");

      // Organiser les matchs par poule
      const matchesByPool = {};

      // Regrouper les matchs par groupe et par poule
      currentMatches.forEach((match) => {
        const key = `${match.groupId}-${match.poolIndex}`;
        if (!matchesByPool[key]) {
          matchesByPool[key] = {
            groupId: match.groupId,
            poolIndex: match.poolIndex,
            matches: [],
          };
        }
        matchesByPool[key].matches.push(match);
      });

      // Récupérer les informations des groupes nécessaires pour l'affichage
      const groupInfoPromises = Object.values(matchesByPool).map(
        async (pool) => {
          try {
            const response = await fetch(`${API_URL}/group/${pool.groupId}`);
            if (response.ok) {
              const group = await response.json();
              return {
                ...pool,
                groupName: `${group.gender === "male" ? "H" : "F"} - ${
                  group.ageCategoryName
                } - ${group.weightCategoryName}`,
              };
            }
            return pool;
          } catch (error) {
            console.error(
              "Erreur lors de la récupération des informations du groupe:",
              error
            );
            return pool;
          }
        }
      );

      // Attendre la récupération de toutes les informations des groupes
      Promise.all(groupInfoPromises)
        .then((poolsWithInfo) => {
          // Pour chaque poule, créer un tableau sur une nouvelle page
          poolsWithInfo.forEach((pool, index) => {
            if (index > 0) {
              doc.addPage();
            }

            // Titre principal de la compétition
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(
              "TAEKWONDO TOURNAMENT MANAGER",
              doc.internal.pageSize.width / 2,
              15,
              { align: "center" }
            );

            // Titre de la poule
            const title = pool.groupName
              ? `${pool.groupName.toUpperCase()}`
              : "POULE";

            // Titre secondaire de la poule avec la lettre
            const poolLetter = String.fromCharCode(65 + pool.poolIndex);

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(
              pool.groupName && pool.groupName.includes("F")
                ? "#D32F2F"
                : "#3F51B5"
            );
            doc.text(
              `${poolLetter} - POULE ${poolLetter}`,
              doc.internal.pageSize.width / 2,
              30,
              { align: "center" }
            );

            // Sous-titre avec le nom du groupe
            doc.setFontSize(14);
            doc.text(title, doc.internal.pageSize.width / 2, 40, {
              align: "center",
            });

            // Organisation des participants pour le tableau en format matrice
            const participants = [];
            pool.matches.forEach((match) => {
              if (match.participants && match.participants.length >= 2) {
                // Vérifier que les deux participants ne sont pas déjà dans la liste
                const participant1 = match.participants[0];
                const participant2 = match.participants[1];

                if (!participants.some((p) => p.id === participant1.id)) {
                  participants.push(participant1);
                }

                if (!participants.some((p) => p.id === participant2.id)) {
                  participants.push(participant2);
                }
              }
            });

            // Créer la matrice pour le tableau de la poule
            const tableData = [];

            // Première ligne avec les noms des participants (en colonnes)
            const headerRow = [""];
            participants.forEach((participant) => {
              headerRow.push(`${participant.prenom} ${participant.nom}`);
            });
            headerRow.push("POINTS");
            headerRow.push("CLASSEMENT");
            tableData.push(headerRow);

            // Lignes pour chaque participant
            participants.forEach((participant, rowIndex) => {
              const row = [`${participant.prenom} ${participant.nom}`];

              // Pour chaque colonne (autres participants)
              participants.forEach((opponent, colIndex) => {
                if (rowIndex === colIndex) {
                  // Même participant, mettre une diagonale
                  row.push("");
                } else {
                  // Chercher le match entre ces deux participants
                  const match = pool.matches.find(
                    (m) =>
                      (m.participants[0].id === participant.id &&
                        m.participants[1].id === opponent.id) ||
                      (m.participants[1].id === participant.id &&
                        m.participants[0].id === opponent.id)
                  );

                  if (match) {
                    // Inclure l'heure du match s'il existe
                    const matchTime = match.startTime
                      ? formatTime(match.startTime)
                      : "";
                    row.push(matchTime);
                  } else {
                    row.push("");
                  }
                }
              });

              // Colonnes pour les points et le classement
              row.push(""); // Points
              row.push(""); // Classement

              tableData.push(row);
            });

            // Générer le tableau avec autoTable avec plus d'espace pour les scores
            doc.autoTable({
              startY: 50,
              body: tableData,
              theme: "grid",
              styles: {
                fontSize: 10,
                cellPadding: { top: 10, right: 5, bottom: 10, left: 5 },
                lineColor: [0, 0, 0],
                lineWidth: 0.5,
                halign: "center",
                valign: "middle",
              },
              columnStyles: {
                0: { fontStyle: "bold", cellWidth: 40, halign: "left" },
                [participants.length + 1]: { cellWidth: 25 }, // Colonne Points
                [participants.length + 2]: { cellWidth: 25 }, // Colonne Classement
              },
              headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: "bold",
              },
              didDrawCell: function (data) {
                // Tracer une diagonale dans les cellules où le même combattant se rencontre
                if (
                  data.section === "body" &&
                  data.row.index > 0 &&
                  data.column.index > 0 &&
                  data.column.index <= participants.length &&
                  data.row.index === data.column.index
                ) {
                  const x = data.cell.x;
                  const y = data.cell.y;
                  const w = data.cell.width;
                  const h = data.cell.height;

                  doc.setDrawColor(0);
                  doc.setLineWidth(0.5);
                  doc.line(x, y, x + w, y + h);
                }
              },
            });

            // Pied de page avec information sur la fiche
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text(
              `Catégorie: ${title} - Poule ${poolLetter}`,
              15,
              doc.internal.pageSize.height - 10
            );
            doc.text(
              `Généré le ${new Date().toLocaleString()}`,
              doc.internal.pageSize.width - 15,
              doc.internal.pageSize.height - 10,
              { align: "right" }
            );
          });

          // Sauvegarder le PDF
          doc.save(
            `fiches_poules_arbitres_${new Date()
              .toLocaleDateString()
              .replace(/\//g, "-")}.pdf`
          );
          setExportingPdf(false);
        })
        .catch((error) => {
          console.error("Erreur lors du traitement des données:", error);
          alert("Erreur lors de la génération du PDF. Veuillez réessayer.");
          setExportingPdf(false);
        });
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert("Erreur lors de la génération du PDF. Veuillez réessayer.");
      setExportingPdf(false);
    }
  };

  // Fonction pour récupérer directement les informations PSS d'un match par son numéro
  const fetchPssInfoByMatchNumber = async (matchNumber) => {
    try {
      console.log(
        `Récupération des informations PSS pour le match #${matchNumber}`
      );

      // Ajout d'un délai aléatoire pour éviter la synchronisation des requêtes
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

      // Récupérer d'abord le match par son numéro
      const matchData = await getMatchByNumber(competitionId, matchNumber);

      if (!matchData) {
        console.log(`Match #${matchNumber} non trouvé`);
        return null;
      }

      console.log(
        `Match #${matchNumber} trouvé, ID: ${matchData.id}, groupId: ${matchData.groupId}`
      );

      // Vérifier d'abord si cette information n'a pas déjà été mise en cache par une autre requête
      if (matchesWithPssInfo[matchNumber]) {
        return matchesWithPssInfo[matchNumber];
      }

      // Essayer d'abord de récupérer des données PSS à partir des informations du match
      // sans faire de requête supplémentaire
      if (matchData.groupId) {
        // Si nous avons les groupes en mémoire, essayons de les utiliser
        const cachedGroup = groups.find((g) => g.id === matchData.groupId);
        if (cachedGroup) {
          const ageCategory = cachedGroup.ageCategoryName;
          const gender = cachedGroup.gender;
          const weightCategory = cachedGroup.weightCategoryName;

          // Essayer d'abord avec findPssInfo
          const pssInfo = findPssInfo(ageCategory, gender, weightCategory);

          if (pssInfo) {
            console.log(
              `Informations PSS trouvées via cache/findPssInfo pour le match #${matchNumber}:`,
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
            console.log(
              `Informations PSS trouvées via cache/findPowerThreshold pour le match #${matchNumber}:`,
              powerThreshold
            );
            return powerThreshold;
          }
        }
      }

      // Si nous n'avons pas pu récupérer les informations à partir du cache,
      // faire une requête pour obtenir les informations du groupe
      const response = await fetch(`${API_URL}/group/${matchData.groupId}`);
      if (!response.ok) {
        console.log(
          `Erreur lors de la récupération du groupe pour le match #${matchNumber}`
        );
        return null;
      }

      const group = await response.json();
      console.log(`Informations du groupe récupérées:`, group);

      // Maintenant utiliser les informations du groupe pour trouver les seuils PSS
      const ageCategory = group.ageCategoryName;
      const gender = group.gender;
      const weightCategory = group.weightCategoryName;

      // Essayer d'abord avec findPssInfo
      const pssInfo = findPssInfo(ageCategory, gender, weightCategory);

      if (pssInfo) {
        console.log(
          `Informations PSS trouvées via findPssInfo pour le match #${matchNumber}:`,
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
        console.log(
          `Informations PSS trouvées via findPowerThreshold pour le match #${matchNumber}:`,
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

  // Précharger les informations PSS pour tous les matchs
  useEffect(() => {
    if (currentMatches && currentMatches.length > 0) {
      console.log("Préchargement des informations PSS pour les matchs");

      // Fonction qui va traiter le chargement des informations PSS de manière séquentielle
      const processQueue = async () => {
        if (isThrottling) return;

        setIsThrottling(true);

        // Limiter à 3 requêtes en cours maximum
        if (pendingPssRequests.size < 3) {
          // Trouver les 5 premiers matchs qui n'ont pas encore d'informations PSS et qui ne sont pas déjà en train d'être chargés
          const matchesToFetch = currentMatches
            .filter(
              (match) =>
                match.matchNumber &&
                !matchesWithPssInfo[match.matchNumber] &&
                !pendingPssRequests.has(match.matchNumber)
            )
            .slice(0, 5);

          // Lancer les requêtes avec un délai entre chacune
          if (matchesToFetch.length > 0) {
            const match = matchesToFetch[0];
            fetchPssInfoForMatch(match.matchNumber);

            // Attendre 200ms avant de permettre la prochaine requête
            setTimeout(() => {
              setIsThrottling(false);
            }, 200);
          } else {
            setIsThrottling(false);
          }
        } else {
          // Si trop de requêtes en cours, attendons un peu plus longtemps
          setTimeout(() => {
            setIsThrottling(false);
          }, 500);
        }
      };

      // Lancer le traitement et le répéter toutes les 500ms
      const intervalId = setInterval(processQueue, 500);

      // Nettoyer l'intervalle quand le composant est démonté
      return () => clearInterval(intervalId);
    }
  }, [currentMatches, matchesWithPssInfo, pendingPssRequests, isThrottling]);

  return (
    <div className="score-input-container">
      <h2>Étape 5: Saisie des scores</h2>

      {/* Header fixe pour les informations de retard qui reste visible lors du défilement */}
      {Object.keys(areasDelayInfo).length > 0 && (
        <div className="fixed-header-delay-info">
          <div className="header-content">
            <div className="header-title">
              <span className="header-icon">⏱️</span>
              <span>Prévisions de fin par aire</span>
            </div>
            <div className="areas-delay-cards">
              {Object.entries(areasDelayInfo).map(([areaNumber, info]) => (
                <div
                  key={areaNumber}
                  className={`area-delay-card ${
                    !info.hasResults
                      ? "no-results"
                      : info.delayInMinutes > 0
                      ? "delayed"
                      : "on-time"
                  }`}
                >
                  <h4>Aire {areaNumber}</h4>
                  <div className="card-content">
                    <p className="estimated-end-time">
                      {formatTime(info.estimatedEndTime)}
                      {info.delayInMinutes !== 0 && (
                        <span className="delay-indicator">
                          {info.delayInMinutes > 0
                            ? ` (+${info.delayInMinutes} min)`
                            : ` (${info.delayInMinutes} min)`}
                        </span>
                      )}
                    </p>
                    <div className="last-match-indicator">
                      {info.lastCompletedMatch
                        ? `#${info.lastCompletedMatch}`
                        : "—"}
                    </div>
                    <div className="tooltip-container">
                      <button className="info-button">ℹ️</button>
                      <div className="tooltip">{info.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">
          <p>Chargement des combats...</p>
        </div>
      ) : (
        <>
          {renderTabs()}

          {showCompleted ? (
            renderCompletedMatches()
          ) : (
            <>
              <div className="match-stats">
                <div className="stat-card">
                  <h3>Total</h3>
                  <p>{currentMatches.length} combats</p>
                </div>
                <div className="stat-card completed">
                  <h3>Terminés</h3>
                  <p>{completedCount} combats</p>
                </div>
                <div className="stat-card pending">
                  <h3>En attente</h3>
                  <p>{pendingCount} combats</p>
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="export-btn pdf-btn"
                  onClick={handleExportPoolSheetsPDF}
                  disabled={
                    currentMatches.length === 0 || isLoading || exportingPdf
                  }
                >
                  {exportingPdf
                    ? "Génération en cours..."
                    : "Exporter fiches arbitres"}
                </button>
              </div>

              <div className="filters-container">
                <div className="filter-group">
                  <label htmlFor="statusFilter">Statut:</label>
                  <select
                    id="statusFilter"
                    value={currentFilter}
                    onChange={(e) => setCurrentFilter(e.target.value)}
                  >
                    <option value="all">Tous</option>
                    <option value="pending">En attente</option>
                    <option value="completed">Terminés</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="areaFilter">Aire:</label>
                  <select
                    id="areaFilter"
                    value={currentArea}
                    onChange={(e) => setCurrentArea(e.target.value)}
                  >
                    <option value="all">Toutes</option>
                    {[...Array(areasCount)].map((_, i) => (
                      <option key={i} value={i + 1}>
                        Aire {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group search">
                  <input
                    type="text"
                    placeholder="Rechercher un combat ou un athlète..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="matches-list">
                {filteredMatches.length === 0 ? (
                  <div className="no-matches">
                    <p>Aucun combat ne correspond aux filtres sélectionnés.</p>
                  </div>
                ) : (
                  filteredMatches.map((match) => {
                    const matchResult = matchResults[match.id] || {
                      rounds: [
                        { fighterA: 0, fighterB: 0, winner: null },
                        { fighterA: 0, fighterB: 0, winner: null },
                        { fighterA: 0, fighterB: 0, winner: null },
                      ],
                      winner: null,
                      completed: false,
                    };

                    return (
                      <div
                        key={match.id}
                        className={`match-card ${
                          matchResult.completed ? "completed" : "pending"
                        }`}
                      >
                        <div className="match-header">
                          <div className="match-number">
                            Combat #{match.matchNumber}
                          </div>
                          <div className="match-time">
                            <span className="area">
                              Aire {match.areaNumber || "?"}
                            </span>
                            <span className="time">
                              {formatTime(match.startTime)}
                            </span>
                          </div>
                        </div>

                        {/* Informations de seuil PSS */}
                        {(() => {
                          const powerInfo = getPowerThresholdInfo(match);
                          return powerInfo ? (
                            <div className="pss-info-container">
                              <div className="pss-info">
                                <span className="pss-title">Seuils PSS:</span>
                                <div className="pss-details">
                                  <span className="pss-body">
                                    Plastron: <strong>{powerInfo.pss}</strong>
                                  </span>
                                  <span className="pss-level">
                                    Niveau de frappe:{" "}
                                    <strong>{powerInfo.hitLevel}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="pss-info-container">
                              <div className="pss-info">
                                <span className="pss-title">Seuils PSS:</span>
                                <div className="pss-details">
                                  <span>Informations non disponibles</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="match-details">
                          <div className="fighters">
                            <div
                              className={`fighter fighter-a ${
                                matchResult.winner === "A" ? "winner" : ""
                              }`}
                            >
                              {getParticipantName(match, 0)}
                            </div>
                            <div className="vs">VS</div>
                            <div
                              className={`fighter fighter-b ${
                                matchResult.winner === "B" ? "winner" : ""
                              }`}
                            >
                              {getParticipantName(match, 1)}
                            </div>
                          </div>

                          <div className="rounds-scores">
                            {matchResult.rounds.map((round, roundIndex) => (
                              <div key={roundIndex} className="round">
                                <div className="round-title">
                                  Round {roundIndex + 1}
                                </div>
                                <div className="score-inputs">
                                  <input
                                    type="number"
                                    min="0"
                                    value={round.fighterA}
                                    onChange={(e) =>
                                      handleScoreChange(
                                        match.id,
                                        roundIndex,
                                        "A",
                                        e.target.value
                                      )
                                    }
                                    disabled={matchResult.completed}
                                    className={
                                      round.winner === "A" ? "winner" : ""
                                    }
                                  />
                                  <span className="separator">-</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={round.fighterB}
                                    onChange={(e) =>
                                      handleScoreChange(
                                        match.id,
                                        roundIndex,
                                        "B",
                                        e.target.value
                                      )
                                    }
                                    disabled={matchResult.completed}
                                    className={
                                      round.winner === "B" ? "winner" : ""
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="match-actions">
                            {!matchResult.completed && (
                              <>
                                <button
                                  className="finalize-btn"
                                  onClick={() => finalizeMatch(match.id)}
                                >
                                  Valider le résultat
                                </button>

                                <button
                                  className="save-btn"
                                  onClick={(e) => {
                                    console.log(
                                      "=== Clic sur le bouton Valider et Sauvegarder ==="
                                    );
                                    console.log("Event:", e);
                                    finalizeAndSaveMatch(match.id);
                                  }}
                                  disabled={savingMatch === match.id}
                                >
                                  {savingMatch === match.id
                                    ? "Sauvegarde..."
                                    : "Valider et Sauvegarder"}
                                </button>
                              </>
                            )}

                            {matchResult.completed && (
                              <div className="match-result">
                                <span>
                                  Vainqueur:{" "}
                                  {matchResult.winner === "A"
                                    ? getParticipantName(match, 0)
                                    : getParticipantName(match, 1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="navigation-buttons">
            <button className="prev-btn" onClick={prevStep}>
              Précédent
            </button>
            <button
              className="next-btn"
              onClick={handleContinue}
              disabled={
                pendingCount > 0 && !showCompleted && dataSource !== "existing"
              }
            >
              Finaliser et voir les résultats
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScoreInput;
