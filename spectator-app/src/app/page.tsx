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
  const [refreshing, setRefreshing] = useState(false);
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
        // Lors du premier chargement, on affiche l'écran de chargement complet
        // Pour les rafraîchissements suivants, on utilise juste l'indicateur de rafraîchissement
        if (!loading) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Récupérer les matchs pour la compétition sélectionnée
        const response = await fetch(
          `${API_URL}/competition/${competitionId}/matchesWithDetails`
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const matches = (await response.json()) as Match[];

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

        // Initialiser toutes les aires possibles (de 1 à 6 par défaut)
        for (let i = 1; i <= 6; i++) {
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
            // Répartir cycliquement entre les aires 1 à 6 si aucune aire n'est définie
            areaNum = (match.matchNumber % 6) + 1;
          }

          // Assurer que l'aire est dans la plage valide (1-6)
          if (areaNum < 1 || areaNum > 6) {
            areaNum = (areaNum % 6) + 1; // Ramener dans la plage 1-6
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
            matchesByArea[areaNum] = nonCompletedMatches.slice(0, 5);
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

        // Garantir que toutes les aires configurées sont disponibles (de 1 à 6 par défaut)
        // même si elles n'ont pas de matchs actuellement
        const maxArea = Math.max(6, ...Object.keys(matchesByArea).map(Number)); // Au moins 6 aires ou le plus grand numéro trouvé
        const allAreas: { [key: number]: Match[] } = {};

        // Initialiser toutes les aires possibles (même vides)
        for (let i = 1; i <= maxArea; i++) {
          allAreas[i] = matchesByArea[i] || [];
        }

        // Sauvegarder tous les matchs pour permettre le filtrage
        setAllUpcomingMatchesByArea(allAreas);
        setAllRecentMatches(completedMatches);

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

    // Puis rafraîchir toutes les 30 secondes au lieu de 10 secondes
    const intervalId = setInterval(fetchMatches, 30000);

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
            matchAreaNum = (match.matchNumber % 6) + 1;
          }

          // Assurer que l'aire est dans la plage valide (1-6)
          if (matchAreaNum < 1 || matchAreaNum > 6) {
            matchAreaNum = (matchAreaNum % 6) + 1;
          }

          return matchAreaNum === areaNum;
        });
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
        {/* Indicateur de rafraîchissement */}
        {refreshing && (
          <div className="bg-blue-50 text-blue-700 text-center text-xs py-1 animate-pulse">
            Mise à jour des données en cours...
          </div>
        )}
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
