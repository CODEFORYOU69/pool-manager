"use client";

import { Match, Participant } from "@/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// URL de l'API
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function MatchDetails() {
  const params = useParams();
  const matchId = params?.id?.toString();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Récupérer les données du match
  useEffect(() => {
    if (!matchId) return;

    const fetchMatch = async () => {
      try {
        setLoading(true);

        const response = await fetch(`${API_URL}/match/${matchId}`);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const matchData = await response.json();
        setMatch(matchData);
        setLastUpdate(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Erreur lors du chargement du match:", err);
        setError(
          "Impossible de charger les informations du match. Vérifiez la connexion à l'API."
        );
        setLoading(false);
      }
    };

    // Charger les données immédiatement
    fetchMatch();

    // Puis rafraîchir toutes les 5 secondes
    const intervalId = setInterval(fetchMatch, 5000);

    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, [matchId]);

  // Formater l'heure
  const formatTime = (dateString?: string) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Formater la date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Date inconnue";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Obtenir le nom complet du participant
  const getParticipantName = (participant: Participant | undefined) => {
    if (!participant) return "Inconnu";
    return (
      `${participant.prenom || ""} ${participant.nom || ""}`.trim() || "Inconnu"
    );
  };

  // Déterminer le statut du match
  const getMatchStatus = (status?: string) => {
    switch (status) {
      case "completed":
        return { text: "Terminé", color: "bg-green-100 text-green-800" };
      case "in_progress":
        return { text: "En cours", color: "bg-yellow-100 text-yellow-800" };
      case "pending":
        return { text: "À venir", color: "bg-blue-100 text-blue-800" };
      default:
        return { text: "Statut inconnu", color: "bg-gray-100 text-gray-800" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">
              Chargement des informations...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-md max-w-lg mx-auto">
            <h2 className="text-lg font-bold mb-2">Erreur</h2>
            <p className="text-red-800 font-medium">{error}</p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-blue-700 hover:underline font-bold"
              >
                Retourner à l&apos;accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-md max-w-lg mx-auto">
            <h2 className="text-lg font-bold mb-2">Match introuvable</h2>
            <p className="font-medium">
              Le match que vous recherchez n&apos;existe pas ou a été supprimé.
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-blue-700 hover:underline font-bold"
              >
                Retourner à l&apos;accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getMatchStatus(match.status);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <Link
              href="/"
              className="mb-4 sm:mb-0 text-white hover:text-blue-200 flex items-center font-medium"
            >
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              Retour à l&apos;accueil
            </Link>

            <h1 className="text-2xl font-extrabold">
              Match #{match.matchNumber || ""}
            </h1>

            <div className="text-sm font-medium mt-2 sm:mt-0">
              Mise à jour: {formatTime(lastUpdate.toISOString())}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="block text-xs font-bold text-gray-700">
                    Statut
                  </span>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-bold ${statusInfo.color}`}
                  >
                    {statusInfo.text}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-700">
                    Aire
                  </span>
                  <span className="font-bold text-gray-900">
                    {match.areaNumber || match.area?.areaNumber || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-700">
                    Date
                  </span>
                  <span className="font-bold text-gray-900">
                    {formatDate(match.startTime)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-700">
                    Heure prévue
                  </span>
                  <span className="font-bold text-gray-900">
                    {formatTime(match.startTime)}
                  </span>
                </div>
                {match.status === "completed" && match.endTime && (
                  <div>
                    <span className="block text-xs font-bold text-gray-700">
                      Heure de fin
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatTime(match.endTime)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {match.matchParticipants
                  ?.sort((a) => (a.position === "A" ? -1 : 1))
                  .map((mp) => {
                    const isWinner = match.winner === mp.participantId;
                    const position = mp.position;
                    const participant = mp.participant;

                    return (
                      <div
                        key={mp.id || `${mp.position}-${mp.participantId}`}
                        className={`border rounded-lg p-4 ${
                          position === "A"
                            ? isWinner
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200"
                            : isWinner
                            ? "border-red-500 bg-red-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              position === "A"
                                ? "bg-blue-200 text-blue-900"
                                : "bg-red-200 text-red-900"
                            }`}
                          >
                            Position {position}
                          </span>
                          {isWinner && (
                            <span className="bg-yellow-200 text-yellow-900 px-2 py-1 rounded text-xs font-bold">
                              Vainqueur
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-xl font-extrabold ${
                            position === "A" ? "text-blue-800" : "text-red-800"
                          }`}
                        >
                          {getParticipantName(participant)}
                        </h3>

                        {participant && (
                          <div className="mt-3 space-y-1 text-sm">
                            <div className="grid grid-cols-2">
                              <span className="text-gray-700 font-bold">
                                Ligue:
                              </span>
                              <span className="font-bold text-gray-900">
                                {participant.ligue || "N/A"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2">
                              <span className="text-gray-700 font-bold">
                                Âge:
                              </span>
                              <span className="font-bold text-gray-900">
                                {participant.age || "N/A"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2">
                              <span className="text-gray-700 font-bold">
                                Poids:
                              </span>
                              <span className="font-bold text-gray-900">
                                {participant.poids
                                  ? `${participant.poids} kg`
                                  : "N/A"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {match.status === "completed" &&
                match.rounds &&
                match.rounds.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-bold mb-4 pb-2 border-b border-gray-200 text-gray-900">
                      Résultats par round
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {match.rounds.map((round, index) => {
                        const isBlueWinner = round.winnerPosition === "A";
                        const isRedWinner = round.winnerPosition === "B";

                        return (
                          <div
                            key={index}
                            className="border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                          >
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                              <span className="font-bold text-gray-900">
                                Round {round.roundNumber}
                              </span>
                            </div>
                            <div className="p-4">
                              <div className="flex items-center justify-between">
                                <div
                                  className={`flex-1 text-right ${
                                    isBlueWinner
                                      ? "font-extrabold"
                                      : "font-bold"
                                  }`}
                                >
                                  <div
                                    className={`text-2xl ${
                                      isBlueWinner
                                        ? "text-blue-800"
                                        : "text-gray-800"
                                    }`}
                                  >
                                    {round.scoreA}
                                  </div>
                                </div>

                                <div className="mx-3 text-gray-700 text-xl font-bold">
                                  -
                                </div>

                                <div
                                  className={`flex-1 text-left ${
                                    isRedWinner ? "font-extrabold" : "font-bold"
                                  }`}
                                >
                                  <div
                                    className={`text-2xl ${
                                      isRedWinner
                                        ? "text-red-800"
                                        : "text-gray-800"
                                    }`}
                                  >
                                    {round.scoreB}
                                  </div>
                                </div>
                              </div>

                              {round.winnerPosition && (
                                <div className="text-center mt-2 text-sm">
                                  <span
                                    className={`inline-block px-2 py-1 rounded font-bold ${
                                      round.winnerPosition === "A"
                                        ? "bg-blue-200 text-blue-900"
                                        : "bg-red-200 text-red-900"
                                    }`}
                                  >
                                    Vainqueur: {round.winnerPosition}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium">
            Taekwondo Tournament Manager - Vue Spectateur -{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
