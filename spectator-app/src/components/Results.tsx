"use client";

import { Match, Participant } from "@/types";
import React, { useCallback, useEffect, useState } from "react";

// Types pour les résultats
type PoolResult = {
  groupId: string;
  groupName: string;
  poolIndex: number;
  poolId: string;
  participants: ParticipantResult[];
  matches: MatchWithResult[];
};

// Définir le type ExtendedRound
type ExtendedRound = {
  winnerPosition?: number | null | string;
  winner?: string | null;
  roundNumber: number;
  scores?: Record<string, number>;
};

// Étendre l'interface Match importée
interface ExtendedMatch extends Omit<Match, "matchParticipants" | "rounds"> {
  groupId?: string;
  poolIndex?: number;
  matchParticipants?: {
    participantId: string;
    position: string | number;
    participant?: Participant;
  }[];
  winner?: string;
  rounds?: ExtendedRound[];
}

// Étendre l'interface Participant
interface ExtendedParticipant extends Participant {
  club?: string;
}

type ParticipantResult = {
  id: string;
  nom: string;
  prenom: string;
  ligue: string;
  club: string;
  points: number;
  wins: number;
  matches: number;
  roundsWon: number;
  roundsLost: number;
  pointsGained: number;
  pointsLost: number;
  pointsDiff: number;
  rank: number;
};

type MatchWithResult = Match & {
  result: MatchResult | null;
};

type MatchResult = {
  id: string;
  completed: boolean;
  winner: string | undefined;
  rounds: Round[];
};

type Round = {
  winnerPosition?: number | null | string | undefined;
  winner?: string | null;
  roundNumber: number;
  scores?: Record<string, number>;
};

type Group = {
  id: string;
  gender: "male" | "female";
  ageCategoryName?: string;
  weightCategoryName?: string;
  pools?: Pool[];
};

type Pool = {
  id: string;
  poolIndex: number;
  poolParticipants?: {
    participantId: string;
    position: number;
    participant?: Participant;
  }[];
};

// URL de l'API
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const Results: React.FC<{ competitionId: string }> = ({ competitionId }) => {
  const [poolResults, setPoolResults] = useState<PoolResult[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [noCompletedMatches, setNoCompletedMatches] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setRefreshing(true);
    setError(null);
    setNoCompletedMatches(false);

    try {
      console.log("Récupération des données de résultats...");

      // Récupérer les participants
      const participantsResponse = await fetch(
        `${API_URL}/participants?competitionId=${competitionId}`
      );
      if (!participantsResponse.ok) {
        throw new Error(`Erreur HTTP: ${participantsResponse.status}`);
      }
      const participants = await participantsResponse.json();

      // Récupérer les groupes
      const groupsResponse = await fetch(
        `${API_URL}/competition/${competitionId}/groupsWithDetails`
      );
      if (!groupsResponse.ok) {
        throw new Error(`Erreur HTTP: ${groupsResponse.status}`);
      }
      const groups = await groupsResponse.json();

      // Récupérer les matchs
      const matchesResponse = await fetch(
        `${API_URL}/competition/${competitionId}/matchesWithDetails`
      );
      if (!matchesResponse.ok) {
        throw new Error(`Erreur HTTP: ${matchesResponse.status}`);
      }
      const matches = await matchesResponse.json();

      // Récupérer les résultats des matchs
      let matchResults: Record<string, MatchResult> = {};
      try {
        const resultsResponse = await fetch(
          `${API_URL}/match/results/${competitionId}`
        );
        if (resultsResponse.ok) {
          matchResults = await resultsResponse.json();
        } else {
          console.log(
            "Pas de collection de résultats séparée disponible. Utilisation des données intégrées aux matchs."
          );
        }
      } catch {
        console.log(
          "Erreur lors de la récupération des résultats, utilisation des données intégrées aux matchs."
        );
      }

      // Si pas de résultats séparés, créer les résultats à partir des matchs complétés
      if (Object.keys(matchResults).length === 0) {
        console.log(
          "Création des résultats à partir des données de matchs complétés"
        );
        const completedMatches = matches.filter(
          (match: Match) => match.status === "completed"
        );

        completedMatches.forEach((match: Match) => {
          matchResults[match.id] = {
            id: match.id,
            completed: true,
            winner: match.winner,
            rounds: match.rounds || [],
          };
        });

        console.log(
          `${
            Object.keys(matchResults).length
          } résultats créés à partir des matchs complétés`
        );
      }

      // Compter les matchs complétés
      const completedMatchCount = matches.filter(
        (m: Match) => m.status === "completed"
      ).length;
      console.log(`Matchs complétés: ${completedMatchCount}`);

      if (completedMatchCount === 0) {
        setNoCompletedMatches(true);
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      // Fonction locale pour calculer les résultats
      const calculateAndSetResults = (
        participants: Participant[],
        groups: Group[],
        matches: Match[],
        matchResults: Record<string, MatchResult>
      ) => {
        try {
          // Implémenter cette fonction manuellement ou appeler une version adaptée de la fonction existante
          // Pour ce prototype, nous allons créer une version simplifiée
          const results: PoolResult[] = [];

          // Pour chaque groupe
          groups.forEach((group) => {
            // Ajouter le nom du groupe pour l'affichage
            const groupName = `${group.gender === "male" ? "M" : "F"} ${
              group.ageCategoryName || ""
            } ${group.weightCategoryName || ""}`;

            // Pour chaque poule dans le groupe
            if (group.pools && Array.isArray(group.pools)) {
              group.pools.forEach((pool, poolIndex) => {
                if (!pool) return;

                // Trouver les matchs de cette poule
                const poolMatches = matches.filter(
                  (match) =>
                    match &&
                    (match as ExtendedMatch).groupId === group.id &&
                    (match as ExtendedMatch).poolIndex === poolIndex
                );

                if (poolMatches.length === 0) return;

                // Créer une liste de participants pour cette poule
                const poolParticipants: ParticipantResult[] = [];
                const participantsProcessed = new Set<string>();

                // Récupérer les participants depuis les matchs
                poolMatches.forEach((match) => {
                  if ((match as ExtendedMatch).matchParticipants) {
                    (match as ExtendedMatch).matchParticipants?.forEach(
                      (mp) => {
                        if (
                          mp.participant &&
                          !participantsProcessed.has(mp.participant.id)
                        ) {
                          participantsProcessed.add(mp.participant.id);

                          // Compiler les stats du participant
                          const wins = poolMatches.filter(
                            (m) =>
                              (m as ExtendedMatch).winner === mp.participant?.id
                          ).length;

                          const matchesPlayed = poolMatches.filter(
                            (m) =>
                              (m as ExtendedMatch).matchParticipants?.some(
                                (p) => p.participantId === mp.participant?.id
                              ) && m.status === "completed"
                          ).length;

                          const roundsWon = poolMatches.reduce((total, m) => {
                            if ((m as ExtendedMatch).rounds) {
                              return (
                                total +
                                ((m as ExtendedMatch).rounds?.filter(
                                  (r) =>
                                    (r as ExtendedRound).winner ===
                                      mp.participant?.id ||
                                    r.winnerPosition === mp.position
                                ).length || 0)
                              );
                            }
                            return total;
                          }, 0);

                          const roundsLost = poolMatches.reduce((total, m) => {
                            if (
                              (m as ExtendedMatch).rounds &&
                              (m as ExtendedMatch).matchParticipants?.some(
                                (p) => p.participantId === mp.participant?.id
                              )
                            ) {
                              return (
                                total +
                                ((m as ExtendedMatch).rounds?.filter(
                                  (r) =>
                                    (r as ExtendedRound).winner !==
                                      mp.participant?.id &&
                                    (r as ExtendedRound).winner !== null &&
                                    r.winnerPosition !== mp.position &&
                                    r.winnerPosition !== null
                                ).length || 0)
                              );
                            }
                            return total;
                          }, 0);

                          poolParticipants.push({
                            id: mp.participant.id,
                            nom: mp.participant.nom || "",
                            prenom: mp.participant.prenom || "",
                            ligue: mp.participant.ligue || "",
                            club:
                              (mp.participant as ExtendedParticipant).club ||
                              "",
                            points: wins * 3, // 3 points par victoire
                            wins,
                            matches: matchesPlayed,
                            roundsWon,
                            roundsLost,
                            pointsGained: 0, // Valeur simplifiée
                            pointsLost: 0, // Valeur simplifiée
                            pointsDiff: 0, // Valeur simplifiée
                            rank: 0, // Sera calculé plus tard
                          });
                        }
                      }
                    );
                  }
                });

                // Trier les participants par points
                poolParticipants.sort((a, b) => {
                  // 1. Nombre de points
                  if (a.points !== b.points) return b.points - a.points;

                  // 2. Nombre de rounds gagnés
                  if (a.roundsWon !== b.roundsWon)
                    return b.roundsWon - a.roundsWon;

                  // 3. Différence de points
                  return b.pointsDiff - a.pointsDiff;
                });

                // Assigner les rangs
                poolParticipants.forEach((p, idx) => {
                  p.rank = idx + 1;
                });

                // Ajouter à nos résultats
                results.push({
                  groupId: group.id,
                  groupName,
                  poolIndex,
                  poolId: pool.id,
                  participants: poolParticipants,
                  matches: poolMatches.map((match) => ({
                    ...match,
                    result: matchResults[match.id],
                  })),
                });
              });
            }
          });

          console.log("Résultats calculés:", results);

          if (results.length === 0) {
            setNoCompletedMatches(true);
          } else {
            setPoolResults(results);

            // Sélectionner le premier groupe par défaut
            if (results.length > 0 && !selectedGroup) {
              setSelectedGroup(results[0].groupId);
            }
          }
        } catch (err) {
          console.error("Erreur lors du calcul des résultats:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      // Calculer les résultats
      calculateAndSetResults(participants, groups, matches, matchResults);
    } catch (err) {
      console.error("Erreur lors de la récupération des données:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [competitionId, selectedGroup]);

  useEffect(() => {
    if (competitionId) {
      fetchData();
    }
  }, [competitionId, fetchData]);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
  };

  const handleRefresh = () => {
    fetchData();
  };

  // Générer la liste des groupes uniques à partir des résultats
  const uniqueGroups = [...new Set(poolResults.map((pr) => pr.groupId))].map(
    (groupId) => {
      const group = poolResults.find((pr) => pr.groupId === groupId);
      return {
        id: groupId,
        name: group ? group.groupName : `Groupe ${groupId}`,
      };
    }
  );

  // Filtrer les poules du groupe sélectionné
  const selectedGroupPools = poolResults.filter(
    (pr) => pr.groupId === selectedGroup
  );

  // Tri par index de poule
  selectedGroupPools.sort((a, b) => a.poolIndex - b.poolIndex);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[300px]">
        <p className="text-lg mb-3">Chargement des résultats...</p>
        <div className="loading-spinner h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-300">
        <h3 className="text-lg font-semibold text-red-700 mb-2">
          Erreur lors du chargement des résultats
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onClick={handleRefresh}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (noCompletedMatches) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-300">
        <h3 className="text-lg font-semibold text-yellow-700 mb-2">
          Aucun match complété
        </h3>
        <p className="text-yellow-600 mb-4">
          Il n&apos;y a pas encore de matchs complétés pour calculer les
          résultats.
        </p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onClick={handleRefresh}
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-blue-800">
        Résultats par poules
      </h2>

      <div className="flex justify-between items-center mb-6">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Rafraîchissement..." : "Rafraîchir les résultats"}
        </button>
      </div>

      {uniqueGroups.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {uniqueGroups.map((group) => (
              <button
                key={group.id}
                className={`px-4 py-2 rounded-md font-medium ${
                  selectedGroup === group.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
                }`}
                onClick={() => handleGroupSelect(group.id)}
              >
                {group.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-8">
            {selectedGroupPools.map((pool) => (
              <div
                key={pool.poolId}
                className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-300"
              >
                <h3 className="bg-blue-600 p-3 font-medium text-white text-lg">
                  Poule {pool.poolIndex + 1}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-700 text-white">
                        <th className="px-4 py-3 text-left">Place</th>
                        <th className="px-4 py-3 text-left">Athlète</th>
                        <th className="px-4 py-3 text-left">Région</th>
                        <th className="px-4 py-3 text-left">Club</th>
                        <th className="px-4 py-3 text-right">Points</th>
                        <th className="px-4 py-3 text-center">V</th>
                        <th className="px-4 py-3 text-center">D</th>
                        <th className="px-4 py-3 text-center">R+</th>
                        <th className="px-4 py-3 text-center">R-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.participants.map((participant, index) => (
                        <tr
                          key={participant.id}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-blue-50"
                          }
                        >
                          <td className="px-4 py-3 font-bold text-gray-800">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {participant.prenom} {participant.nom}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {participant.ligue}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {participant.club || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">
                            {participant.points}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-green-700">
                            {participant.wins}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-red-700">
                            {participant.matches - participant.wins}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-gray-800">
                            {participant.roundsWon}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-gray-800">
                            {participant.roundsLost}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-300 text-center">
          <p className="text-yellow-800 mb-4 font-medium">
            Aucun résultat disponible. Veuillez rafraîchir pour vérifier si de
            nouveaux résultats sont disponibles.
          </p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={handleRefresh}
          >
            Vérifier à nouveau
          </button>
        </div>
      )}
    </div>
  );
};

export default Results;
