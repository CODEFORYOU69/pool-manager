import { jsPDF } from "jspdf";
import "jspdf-autotable";
import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  getCompletedMatches,
  getMatchByNumber,
  loadResults,
  saveMatchResult,
  updateMatchResult,
} from "../services/dbService";
import "../styles/ScoreInput.css";
import { findPssInfo } from "../utils/categories";
import { findPowerThreshold } from "../utils/constants";

// Classe utilitaire pour limiter le nombre de requêtes API simultanées
class RequestQueue {
  constructor(maxConcurrent = 5) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
  }

  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { request, resolve, reject } = this.queue.shift();

    try {
      const result = await request();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
}

// Instancier la file d'attente de requêtes
const requestQueue = new RequestQueue(5);

// Fonction d'encapsulation pour fetch qui utilise la file d'attente
const queuedFetch = (url, options) => {
  return requestQueue.add(() => fetch(url, options));
};

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
  // Nouvel état pour stocker la date de la compétition
  const [competitionDate, setCompetitionDate] = useState(null);
  // Nouvel état pour suivre les retards par aire et les heures de fin estimées
  const [areasDelayInfo, setAreasDelayInfo] = useState({});
  const [groups, setGroups] = useState([]);
  const [matchesWithPssInfo, setMatchesWithPssInfo] = useState({});
  const [pendingPssRequests, setPendingPssRequests] = useState(new Set());
  const [isThrottling, setIsThrottling] = useState(false);
  // État pour indiquer un rafraîchissement en cours
  const [refreshing, setRefreshing] = useState(false);

  // Nouveaux états pour la gestion du vainqueur obligatoire
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [currentTieData, setCurrentTieData] = useState(null);

  // Charger les matchs et les résultats
  const loadMatchesAndResults = async () => {
    try {
      if (!refreshing) {
        setIsLoading(true);
      }

      // Sauvegarder l'état actuel des informations PSS avant le rafraîchissement
      const currentPssInfo = { ...matchesWithPssInfo };
      const currentPendingRequests = new Set(pendingPssRequests);

      // Charger les matchs avec les participants
      const matchesRes = await fetch(
        `${API_URL}/competition/${competitionId}/matches?include=matchParticipants`
      );
      if (!matchesRes.ok) {
        throw new Error("Erreur lors du chargement des matchs");
      }
      const matchesData = await matchesRes.json();

      if (matchesData && matchesData.data) {
        const allMatches = matchesData.data.matches || [];

        // S'assurer que les participants sont dans le bon ordre pour l'affichage
        const processedMatches = allMatches.map((match) => {
          if (match.matchParticipants) {
            const participantA = match.matchParticipants.find(
              (p) => p.position === "A"
            );
            const participantB = match.matchParticipants.find(
              (p) => p.position === "B"
            );

            // Créer un tableau participants dans le bon ordre
            match.participants = [];
            if (participantA) match.participants[0] = participantA.participant;
            if (participantB) match.participants[1] = participantB.participant;
          }
          return match;
        });

        setCurrentMatches(processedMatches);
        setAreasCount(
          Math.max(...processedMatches.map((m) => m.areaNumber || 1))
        );

        if (matchesData.data.groups) {
          setGroups(matchesData.data.groups);
        }
      }

      // Charger les résultats
      const res = await loadResults(competitionId);
      if (res && res.data) {
        setResults(res.data);
      }

      // Charger les matchs terminés
      await loadCompletedMatches();

      // Restaurer les informations PSS déjà chargées
      setMatchesWithPssInfo((prev) => ({
        ...currentPssInfo,
        ...prev,
      }));

      // Si des requêtes étaient en cours, les maintenir dans l'état
      if (currentPendingRequests.size > 0) {
        setPendingPssRequests(currentPendingRequests);
      }

      setIsLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error(
        "Erreur lors du chargement des matchs et résultats:",
        error
      );
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Rafraîchissement automatique toutes les 60 secondes
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshing(true);
      loadMatchesAndResults();
    }, 60000); // 60 secondes = 1 minute

    // Nettoyage de l'intervalle quand le composant est démonté
    return () => clearInterval(intervalId);
  }, [competitionId]);

  // Chargement initial des données
  useEffect(() => {
    const initializeMatches = async () => {
      try {
        if (matches && matches.length > 0) {
          console.log(
            "Utilisation des matchs fournis par les props:",
            matches.length
          );

          // Vérifier si les matchs ont déjà les matchParticipants
          const needsParticipants = !matches.some((m) => m.matchParticipants);

          if (needsParticipants && competitionId) {
            // Charger les matchs avec les participants depuis l'API
            const matchesRes = await fetch(
              `${API_URL}/competition/${competitionId}/matches?include=matchParticipants`
            );
            if (matchesRes.ok) {
              const matchesData = await matchesRes.json();
              if (matchesData && matchesData.data && matchesData.data.matches) {
                setCurrentMatches(matchesData.data.matches);
                setAreasCount(
                  Math.max(
                    ...matchesData.data.matches.map((m) => m.areaNumber || 1)
                  )
                );
              }
            }
          } else {
            setCurrentMatches(matches);
            setAreasCount(Math.max(...matches.map((m) => m.areaNumber || 1)));
          }

          await loadCompletedMatches();
          setIsLoading(false);
        } else if (competitionId) {
          await loadMatchesAndResults();
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation des matchs:", error);
        setIsLoading(false);
      }
    };

    initializeMatches();
  }, [matches, competitionId]);

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

    // Utiliser la date de la compétition au lieu de la date actuelle
    // C'est crucial pour que les calculs fonctionnent correctement le jour de la compétition
    const competitionDay = competitionDate || new Date();

    // Récupérer l'heure actuelle basée sur la date de compétition
    const now = new Date();
    const nowTime = new Date(competitionDay);
    nowTime.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    );

    // Trouver l'heure de début prévue de la compétition (premier match du planning)
    const sortedSchedule = [...schedule].sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );

    // Utiliser la date de compétition pour l'heure de début
    let competitionStartTime = null;
    if (sortedSchedule.length > 0) {
      const startTimeOriginal = new Date(sortedSchedule[0].startTime);
      competitionStartTime = new Date(competitionDay);
      competitionStartTime.setHours(
        startTimeOriginal.getHours(),
        startTimeOriginal.getMinutes(),
        startTimeOriginal.getSeconds()
      );
    }

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
          // Extraire les heures de l'endTime prévu et les appliquer à la date de compétition
          const scheduledEndOriginal = new Date(
            scheduledMatchForCompleted.endTime
          );
          const scheduledEndTime = new Date(competitionDay);
          scheduledEndTime.setHours(
            scheduledEndOriginal.getHours(),
            scheduledEndOriginal.getMinutes(),
            scheduledEndOriginal.getSeconds()
          );

          // Extraire les heures de l'endTime réel et les appliquer à la date de compétition
          const actualEndOriginal = new Date(lastCompleted.endTime);
          const actualEndTime = new Date(competitionDay);
          actualEndTime.setHours(
            actualEndOriginal.getHours(),
            actualEndOriginal.getMinutes(),
            actualEndOriginal.getSeconds()
          );

          // Calculer le retard en minutes
          const delayInMs = actualEndTime - scheduledEndTime;
          const delayInMinutes = Math.round(delayInMs / 60000);

          // Calculer la nouvelle heure de fin estimée
          const originalScheduledEndOriginal = new Date(lastScheduled.endTime);
          const originalScheduledEndTime = new Date(competitionDay);
          originalScheduledEndTime.setHours(
            originalScheduledEndOriginal.getHours(),
            originalScheduledEndOriginal.getMinutes(),
            originalScheduledEndOriginal.getSeconds()
          );

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
        // Calculer le retard basé sur l'heure de début prévue de la compétition en utilisant nowTime
        const timeSinceScheduledStart = nowTime - competitionStartTime;
        const delayInMinutes = Math.round(timeSinceScheduledStart / 60000);

        // Ne compter comme retard que si l'heure actuelle est après l'heure prévue de début
        const actualDelayInMinutes = delayInMinutes > 0 ? delayInMinutes : 0;

        // Calculer la nouvelle heure de fin estimée
        const originalScheduledEndOriginal = new Date(lastScheduled.endTime);
        const originalScheduledEndTime = new Date(competitionDay);
        originalScheduledEndTime.setHours(
          originalScheduledEndOriginal.getHours(),
          originalScheduledEndOriginal.getMinutes(),
          originalScheduledEndOriginal.getSeconds()
        );

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
    // Vérifier que fighter est bien une position valide "A" ou "B"
    if (fighter !== "A" && fighter !== "B") {
      console.error(`Position de combattant invalide: ${fighter}`);
      return;
    }

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
        positionsFixed: true,
      };

      // Mettre à jour le score du round
      const updatedRounds = [...matchResult.rounds];
      if (fighter === "A") {
        updatedRounds[roundIndex] = {
          ...updatedRounds[roundIndex],
          fighterA: scoreValue,
        };
      } else {
        // fighter === "B"
        updatedRounds[roundIndex] = {
          ...updatedRounds[roundIndex],
          fighterB: scoreValue,
        };
      }

      // Déterminer le vainqueur du round
      const round = updatedRounds[roundIndex];
      if (round.fighterA > round.fighterB) {
        round.winner = "A"; // Utiliser la chaîne "A" pour le vainqueur
      } else if (round.fighterB > round.fighterA) {
        round.winner = "B"; // Utiliser la chaîne "B" pour le vainqueur
      } else {
        round.winner = null;
      }

      // Vérifier si les deux premiers rounds ont été gagnés par le même combattant
      if (roundIndex <= 1) {
        // Seulement vérifier après modification des rounds 0 ou 1
        const twoRoundsWonByA =
          updatedRounds[0].winner === "A" && updatedRounds[1].winner === "A";
        const twoRoundsWonByB =
          updatedRounds[0].winner === "B" && updatedRounds[1].winner === "B";

        // Si le même combattant a gagné les deux premiers rounds, désactiver le 3ème
        if (twoRoundsWonByA || twoRoundsWonByB) {
          // Réinitialiser le 3ème round
          updatedRounds[2] = { fighterA: 0, fighterB: 0, winner: null };
        }
      }

      // Vérifier s'il y a égalité dans le round actuel
      if (round.fighterA === round.fighterB && round.fighterA > 0) {
        // Programmer l'ouverture du modal pour choisir le vainqueur
        setTimeout(() => {
          const matchInfo = currentMatches.find((m) => m.id === matchId);
          setCurrentTieData({
            matchId,
            roundIndex,
            round,
            matchInfo,
          });
          setShowWinnerModal(true);
        }, 100);
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          rounds: updatedRounds,
          positionsFixed: true,
        },
      };
    });
  };

  // Fonction pour sélectionner un vainqueur en cas d'égalité
  const handleTieWinnerSelection = (winner) => {
    if (!currentTieData) return;

    const { matchId, roundIndex } = currentTieData;

    setMatchResults((prev) => {
      const matchResult = prev[matchId];
      if (!matchResult) return prev;

      const updatedRounds = [...matchResult.rounds];
      updatedRounds[roundIndex] = {
        ...updatedRounds[roundIndex],
        winner, // "A" ou "B"
      };

      // Vérifier si les deux premiers rounds ont été gagnés par le même combattant
      const twoRoundsWonByA =
        updatedRounds[0].winner === "A" && updatedRounds[1].winner === "A";
      const twoRoundsWonByB =
        updatedRounds[0].winner === "B" && updatedRounds[1].winner === "B";

      // Si le même combattant a gagné les deux premiers rounds, désactiver le 3ème
      if (twoRoundsWonByA || twoRoundsWonByB) {
        // Réinitialiser le 3ème round
        updatedRounds[2] = { fighterA: 0, fighterB: 0, winner: null };
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          rounds: updatedRounds,
        },
      };
    });

    // Fermer le modal
    setShowWinnerModal(false);
    setCurrentTieData(null);
  };

  // Finaliser un match
  const finalizeMatch = (matchId) => {
    setMatchResults((prev) => {
      const matchResult = prev[matchId];

      if (!matchResult) return prev;

      // Vérifier si tous les rounds nécessaires ont un vainqueur
      const rounds = matchResult.rounds;

      // Vérifier les deux premiers rounds
      if (rounds[0].winner === null || rounds[1].winner === null) {
        // Il manque un vainqueur dans les deux premiers rounds
        alert(
          "Tous les rounds doivent avoir un vainqueur. Veuillez désigner un vainqueur pour chaque round à égalité."
        );
        return prev;
      }

      // Vérifier si les deux premiers rounds ont été gagnés par le même combattant
      const twoRoundsWonByA =
        rounds[0].winner === "A" && rounds[1].winner === "A";
      const twoRoundsWonByB =
        rounds[0].winner === "B" && rounds[1].winner === "B";

      // Si un troisième round est nécessaire, vérifier qu'il a un vainqueur
      if (!twoRoundsWonByA && !twoRoundsWonByB) {
        // Les deux premiers rounds ont été gagnés par des combattants différents
        // Le 3ème round est donc nécessaire
        if (rounds[2].winner === null) {
          alert(
            "Le troisième round doit avoir un vainqueur. Veuillez désigner un vainqueur pour ce round."
          );
          return prev;
        }
      }

      // Compter les rounds gagnés en comparant avec les chaînes "A" et "B"
      const roundsWonByA = matchResult.rounds.filter(
        (r) => r.winner === "A" // "A" est une chaîne
      ).length;
      const roundsWonByB = matchResult.rounds.filter(
        (r) => r.winner === "B" // "B" est une chaîne
      ).length;

      // Déterminer le vainqueur du match en utilisant des chaînes "A" et "B"
      let winner = null;
      if (roundsWonByA > roundsWonByB) {
        winner = "A"; // Utiliser la chaîne "A"
      } else if (roundsWonByB > roundsWonByA) {
        winner = "B"; // Utiliser la chaîne "B"
      } else {
        // Cela ne devrait pas arriver avec la logique de vainqueur obligatoire
        alert(
          "Erreur: Le nombre de rounds gagnés est égal. Cela ne devrait pas arriver avec la logique de vainqueur obligatoire."
        );
        return prev;
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          winner,
          completed: true,
          positionsFixed: true,
        },
      };
    });
  };

  // Finaliser et sauvegarder un match
  const finalizeAndSaveMatch = async (matchId) => {
    setSavingMatch(matchId);

    try {
      // D'abord finaliser le match localement
      finalizeMatch(matchId);

      // Attendre un cycle pour s'assurer que le state est à jour
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Récupérer les résultats du match
      const matchResult = matchResults[matchId];

      // Récupérer le match depuis la liste des matchs actuels
      const matchData = currentMatches.find((m) => m.id === matchId);
      if (!matchData) {
        throw new Error("Match non trouvé dans les données locales");
      }

      const matchNumber = matchData.matchNumber || matchData.number;

      try {
        // Utiliser la nouvelle fonction getMatchByNumber
        const dbMatch = await getMatchByNumber(competitionId, matchNumber);

        // Créer une copie du résultat du match pour éviter de modifier l'original
        const resultToSave = { ...matchResult };

        // Garantir la cohérence des positions A/B entre l'interface et la base de données
        if (
          dbMatch.matchParticipants &&
          dbMatch.matchParticipants.length >= 2
        ) {
          // Récupérer les participants de la BD avec leurs positions explicites
          const dbParticipantA = dbMatch.matchParticipants.find(
            (p) => p.position === "A" // Position stockée comme chaîne "A"
          )?.participant;
          const dbParticipantB = dbMatch.matchParticipants.find(
            (p) => p.position === "B" // Position stockée comme chaîne "B"
          )?.participant;

          // Participants de l'interface (participants[0] est normalement A, participants[1] est B)
          const localParticipantA = matchData.participants?.[0];
          const localParticipantB = matchData.participants?.[1];

          // Vérifier si les positions sont inversées (comparaison par ID)
          const positionsInverted =
            (localParticipantA &&
              dbParticipantB &&
              localParticipantA.id === dbParticipantB.id) ||
            (localParticipantB &&
              dbParticipantA &&
              localParticipantB.id === dbParticipantA.id);

          if (positionsInverted) {
            console.log(
              "Correction des positions inversées pour le match:",
              matchNumber
            );
            // Inverser les scores des rounds
            resultToSave.rounds = resultToSave.rounds.map((round) => ({
              fighterA: round.fighterB,
              fighterB: round.fighterA,
              winner:
                round.winner === "A" ? "B" : round.winner === "B" ? "A" : null,
            }));

            // Inverser le vainqueur global
            resultToSave.winner =
              resultToSave.winner === "A"
                ? "B"
                : resultToSave.winner === "B"
                ? "A"
                : null;
          }
        }

        // Utiliser l'ID correct de la base de données
        const correctMatchId = dbMatch.id;

        if (resultToSave) {
          const saveResult = await saveMatchResult(
            correctMatchId,
            resultToSave
          );

          if (saveResult.success) {
            // Recharger immédiatement les matchs terminés pour avoir des affichages cohérents
            await loadCompletedMatches();

            // Trouver et mettre à jour le prochain match de la même aire et de la même compétition
            const nextMatchNumber = matchData.matchNumber + 1;
            const nextMatch = currentMatches.find(
              (m) =>
                m.matchNumber === nextMatchNumber &&
                m.areaNumber === matchData.areaNumber &&
                m.status === "pending" &&
                m.groupId.startsWith(competitionId) // Vérifie explicitement la compétition
            );

            if (nextMatch) {
              try {
                // Mettre à jour le statut du prochain match dans la base de données
                await updateMatchResult(nextMatch.id, {
                  ...nextMatch,
                  status: "in_progress",
                });

                // Mettre à jour le statut dans l'état local
                setCurrentMatches((prev) =>
                  prev.map((m) =>
                    m.id === nextMatch.id
                      ? { ...m, status: "in_progress" }
                      : m.id === matchId
                      ? { ...m, status: "completed" }
                      : m
                  )
                );
              } catch (error) {
                console.error(
                  "Erreur lors de la mise à jour du statut du prochain match:",
                  error
                );
              }
            }

            // Mettre à jour le statut dans l'état local
            setCurrentMatches((prev) =>
              prev.map((m) =>
                m.id === matchId ? { ...m, status: "completed" } : m
              )
            );

            // Mettre à jour l'état local des matchResults
            setMatchResults((prev) => {
              const updatedResults = { ...prev };
              if (updatedResults[matchId]) {
                updatedResults[matchId] = {
                  ...updatedResults[matchId],
                  completed: true,
                };
              }

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
              [correctMatchId]: resultToSave,
            }));

            // Basculer vers l'onglet des combats terminés
            setTimeout(() => {
              setShowCompleted(true);
              if (saveResult.winnerParticipant) {
                alert(
                  "Match terminé avec succès! Vainqueur: " +
                    `${saveResult.winnerParticipant.prenom} ${saveResult.winnerParticipant.nom}` +
                    " - 3 points attribués"
                );
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error("Erreur lors de la sauvegarde du match:", error);
        alert("Erreur lors de la sauvegarde du match. Veuillez réessayer.");
      }
    } catch (error) {
      console.error("Erreur lors de la finalisation du match:", error);
      alert("Erreur lors de la finalisation du match. Veuillez réessayer.");
    } finally {
      setSavingMatch(null);
    }
  };

  // Fonction pour commencer l'édition d'un match
  const startEditMatch = (match) => {
    // Identifier les participants avec leurs positions explicites A/B
    const participantA = match.matchParticipants?.find(
      (p) => p.position === "A"
    )?.participant;
    const participantB = match.matchParticipants?.find(
      (p) => p.position === "B"
    )?.participant;

    // Si on n'a pas les matchParticipants, essayer de les récupérer depuis l'API
    if (!match.matchParticipants && match.id) {
      queuedFetch(`${API_URL}/match/${match.id}?include=matchParticipants`)
        .then((response) => response.json())
        .then((data) => {
          if (data.matchParticipants) {
            // Mettre à jour le match dans matches
            setCurrentMatches((prev) =>
              prev.map((m) =>
                m.id === match.id
                  ? { ...m, matchParticipants: data.matchParticipants }
                  : m
              )
            );

            // Relancer startEditMatch avec les données mises à jour
            startEditMatch({
              ...match,
              matchParticipants: data.matchParticipants,
            });
          }
        })
        .catch((error) => {
          console.error(
            "Erreur lors de la récupération des participants:",
            error
          );
        });
      return; // Sortir de la fonction et attendre la récupération des données
    }

    // Déterminer la position du vainqueur (A ou B) en fonction de l'ID
    const winnerPosition =
      match.winner === participantA?.id
        ? "A"
        : match.winner === participantB?.id
        ? "B"
        : null;

    console.log(
      "Édition du match:",
      match.matchNumber,
      "Vainqueur:",
      winnerPosition
    );

    // Initialiser les scores en s'assurant que les positions A/B sont correctes
    setEditingMatch(match);
    setEditedScores({
      rounds: match.rounds.map((round) => {
        // Utiliser les scores tels qu'ils sont dans la base de données
        // sans les inverser, car ils correspondent déjà aux positions A/B
        return {
          scoreA: round.scoreA,
          scoreB: round.scoreB,
          winner:
            round.winnerPosition ||
            (round.winner === participantA?.id
              ? "A"
              : round.winner === participantB?.id
              ? "B"
              : null),
        };
      }),
      winner: winnerPosition,
    });
  };

  // Fonction pour mettre à jour un score pendant l'édition
  const handleEditScoreChange = (roundIndex, fighter, value) => {
    // Vérifier que fighter est bien une position valide "A" ou "B"
    if (fighter !== "A" && fighter !== "B") {
      console.error(
        `Position de combattant invalide lors de l'édition: ${fighter}`
      );
      return;
    }

    const newScores = { ...editedScores };
    const round = newScores.rounds[roundIndex];

    if (fighter === "A") {
      round.scoreA = parseInt(value) || 0;
    } else {
      // fighter === "B"
      round.scoreB = parseInt(value) || 0;
    }

    // Déterminer le vainqueur du round
    if (round.scoreA > round.scoreB) {
      round.winner = "A"; // Chaîne "A" pour le vainqueur
    } else if (round.scoreB > round.scoreA) {
      round.winner = "B"; // Chaîne "B" pour le vainqueur
    } else {
      round.winner = null;
    }

    // Déterminer le vainqueur du match
    const roundsWonByA = newScores.rounds.filter(
      (r) => r.winner === "A" // Comparer avec la chaîne "A"
    ).length;
    const roundsWonByB = newScores.rounds.filter(
      (r) => r.winner === "B" // Comparer avec la chaîne "B"
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
      // Récupérer les participants A et B par leur position explicite
      const participantA = editingMatch.matchParticipants?.find(
        (p) => p.position === "A"
      )?.participant;

      const participantB = editingMatch.matchParticipants?.find(
        (p) => p.position === "B"
      )?.participant;

      if (!participantA || !participantB) {
        throw new Error("Participants du match incomplets");
      }

      console.log("Édition du match:", editingMatch.matchNumber);
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

      // Déterminer l'ID du vainqueur en fonction de la position A/B
      let winnerId = null;
      if (editedScores.winner === "A") {
        winnerId = participantA.id;
        console.log(
          `Vainqueur: A (${participantA.prenom} ${participantA.nom}, ID: ${participantA.id})`
        );
      } else if (editedScores.winner === "B") {
        winnerId = participantB.id;
        console.log(
          `Vainqueur: B (${participantB.prenom} ${participantB.nom}, ID: ${participantB.id})`
        );
      } else {
        console.log("Pas de vainqueur déterminé");
      }

      // Créer des rounds avec les bons IDs de participants et la position du vainqueur
      const updatedRounds = editedScores.rounds.map((round) => {
        // Déterminer le vainqueur du round (ID et position)
        let roundWinnerId = null;
        let roundWinnerPosition = null;

        if (round.winner === "A") {
          roundWinnerId = participantA.id;
          roundWinnerPosition = "A";
        } else if (round.winner === "B") {
          roundWinnerId = participantB.id;
          roundWinnerPosition = "B";
        }

        console.log(
          `Round - Scores: ${round.scoreA}-${round.scoreB}, Vainqueur: ${roundWinnerPosition} (ID: ${roundWinnerId})`
        );

        return {
          scoreA: round.scoreA,
          scoreB: round.scoreB,
          winner: roundWinnerId, // ID du participant vainqueur
          winnerPosition: roundWinnerPosition, // Position du vainqueur (A ou B)
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

      console.log("Match préparé pour mise à jour:", {
        id: updatedMatch.id,
        winner: updatedMatch.winner,
        rounds: updatedMatch.rounds.map((r) => ({
          scoreA: r.scoreA,
          scoreB: r.scoreB,
          winner: r.winner,
          winnerPosition: r.winnerPosition,
        })),
      });

      await updateMatchResult(editingMatch.id, updatedMatch);
      console.log("Match mis à jour avec succès");

      // Recharger la liste des matchs immédiatement pour garantir l'affichage correct
      await loadCompletedMatches();

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
      // S'assurer que position est une chaîne "A" ou "B"
      if (typeof position === "number") {
        position = position === 0 ? "A" : "B";
      }

      if (position !== "A" && position !== "B") {
        console.warn(
          `Position invalide: ${position}, utilisation de "A" par défaut`
        );
        position = "A";
      }

      // Chercher directement dans matchParticipants avec la position
      if (match.matchParticipants && match.matchParticipants.length > 0) {
        const participantInfo = match.matchParticipants.find(
          (p) => p.position === position
        );

        if (participantInfo?.participant) {
          const participant = participantInfo.participant;
          return (
            `${participant.prenom || ""} ${participant.nom || ""}`.trim() ||
            "Inconnu"
          );
        }
      }

      // Si matchParticipants n'est pas disponible, tenter de le récupérer via API
      if (!match.matchParticipants && match.id) {
        // Utiliser queuedFetch pour limiter les requêtes simultanées
        queuedFetch(`${API_URL}/match/${match.id}?include=matchParticipants`)
          .then((response) => response.json())
          .then((data) => {
            if (data.matchParticipants) {
              setCurrentMatches((prev) =>
                prev.map((m) =>
                  m.id === match.id
                    ? { ...m, matchParticipants: data.matchParticipants }
                    : m
                )
              );
            }
          })
          .catch((error) => {
            console.error(
              "Erreur lors de la récupération des participants:",
              error
            );
          });
      }

      // En dernier recours, fallback sur le tableau participants[] si disponible
      if (match.participants && match.participants.length > 0) {
        const index = position === "A" ? 0 : 1;
        if (index < match.participants.length) {
          const participant = match.participants[index];
          if (participant) {
            return (
              `${participant.prenom || ""} ${participant.nom || ""}`.trim() ||
              "Inconnu"
            );
          }
        }
      }

      return "Inconnu";
    } catch (error) {
      console.error("Erreur lors de l'accès aux informations de nom:", error);
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
    // Si nous avons déjà des infos ou une requête en cours pour ce match, sortir
    if (
      matchesWithPssInfo[matchNumber] ||
      pendingPssRequests.has(matchNumber)
    ) {
      return null;
    }

    // Ajouter à la liste des requêtes en cours
    setPendingPssRequests((prev) => {
      const newSet = new Set(prev);
      newSet.add(matchNumber);
      return newSet;
    });

    try {
      // Récupérer les infos
      const pssInfo = await fetchPssInfoByMatchNumber(matchNumber);

      if (pssInfo) {
        // Mettre à jour l'état avec les nouvelles infos de manière persistante
        setMatchesWithPssInfo((prev) => ({
          ...prev,
          [matchNumber]: pssInfo,
        }));
        return pssInfo;
      }
      return null;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des infos PSS pour le match #${matchNumber}:`,
        error
      );
      return null;
    } finally {
      // Retirer de la liste des requêtes en cours
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
  const renderCompletedMatches = () => {
    return (
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
                // Identifier les participants en utilisant leur position A/B explicite
                const participantA = match.matchParticipants?.find(
                  (p) => p.position === "A"
                )?.participant;
                const participantB = match.matchParticipants?.find(
                  (p) => p.position === "B"
                )?.participant;

                if (!participantA || !participantB) return null;

                // Important: Utiliser l'ID du participant pour déterminer le vainqueur
                // et non la position, pour maintenir la cohérence entre les vues
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

                // Assurer que les scores sont affichés dans le bon ordre (A-B)
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
                        style={{
                          marginBottom: "5px",
                          display: "block",
                          width: "100%",
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => resetMatch(match)}
                        className="delete-btn"
                        style={{
                          backgroundColor: "#f44336",
                          color: "white",
                          padding: "5px 10px",
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: "bold",
                          display: "block",
                          width: "100%",
                        }}
                      >
                        Supprimer
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
  };

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
      // Ajout d'un délai aléatoire pour éviter la synchronisation des requêtes
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

      // Récupérer d'abord le match par son numéro
      const matchData = await getMatchByNumber(competitionId, matchNumber);

      if (!matchData) {
        return null;
      }

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
            return pssInfo;
          }

          // Fallback à findPowerThreshold
          const powerThreshold = findPowerThreshold(
            ageCategory,
            gender,
            weightCategory
          );

          if (powerThreshold) {
            return powerThreshold;
          }
        }
      }

      // Si nous n'avons pas pu récupérer les informations à partir du cache,
      // faire une requête pour obtenir les informations du groupe
      const response = await queuedFetch(
        `${API_URL}/group/${matchData.groupId}`
      );
      if (!response.ok) {
        return null;
      }

      const group = await response.json();

      // Maintenant utiliser les informations du groupe pour trouver les seuils PSS
      const ageCategory = group.ageCategoryName;
      const gender = group.gender;
      const weightCategory = group.weightCategoryName;

      // Essayer d'abord avec findPssInfo
      const pssInfo = findPssInfo(ageCategory, gender, weightCategory);

      if (pssInfo) {
        return pssInfo;
      }

      // Fallback à findPowerThreshold
      const powerThreshold = findPowerThreshold(
        ageCategory,
        gender,
        weightCategory
      );
      if (powerThreshold) {
        return powerThreshold;
      }

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
    if (!currentMatches || currentMatches.length === 0) return;

    // Fonction qui va traiter le chargement des informations PSS de manière séquentielle
    const processQueue = async () => {
      if (isThrottling || refreshing) return;

      setIsThrottling(true);

      // Accorder la priorité aux matchs visibles dans l'interface
      const visibleMatches = currentMatches
        .filter(
          (match) =>
            match.matchNumber &&
            !matchesWithPssInfo[match.matchNumber] &&
            !pendingPssRequests.has(match.matchNumber) &&
            (match.status !== "completed" || showCompleted)
        )
        .slice(0, 10);

      if (visibleMatches.length > 0) {
        const match = visibleMatches[0];
        try {
          await fetchPssInfoForMatch(match.matchNumber);
        } catch (error) {
          console.error(`Erreur dans fetchPssInfoForMatch: ${error.message}`);
        }
      }

      // Attendre avant de permettre la prochaine requête
      setTimeout(() => {
        setIsThrottling(false);
      }, 250);
    };

    // Lancer le traitement et le répéter toutes les 500ms
    const intervalId = setInterval(processQueue, 500);

    // Nettoyer l'intervalle quand le composant est démonté
    return () => clearInterval(intervalId);
  }, [
    currentMatches,
    matchesWithPssInfo,
    pendingPssRequests,
    isThrottling,
    refreshing,
    showCompleted,
  ]);

  // Fonction pour réinitialiser un match (supprimer les résultats et remettre en statut "pending")
  const resetMatch = async (match) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer les résultats du match #${match.matchNumber} ?`
      )
    ) {
      return;
    }

    try {
      console.log(
        `Réinitialisation du match #${match.matchNumber} (ID: ${match.id})`
      );

      // Préparer un objet de match avec le statut "pending" et sans vainqueur ni rounds
      const resetMatchData = {
        ...match,
        status: "pending",
        winner: null,
        rounds: [], // Supprimer tous les rounds
        endTime: null,
        pointMatch: 0, // Remettre les points à 0
      };

      console.log("Données du match réinitialisé:", resetMatchData);

      // Mettre à jour le match dans la base de données
      await updateMatchResult(match.id, resetMatchData);
      console.log("Match réinitialisé avec succès");

      // Recharger la liste des matchs complétés
      await loadCompletedMatches();

      // Recalculer les retards
      const updatedDelayInfo = calculateAreasDelayInfo();
      setAreasDelayInfo(updatedDelayInfo);

      // Notification à l'utilisateur
      alert(`Le match #${match.matchNumber} a été réinitialisé avec succès.`);
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du match:", error);
      alert("Erreur lors de la réinitialisation du match. Veuillez réessayer.");
    }
  };

  // Ajouter ce composant modal pour la sélection du vainqueur en cas d'égalité
  const renderWinnerSelectionModal = () => {
    if (!showWinnerModal || !currentTieData) return null;

    const { matchId, roundIndex, round, matchInfo } = currentTieData;

    // Récupérer les noms des combattants
    const participantA = getParticipantName(matchInfo, "A");
    const participantB = getParticipantName(matchInfo, "B");

    return (
      <div className="winner-modal-overlay">
        <div className="winner-modal">
          <div className="winner-modal-header">
            <h3>Égalité au Round {roundIndex + 1}</h3>
            <p>
              Score: {round.fighterA} - {round.fighterB}
            </p>
            <p>Vous devez désigner un vainqueur pour ce round.</p>
          </div>
          <div className="winner-modal-body">
            <button
              className="winner-btn winner-btn-blue"
              onClick={() => handleTieWinnerSelection("A")}
            >
              {participantA} (Bleu)
            </button>
            <button
              className="winner-btn winner-btn-red"
              onClick={() => handleTieWinnerSelection("B")}
            >
              {participantB} (Rouge)
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="score-input-container">
      <h2>Étape 5: Saisie des scores</h2>
      {refreshing && (
        <div className="refresh-indicator">Mise à jour des données...</div>
      )}

      {/* Modal de sélection du vainqueur en cas d'égalité */}
      {renderWinnerSelectionModal()}

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
                              {/* Position A (bleu) */}
                              {getParticipantName(match, "A")}
                            </div>
                            <div className="vs">VS</div>
                            <div
                              className={`fighter fighter-b ${
                                matchResult.winner === "B" ? "winner" : ""
                              }`}
                            >
                              {/* Position B (rouge) */}
                              {getParticipantName(match, "B")}
                            </div>
                          </div>

                          <div className="rounds-scores">
                            {matchResult.rounds.map((round, roundIndex) => {
                              // Vérifier si les deux premiers rounds ont été gagnés par le même combattant
                              const twoRoundsWonByA =
                                matchResult.rounds[0].winner === "A" &&
                                matchResult.rounds[1].winner === "A";
                              const twoRoundsWonByB =
                                matchResult.rounds[0].winner === "B" &&
                                matchResult.rounds[1].winner === "B";

                              // Déterminer si ce round est le 3ème et s'il doit être désactivé
                              const isThirdRound = roundIndex === 2;
                              const isDisabled =
                                isThirdRound &&
                                (twoRoundsWonByA || twoRoundsWonByB);

                              // Vérifier si c'est un round à égalité sans vainqueur désigné
                              const isTieWithoutWinner =
                                round.fighterA === round.fighterB &&
                                round.fighterA > 0 &&
                                round.winner === null;

                              return (
                                <div
                                  key={roundIndex}
                                  className={`round ${
                                    isDisabled ? "disabled" : ""
                                  } ${
                                    isTieWithoutWinner ? "tie-no-winner" : ""
                                  }`}
                                >
                                  <div className="round-title">
                                    Round {roundIndex + 1}
                                    {isDisabled && (
                                      <span className="disabled-note">
                                        {" "}
                                        (Non nécessaire)
                                      </span>
                                    )}
                                  </div>
                                  <div className="score-inputs">
                                    {/* Toujours afficher le participant A à gauche */}
                                    <div className="fighter-score">
                                      <span className="fighter-label">
                                        {getParticipantName(match, "A")}
                                      </span>
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
                                        disabled={
                                          matchResult.completed || isDisabled
                                        }
                                        className={
                                          round.winner === "A" ? "winner" : ""
                                        }
                                      />
                                    </div>
                                    <span className="separator">VS</span>
                                    {/* Toujours afficher le participant B à droite */}
                                    <div className="fighter-score">
                                      <span className="fighter-label">
                                        {getParticipantName(match, "B")}
                                      </span>
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
                                        disabled={
                                          matchResult.completed || isDisabled
                                        }
                                        className={
                                          round.winner === "B" ? "winner" : ""
                                        }
                                      />
                                    </div>
                                  </div>
                                  {isTieWithoutWinner && (
                                    <div className="tie-actions">
                                      <button
                                        className="select-winner-btn select-winner-blue"
                                        onClick={() =>
                                          handleTieWinnerSelection("A")
                                        }
                                      >
                                        {getParticipantName(match, "A")} (Bleu)
                                      </button>
                                      <button
                                        className="select-winner-btn select-winner-red"
                                        onClick={() =>
                                          handleTieWinnerSelection("B")
                                        }
                                      >
                                        {getParticipantName(match, "B")} (Rouge)
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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
                                    ? getParticipantName(match, "A")
                                    : matchResult.winner === "B"
                                    ? getParticipantName(match, "B")
                                    : "Match nul"}
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
