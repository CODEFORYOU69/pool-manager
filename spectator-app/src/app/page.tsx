"use client";

import AllMatches from "@/components/AllMatches";
import LiveMatches from "@/components/LiveMatches";
import MatchFilters from "@/components/MatchFilters";
import MatchHistory from "@/components/MatchHistory";
import Results from "@/components/Results";
import TournamentHeader from "@/components/TournamentHeader";
import { Competition, Match } from "@/types";
import Image from "next/image";
import { useEffect, useState } from "react";

// URL de l'API - toujours utiliser les routes internes Next.js
const API_URL = "/api";

// Types pour les retards
interface DelayInfo {
  delayInMinutes: number;
  lastCompletedMatch: number | null;
}

// Types définis maintenant dans @/types

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeTab, setActiveTab] = useState<
    "live" | "history" | "all" | "results"
  >("live");
  // État pour stocker la date et les détails de la compétition actuelle
  const [competitionDate, setCompetitionDate] = useState<Date | null>(null);
  const [competitionDetails, setCompetitionDetails] = useState<Competition | null>(null);

  // Données des matchs
  const [upcomingMatchesByArea, setUpcomingMatchesByArea] = useState<{
    [key: number]: Match[];
  }>({});
  const [allUpcomingMatchesByArea, setAllUpcomingMatchesByArea] = useState<{
    [key: number]: Match[];
  }>({});
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [allRecentMatches, setAllRecentMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [availableLigues, setAvailableLigues] = useState<string[]>([]);
  const [availableClubs, setAvailableClubs] = useState<string[]>([]);

  // Nouvel état pour les informations de retard par aire
  const [delayInfoByArea, setDelayInfoByArea] = useState<{
    [key: number]: DelayInfo;
  }>({});

  // Filtres
  const [filters, setFilters] = useState({
    areaNumber: "",
    participantName: "",
    ligue: "",
    club: "",
    status: "",
  });

  // Charger la liste des compétitions
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch(`${API_URL}/competitions`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        setCompetitions(data);

        // Sélectionner la première compétition par défaut
        if (data.length > 0 && !competitionId) {
          setCompetitionId(data[0].id);

          // Si la compétition a une date, la stocker
          if (data[0].date) {
            setCompetitionDate(new Date(data[0].date));
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement des compétitions:", err);
        setError(
          "Impossible de charger les compétitions. Vérifiez la connexion à l'API."
        );
      }
    };

    fetchCompetitions();
  }, [competitionId]);

  // Ajouter un useEffect pour charger la date de la compétition quand l'ID change
  useEffect(() => {
    if (!competitionId) return;

    const fetchCompetitionDetails = async () => {
      try {
        const response = await fetch(`${API_URL}/competition/${competitionId}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        setCompetitionDetails(data);

        // Si la compétition a une date, la stocker
        if (data.date) {
          setCompetitionDate(new Date(data.date));
        } else {
          setCompetitionDate(new Date());
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des détails de la compétition:",
          err
        );
        // En cas d'erreur, utiliser la date actuelle
        setCompetitionDate(new Date());
      }
    };

    fetchCompetitionDetails();
  }, [competitionId]);

  // Charger les données des matchs
  useEffect(() => {
    if (!competitionId) return;

    const fetchMatches = async () => {
      try {
        // Lors du premier chargement, on affiche l'écran de chargement complet
        // Pour les rafraîchissements suivants, on utilise juste l'indicateur de rafraîchissement
        if (!loading) {
          setRefreshing(true);
        } else {
          setRefreshing(true);
        }

        // Récupérer les matchs pour la compétition sélectionnée
        console.log(
          "Chargement des matchs pour la compétition:",
          competitionId
        );
        const response = await fetch(
          `${API_URL}/competition/${competitionId}/matchesWithDetails?_t=${Date.now()}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const matches = (await response.json()) as Match[];
        console.log("Réponse de l'API:", matches);

        // Log détaillé pour le match #101
        const match101 = matches.find((m: Match) => m.matchNumber === 101);
        if (match101) {
          console.log("Match #101:", {
            id: match101.id,
            matchNumber: match101.matchNumber,
            status: match101.status,
            matchParticipants: match101.matchParticipants,
          });
        }

        // Débogage plus détaillé : examiner les 10 premiers matchs en détail
        console.log("Détails des 10 premiers matchs:");
        matches.slice(0, 10).forEach((match, index) => {
          // Vérification détaillée de la structure du match
          const areaInfo = {
            areaFromDirectProperty: match.areaNumber,
            areaFromObject: match.area ? match.area.areaNumber : undefined,
            areaTypeCheck: {
              directPropertyType: typeof match.areaNumber,
              objectExists: match.area !== undefined && match.area !== null,
              objectPropertyType: match.area
                ? typeof match.area.areaNumber
                : "N/A",
            },
            areaValueString: `Match #${match.matchNumber} - Aire: ${
              match.areaNumber || match.area?.areaNumber || "Non définie"
            }`,
          };

          console.log(`Match #${index + 1} (ID: ${match.id}):`, areaInfo);
        });

        // Vérifier comment les aires sont structurées dans les données
        const matchesWithAreas = matches.filter((m) => m.area || m.areaNumber);
        console.log("Matchs avec aires:", matchesWithAreas.length);

        if (matchesWithAreas.length > 0) {
          const sampleMatch = matchesWithAreas[0];
          console.log("Structure d'un match exemple:", {
            id: sampleMatch.id,
            matchNumber: sampleMatch.matchNumber,
            areaNumber: sampleMatch.areaNumber,
            area: sampleMatch.area
              ? {
                  areaNumber: sampleMatch.area.areaNumber,
                  // Ne pas accéder à d'autres propriétés ici
                }
              : "Aucun objet area",
          });
        }

        // Analyser la distribution des matchs par aire
        const areaDistribution: Record<number, number> = {};
        matches.forEach((match) => {
          let areaNum = 0;
          if (match.area && match.area.areaNumber) {
            areaNum = match.area.areaNumber;
          } else if (match.areaNumber) {
            areaNum = match.areaNumber;
          }

          if (areaNum > 0) {
            areaDistribution[areaNum] = (areaDistribution[areaNum] || 0) + 1;
          }
        });
        console.log("Distribution des matchs par aire:", areaDistribution);

        // Organiser les matchs par aire avec une meilleure logique de détection d'aires
        const matchesByArea: { [key: number]: Match[] } = {};

        // Détecter dynamiquement le nombre d'aires : max entre la config compétition,
        // le numéro d'aire max trouvé dans les matchs, et un fallback de 6.
        const maxAreaFromMatches = matches.reduce((max, m) => {
          const a =
            (m.area && typeof m.area.areaNumber === "number"
              ? m.area.areaNumber
              : null) ??
            (typeof m.areaNumber === "number" ? m.areaNumber : null) ??
            0;
          return a > max ? a : max;
        }, 0);
        const numAreas = Math.max(
          competitionDetails?.numAreas || 0,
          maxAreaFromMatches,
          1
        );

        // Initialiser toutes les aires possibles
        for (let i = 1; i <= numAreas; i++) {
          matchesByArea[i] = [];
        }

        // Assigner chaque match à son aire en utilisant une approche différente
        matches.forEach((match) => {
          // Priorité à la propriété area.areaNumber
          let areaNum = null;

          // Vérification explicite de chaque propriété
          if (match.area && typeof match.area.areaNumber === "number") {
            areaNum = match.area.areaNumber;
          }
          // Si area.areaNumber n'est pas disponible, essayer areaNumber
          else if (typeof match.areaNumber === "number") {
            areaNum = match.areaNumber;
          }
          // Vérifier si l'aire est une chaîne qui peut être convertie en nombre
          else if (
            match.area &&
            typeof match.area.areaNumber === "string" &&
            !isNaN(parseInt(match.area.areaNumber))
          ) {
            areaNum = parseInt(match.area.areaNumber);
          }
          // Dernier recours : vérifier si areaNumber est une chaîne
          else if (
            typeof match.areaNumber === "string" &&
            !isNaN(parseInt(match.areaNumber))
          ) {
            areaNum = parseInt(match.areaNumber);
          }
          // Distribution cyclique si aucune aire n'est définie
          else {
            // Répartir cycliquement entre les aires si aucune aire n'est définie
            areaNum = (match.matchNumber % numAreas) + 1;
          }

          // Assurer que l'aire est dans la plage valide
          if (areaNum < 1 || areaNum > numAreas) {
            areaNum = (areaNum % numAreas) + 1;
          }

          // Ajouter le match à son aire
          matchesByArea[areaNum].push(match);
        });

        // Trier les matchs par numéro de match dans chaque aire et filtrer les matchs
        Object.keys(matchesByArea).forEach((key) => {
          const areaNum = parseInt(key);
          if (matchesByArea[areaNum].length > 0) {
            // Trier les matchs par numéro de match (ordre croissant)
            matchesByArea[areaNum].sort(
              (a, b) => a.matchNumber - b.matchNumber
            );

            // Filtrer pour ne garder que les matchs qui ne sont pas "completed"
            const nonCompletedMatches = matchesByArea[areaNum].filter(
              (match) => match.status !== "completed"
            );

            // Prendre uniquement les 5 premiers matchs non complétés
            matchesByArea[areaNum] = nonCompletedMatches.slice(0, 3);
          }
        });

        // Récupérer la liste des aires avec des matchs pour le message de débogage
        const airesAvecMatchs = Object.keys(matchesByArea)
          .filter((key) => matchesByArea[parseInt(key)].length > 0)
          .map(
            (key) =>
              `Aire ${key}: ${matchesByArea[parseInt(key)].length} matchs`
          );

        console.log("Aires avec matchs après organisation:", airesAvecMatchs);

        // Tous les matchs terminés, triés du plus récent au plus ancien.
        // La pagination est gérée côté UI (MatchHistory).
        const completedMatches = matches
          .filter((match) => match.status === "completed" && match.endTime)
          .sort(
            (a, b) =>
              new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
          );

        // Extraire les ligues uniques des participants
        const ligues = new Set<string>();
        const clubs = new Set<string>();
        matches.forEach((match) => {
          match.matchParticipants?.forEach((mp) => {
            if (mp.participant?.ligue) {
              ligues.add(mp.participant.ligue);
            }
            if (mp.participant?.club) {
              clubs.add(mp.participant.club);
            }
          });
        });

        // Trier les ligues par ordre alphabétique
        const liguesSorted = Array.from(ligues).sort();
        setAvailableLigues(liguesSorted);

        // Trier les clubs par ordre alphabétique
        const clubsSorted = Array.from(clubs).sort();
        setAvailableClubs(clubsSorted);

        // Garantir que toutes les aires configurées sont disponibles (même vides)
        const maxArea = Math.max(
          numAreas,
          ...Object.keys(matchesByArea).map(Number)
        );
        const allAreas: { [key: number]: Match[] } = {};

        for (let i = 1; i <= maxArea; i++) {
          allAreas[i] = matchesByArea[i] || [];
        }

        // Sauvegarder tous les matchs pour permettre le filtrage
        setAllUpcomingMatchesByArea(allAreas);
        setAllRecentMatches(completedMatches);
        setAllMatches(matches); // Sauvegarder tous les matchs pour l'onglet "Tous les matchs"

        // Appliquer les filtres initiaux
        setUpcomingMatchesByArea(allAreas);
        setRecentMatches(completedMatches);

        setLastUpdate(new Date());
        setLoading(false);
        setRefreshing(false);

        // Pour chaque aire, afficher les matchs qui lui sont assignés
        for (let i = 1; i <= 6; i++) {
          console.log(
            `Aire ${i}: ${matchesByArea[i]?.length || 0} matchs assignés`
          );
          if (matchesByArea[i]?.length) {
            console.log(
              `Exemples de matchs pour aire ${i}:`,
              matchesByArea[i].slice(0, 2).map((m) => `Match #${m.matchNumber}`)
            );
          }
        }

        // Calculer les retards par aire
        const delays = calculateDelaysByArea(matches);
        setDelayInfoByArea(delays);
      } catch (err) {
        console.error("Erreur lors du chargement des matchs:", err);
        setError(
          "Impossible de charger les matchs. Vérifiez la connexion à l'API."
        );
        setLoading(false);
        setRefreshing(false);
      }
    };

    // Charger les données immédiatement
    fetchMatches();

    // Rafraîchir toutes les 60s. Combiné au cache Vercel (revalidate=10), ça
    // permet d'absorber des milliers de spectateurs sans saturer Supabase.
    const intervalId = setInterval(fetchMatches, 60000);

    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, [competitionId]);

  // Appliquer les filtres quand ils changent
  useEffect(() => {
    if (loading) return;

    // Filtrer les matchs par aire
    if (filters.areaNumber) {
      const areaNum = parseInt(filters.areaNumber);
      const filteredAreas: { [key: number]: Match[] } = {};
      if (allUpcomingMatchesByArea[areaNum]) {
        filteredAreas[areaNum] = allUpcomingMatchesByArea[areaNum];
      }
      setUpcomingMatchesByArea(filteredAreas);
    } else {
      setUpcomingMatchesByArea(allUpcomingMatchesByArea);
    }

    // Fonction pour vérifier si un match correspond aux filtres de nom/ligue/club
    const matchesCriteria = (match: Match) => {
      // Filtrer par nom de participant
      if (filters.participantName) {
        const nameFilter = filters.participantName.toLowerCase();
        const participantMatches = match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant) return false;

          const fullName = `${participant.prenom || ""} ${
            participant.nom || ""
          }`.toLowerCase();
          return fullName.includes(nameFilter);
        });

        if (!participantMatches) return false;
      }

      // Filtrer par ligue
      if (filters.ligue) {
        const ligueMatches = match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant || !participant.ligue) return false;

          return participant.ligue === filters.ligue;
        });

        if (!ligueMatches) return false;
      }

      // Filtrer par club
      if (filters.club) {
        const clubMatches = match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant || !participant.club) return false;

          return participant.club === filters.club;
        });

        if (!clubMatches) return false;
      }

      return true;
    };

    // Appliquer les filtres de nom/ligue/club aux matchs par aire
    if (filters.participantName || filters.ligue || filters.club) {
      const filteredAreas: { [key: number]: Match[] } = {};

      Object.keys(upcomingMatchesByArea).forEach((areaKey) => {
        const areaNum = parseInt(areaKey);
        const filteredMatches =
          upcomingMatchesByArea[areaNum].filter(matchesCriteria);

        if (filteredMatches.length > 0) {
          filteredAreas[areaNum] = filteredMatches;
        }
      });

      setUpcomingMatchesByArea(filteredAreas);
    }

    // Appliquer les filtres aux matchs récents
    if (
      filters.participantName ||
      filters.ligue ||
      filters.club ||
      filters.areaNumber
    ) {
      let filteredRecent = [...allRecentMatches];

      // Filtrer par aire avec une logique plus robuste
      if (filters.areaNumber) {
        const areaNum = parseInt(filters.areaNumber);
        filteredRecent = filteredRecent.filter((match) => {
          // Même logique que pour l'assignation
          let matchAreaNum = null;

          if (match.area && typeof match.area.areaNumber === "number") {
            matchAreaNum = match.area.areaNumber;
          } else if (typeof match.areaNumber === "number") {
            matchAreaNum = match.areaNumber;
          } else if (
            match.area &&
            typeof match.area.areaNumber === "string" &&
            !isNaN(parseInt(match.area.areaNumber))
          ) {
            matchAreaNum = parseInt(match.area.areaNumber);
          } else if (
            typeof match.areaNumber === "string" &&
            !isNaN(parseInt(match.areaNumber))
          ) {
            matchAreaNum = parseInt(match.areaNumber);
          } else {
            // Par défaut, utiliser la même assignation cyclique
            matchAreaNum = (match.matchNumber % numAreas) + 1;
          }

          if (matchAreaNum < 1 || matchAreaNum > numAreas) {
            matchAreaNum = (matchAreaNum % numAreas) + 1;
          }

          return matchAreaNum === areaNum;
        });
      }

      // Filtrer par autres critères
      if (filters.participantName || filters.ligue || filters.club) {
        filteredRecent = filteredRecent.filter(matchesCriteria);
      }

      setRecentMatches(filteredRecent);
    } else {
      setRecentMatches(allRecentMatches);
    }
  }, [filters, allUpcomingMatchesByArea, allRecentMatches, loading]);

  // Nombre d'aires effectif : config compétition (fallback 1 si non chargée)
  const numAreas = competitionDetails?.numAreas || 1;

  // Gestionnaire de changement de filtre
  const handleFilterChange = (newFilters: {
    areaNumber?: string;
    participantName?: string;
    ligue?: string;
    club?: string;
    status?: string;
  }) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Passer au format Date depuis une chaîne
  const formatTime = (dateString?: string) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Obtenir le nom du participant
  const getParticipantName = (match: Match, position: string) => {
    try {
      const participant = match.matchParticipants?.find(
        (p) => p.position === position
      )?.participant;
      if (!participant) return "Inconnu";
      return (
        `${participant.prenom || ""} ${participant.nom || ""}`.trim() ||
        "Inconnu"
      );
    } catch {
      return "Inconnu";
    }
  };

  // Fonction pour calculer le retard par aire en fonction du dernier match terminé
  const calculateDelaysByArea = (matches: Match[]) => {
    // Obtenir tous les matchs terminés avec endTime
    const completedMatches = matches.filter(
      (match) => match.status === "completed" && match.endTime
    );

    // Regrouper par aire
    const completedMatchesByArea: { [key: number]: Match[] } = {};

    completedMatches.forEach((match) => {
      // Déterminer le numéro d'aire
      let areaNum = 1;
      if (match.area && match.area.areaNumber) {
        areaNum = match.area.areaNumber;
      } else if (match.areaNumber) {
        areaNum = match.areaNumber;
      } else {
        areaNum = (match.matchNumber % numAreas) + 1;
      }

      if (!completedMatchesByArea[areaNum]) {
        completedMatchesByArea[areaNum] = [];
      }

      completedMatchesByArea[areaNum].push(match);
    });

    // Calculer le retard pour chaque aire
    const delays: { [key: number]: DelayInfo } = {};

    Object.keys(completedMatchesByArea).forEach((areaKey) => {
      const areaNum = parseInt(areaKey);
      const areaMatches = completedMatchesByArea[areaNum];

      // Trier par endTime pour avoir le plus récent en premier
      areaMatches.sort(
        (a, b) =>
          new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
      );

      // Prendre le dernier match terminé de l'aire
      const lastMatch = areaMatches[0];

      if (lastMatch && lastMatch.endTime && lastMatch.startTime) {
        // Durée prévue pour un match (6 minutes par défaut)
        const expectedDurationInMinutes = 6;

        // Utiliser la date de la compétition comme base pour les calculs, sinon la date actuelle
        // Ceci est important pour s'assurer que les calculs fonctionnent correctement le jour de la compétition
        const competitionDayDate = competitionDate || new Date();

        // Extraire les heures, minutes, secondes du startTime original
        const originalStart = new Date(lastMatch.startTime);
        const hours = originalStart.getHours();
        const minutes = originalStart.getMinutes();
        const seconds = originalStart.getSeconds();

        // Créer une nouvelle date basée sur la date de la compétition mais avec les heures du match
        const startTime = new Date(competitionDayDate);
        startTime.setHours(hours, minutes, seconds);

        // Idem pour la fin réelle
        const actualEnd = new Date(lastMatch.endTime);
        const endHours = actualEnd.getHours();
        const endMinutes = actualEnd.getMinutes();
        const endSeconds = actualEnd.getSeconds();

        const actualEndTime = new Date(competitionDayDate);
        actualEndTime.setHours(endHours, endMinutes, endSeconds);

        // Calculer la fin prévue
        const expectedEndTime = new Date(
          startTime.getTime() + expectedDurationInMinutes * 60000
        );

        // Calculer le retard en minutes
        const delayInMs = actualEndTime.getTime() - expectedEndTime.getTime();
        const delayInMinutes = Math.round(delayInMs / 60000);

        delays[areaNum] = {
          delayInMinutes,
          lastCompletedMatch: lastMatch.matchNumber,
        };
      }
    });

    return delays;
  };

  // Fonction pour ajuster l'heure de début des matchs en fonction du retard de leur aire
  const getAdjustedStartTime = (match: Match) => {
    // Déterminer le numéro d'aire
    let areaNum = 1;
    if (match.area && match.area.areaNumber) {
      areaNum = match.area.areaNumber;
    } else if (match.areaNumber) {
      areaNum = match.areaNumber;
    } else {
      areaNum = (match.matchNumber % numAreas) + 1;
    }

    // Récupérer les informations de retard pour cette aire
    const delayInfo = delayInfoByArea[areaNum];

    if (delayInfo && match.startTime) {
      // Utiliser la date de la compétition comme base pour les calculs
      const competitionDayDate = competitionDate || new Date();

      // Extraire les heures, minutes, secondes du startTime original
      const originalStart = new Date(match.startTime);
      const hours = originalStart.getHours();
      const minutes = originalStart.getMinutes();
      const seconds = originalStart.getSeconds();

      // Créer une nouvelle date basée sur la date de la compétition mais avec les heures du match
      const startTime = new Date(competitionDayDate);
      startTime.setHours(hours, minutes, seconds);

      // Appliquer le retard à l'heure de début
      const adjustedStartTime = new Date(
        startTime.getTime() + delayInfo.delayInMinutes * 60000
      );

      return adjustedStartTime.toISOString();
    }

    // Si pas d'information de retard, retourner l'heure de début originale
    return match.startTime;
  };

  return (
    <div className="page-bg">
      {/* Aurora background */}
      <div className="aurora-blob aurora-blob-1" aria-hidden="true" />
      <div className="aurora-blob aurora-blob-2" aria-hidden="true" />
      <div className="aurora-blob aurora-blob-3" aria-hidden="true" />
      <div className="dot-grid-overlay" aria-hidden="true" />

      <TournamentHeader
        competitionId={competitionId}
        competitions={competitions}
        setCompetitionId={setCompetitionId}
        loading={loading}
        lastUpdate={lastUpdate}
        formatTime={formatTime}
      />

      {/* Bandeau infos compétition */}
      {competitionDetails && !loading && (
        <div className="competition-glass">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            {(() => {
              const totalMatches = allMatches.length;
              const completedMatches = allMatches.filter(m => m.status === "completed").length;
              const pct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

              // Estimation fin : durée moyenne par match terminé × matchs restants
              let estimatedEnd = "";
              if (completedMatches > 0 && completedMatches < totalMatches) {
                const completedWithTimes = allMatches.filter(
                  m => m.status === "completed" && m.startTime && m.endTime
                );
                if (completedWithTimes.length > 0) {
                  const totalDuration = completedWithTimes.reduce((sum, m) => {
                    return sum + (new Date(m.endTime!).getTime() - new Date(m.startTime).getTime());
                  }, 0);
                  const avgDuration = totalDuration / completedWithTimes.length;
                  const remaining = totalMatches - completedMatches;
                  // Prendre la fin du dernier match terminé comme point de départ
                  const lastCompleted = completedWithTimes.sort(
                    (a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
                  )[0];
                  const estEndTime = new Date(
                    new Date(lastCompleted.endTime!).getTime() + (avgDuration * remaining) / (competitionDetails.numAreas || 1)
                  );
                  estimatedEnd = estEndTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                }
              } else if (completedMatches === totalMatches && totalMatches > 0) {
                estimatedEnd = "Terminé";
              }

              const dateStr = competitionDate
                ? competitionDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : "";

              return (
                <div className="flex flex-col gap-2">
                  {/* Ligne 1 : Nom, lieu, date */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <h2 className="text-lg font-bold text-white">{competitionDetails.name}</h2>
                    {competitionDetails.location && (
                      <span className="text-sm text-white/55 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {competitionDetails.location}
                      </span>
                    )}
                    {dateStr && (
                      <span className="text-sm text-white/40 capitalize">{dateStr}</span>
                    )}
                  </div>

                  {/* Ligne 2 : Stats combats */}
                  {totalMatches > 0 && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                      <span className="text-white/60">
                        <span className="font-semibold text-white">{totalMatches}</span> combats programmés
                      </span>
                      <span className="text-white/60">
                        <span className="font-semibold text-[#7eb10e]">{completedMatches}</span> terminés
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar-track">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct === 100 ? "#7eb10e" : "#6366F1",
                            }}
                          />
                        </div>
                        <span className="font-semibold text-white">{pct}%</span>
                      </div>
                      {estimatedEnd && (
                        <span className="text-white/60">
                          Fin estimée : <span className="font-semibold text-[#7eb10e]">{estimatedEnd}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="glass-nav">
        {refreshing && <div className="refresh-scan-bar" aria-hidden="true" />}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="tabs-pill-group">
            <button
              onClick={() => setActiveTab("live")}
              className={`tab-pill-btn${activeTab === "live" ? " active" : ""}`}
            >
              Matchs par aire
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`tab-pill-btn${activeTab === "history" ? " active" : ""}`}
            >
              Résultats récents
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`tab-pill-btn${activeTab === "all" ? " active" : ""}`}
            >
              Tous les matchs
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`tab-pill-btn${activeTab === "results" ? " active" : ""}`}
            >
              Résultats des poules
            </button>
          </div>
        </div>
      </div>

      {activeTab !== "results" && (
        <MatchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          areas={Object.keys(allUpcomingMatchesByArea).map(Number)}
          ligues={availableLigues}
          clubs={availableClubs}
        />
      )}

      <main className="flex-grow pt-2 pb-8">
        {loading ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="loading-spinner-branded" />
              <h3 className="text-lg font-semibold text-white">
                Chargement des données...
              </h3>
              <p className="text-white/35 text-sm">
                Récupération des informations de la compétition
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="bg-red-950/40 p-4 rounded-xl border border-red-500/20 backdrop-blur-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-400">Erreur de chargement</h3>
                  <div className="mt-2 text-sm text-red-300"><p>{error}</p></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl lg:mx-auto ">
            {activeTab === "live" && (
              <LiveMatches
                upcomingMatchesByArea={upcomingMatchesByArea}
                formatTime={formatTime}
                getParticipantName={getParticipantName}
                delayInfoByArea={delayInfoByArea}
                getAdjustedStartTime={getAdjustedStartTime}
              />
            )}

            {activeTab === "history" && (
              <MatchHistory
                recentMatches={recentMatches}
                formatTime={formatTime}
                getParticipantName={getParticipantName}
              />
            )}

            {activeTab === "all" && (
              <AllMatches
                matches={allMatches}
                filters={filters}
                formatTime={formatTime}
                getParticipantName={getParticipantName}
                competitionName={
                  competitions.find((c) => c.id === competitionId)?.name ||
                  "Taekwondo Tournament Manager"
                }
                competitionDate={competitionDate}
                numAreas={numAreas}
              />
            )}

            {activeTab === "results" && competitionId && (
              <Results competitionId={competitionId} />
            )}
          </div>
        )}
      </main>

      <footer className="footer-dark py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logopng.png"
                alt="KYO"
                width={48}
                height={48}
                className="object-contain"
              />
              <span className="text-sm font-bold text-white tracking-wide">KYO</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-white/50">
                &copy; {new Date().getFullYear()} KYO - Tous droits r&eacute;serv&eacute;s
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                Gestionnaire de comp&eacute;titions de Taekwondo
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">v1.0.0</span>
              <span className="text-[10px] text-white/30">
                MAJ : {formatTime(lastUpdate.toISOString())}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
