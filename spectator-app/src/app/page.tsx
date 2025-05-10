"use client";

import LiveMatches from "@/components/LiveMatches";
import MatchFilters from "@/components/MatchFilters";
import MatchHistory from "@/components/MatchHistory";
import TournamentHeader from "@/components/TournamentHeader";
import { Competition, Match } from "@/types";
import { useEffect, useState } from "react";

// URL de l'API
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Types définis maintenant dans @/types

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");

  // Données des matchs
  const [upcomingMatchesByArea, setUpcomingMatchesByArea] = useState<{
    [key: number]: Match[];
  }>({});
  const [allUpcomingMatchesByArea, setAllUpcomingMatchesByArea] = useState<{
    [key: number]: Match[];
  }>({});
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [allRecentMatches, setAllRecentMatches] = useState<Match[]>([]);
  const [availableLigues, setAvailableLigues] = useState<string[]>([]);

  // Filtres
  const [filters, setFilters] = useState({
    areaNumber: "",
    participantName: "",
    ligue: "",
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

  // Charger les données des matchs
  useEffect(() => {
    if (!competitionId) return;

    const fetchMatches = async () => {
      try {
        setLoading(true);

        // Récupérer les matchs pour la compétition sélectionnée
        const response = await fetch(
          `${API_URL}/competition/${competitionId}/matchesWithDetails`
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const matches = (await response.json()) as Match[];

        // Organiser les matchs par aire
        const matchesByArea: { [key: number]: Match[] } = {};

        // D'abord, récupérer la liste de toutes les aires
        const areaNumbers = Array.from(
          new Set(matches.map((m) => m.areaNumber || (m.area?.areaNumber ?? 0)))
        );

        // Pour chaque aire, obtenir le match en cours et les prochains matchs
        areaNumbers.forEach((areaNumber) => {
          const areaMatches = matches
            .filter(
              (match) =>
                (match.areaNumber || (match.area?.areaNumber ?? 0)) ===
                areaNumber
            )
            .sort((a, b) => a.matchNumber - b.matchNumber);

          // Trouver l'index du match en cours (s'il existe)
          const inProgressIndex = areaMatches.findIndex(
            (match) => match.status === "in_progress"
          );

          // Si un match est en cours, on commence par celui-là, sinon on prend les premiers en attente
          let startIndex = 0;
          if (inProgressIndex !== -1) {
            startIndex = inProgressIndex;
          } else {
            // Trouver le premier match en attente
            const pendingIndex = areaMatches.findIndex(
              (match) => match.status === "pending"
            );
            if (pendingIndex !== -1) {
              startIndex = pendingIndex;
            }
          }

          // Prendre le match en cours et les 4 prochains (5 au total maximum)
          const relevantMatches = areaMatches.slice(startIndex, startIndex + 5);

          // On n'affiche une aire que si elle a des matchs pertinents
          if (relevantMatches.length > 0) {
            matchesByArea[areaNumber] = relevantMatches;
          }
        });

        // Filtrer les matchs terminés récemment (50 derniers)
        const completedMatches = matches
          .filter((match) => match.status === "completed" && match.endTime)
          .sort(
            (a, b) =>
              new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
          )
          .slice(0, 50);

        // Extraire les ligues uniques des participants
        const ligues = new Set<string>();
        matches.forEach((match) => {
          match.matchParticipants?.forEach((mp) => {
            if (mp.participant?.ligue) {
              ligues.add(mp.participant.ligue);
            }
          });
        });

        // Trier les ligues par ordre alphabétique
        const liguesSorted = Array.from(ligues).sort();
        setAvailableLigues(liguesSorted);

        // Sauvegarder tous les matchs pour permettre le filtrage
        setAllUpcomingMatchesByArea(matchesByArea);
        setAllRecentMatches(completedMatches);

        // Appliquer les filtres initiaux
        setUpcomingMatchesByArea(matchesByArea);
        setRecentMatches(completedMatches);

        setLastUpdate(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Erreur lors du chargement des matchs:", err);
        setError(
          "Impossible de charger les matchs. Vérifiez la connexion à l'API."
        );
        setLoading(false);
      }
    };

    // Charger les données immédiatement
    fetchMatches();

    // Puis rafraîchir toutes les 10 secondes
    const intervalId = setInterval(fetchMatches, 10000);

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

    // Fonction pour vérifier si un match correspond aux filtres de nom/ligue
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

      return true;
    };

    // Appliquer les filtres de nom/ligue aux matchs par aire
    if (filters.participantName || filters.ligue) {
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
    if (filters.participantName || filters.ligue || filters.areaNumber) {
      let filteredRecent = [...allRecentMatches];

      // Filtrer par aire
      if (filters.areaNumber) {
        const areaNum = parseInt(filters.areaNumber);
        filteredRecent = filteredRecent.filter(
          (match) =>
            (match.areaNumber || (match.area?.areaNumber ?? 0)) === areaNum
        );
      }

      // Filtrer par autres critères
      if (filters.participantName || filters.ligue) {
        filteredRecent = filteredRecent.filter(matchesCriteria);
      }

      setRecentMatches(filteredRecent);
    } else {
      setRecentMatches(allRecentMatches);
    }
  }, [filters, allUpcomingMatchesByArea, allRecentMatches, loading]);

  // Gestionnaire de changement de filtre
  const handleFilterChange = (newFilters: {
    areaNumber?: string;
    participantName?: string;
    ligue?: string;
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TournamentHeader
        competitionId={competitionId}
        competitions={competitions}
        setCompetitionId={setCompetitionId}
        loading={loading}
        lastUpdate={lastUpdate}
        formatTime={formatTime}
      />

      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab("live")}
              className={`py-4 px-1 font-medium text-sm border-b-2 ${
                activeTab === "live"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Matchs par aire
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 font-medium text-sm border-b-2 ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Historique des résultats
            </button>
          </div>
        </div>
      </div>

      <MatchFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        areas={Object.keys(allUpcomingMatchesByArea)
          .map(Number)
          .sort((a, b) => a - b)}
        ligues={availableLigues}
      />

      <main className="flex-1 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Chargement des données...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          ) : activeTab === "live" ? (
            <LiveMatches
              upcomingMatchesByArea={upcomingMatchesByArea}
              getParticipantName={getParticipantName}
              formatTime={formatTime}
            />
          ) : (
            <MatchHistory
              recentMatches={recentMatches}
              getParticipantName={getParticipantName}
              formatTime={formatTime}
            />
          )}
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm">
            Taekwondo Tournament Manager - Vue Spectateur -{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
