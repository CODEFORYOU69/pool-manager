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
  scoreA?: number;
  scoreB?: number;
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
  // Propriétés additionnelles pour la compatibilité
  participants?: Array<{
    id?: string;
    participantId?: string;
    position?: string | number;
  }>;
  participantAId?: string;
  participantBId?: string;
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
  scoreA?: number;
  scoreB?: number;
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

// Fonction utilitaire pour extraire les scores d'un round de manière sécurisée
const extractScore = (
  round: ExtendedRound,
  position: string | number | null
): number => {
  if (!round || !position) return 0;

  // Si la position est "A" ou 0, renvoyer scoreA
  if (position === "A" || position === 0) {
    if (round.scoreA !== undefined) return Number(round.scoreA || 0);
  }

  // Si la position est "B" ou 1, renvoyer scoreB
  if (position === "B" || position === 1) {
    if (round.scoreB !== undefined) return Number(round.scoreB || 0);
  }

  // Format legacy: si on a toujours des scores dans l'objet scores
  if (round.scores) {
    // Si la position est numérique (0 ou 1), convertir en A/B
    const posKey = position === 0 ? "A" : position === 1 ? "B" : position;

    // Essayer d'extraire le score de différentes façons
    if (typeof posKey === "string") {
      // Essayer avec la clé directe
      if (round.scores[posKey] !== undefined) {
        return Number(round.scores[posKey] || 0);
      }

      // Essayer avec la clé en minuscule
      const lowerKey = posKey.toLowerCase();
      if (round.scores[lowerKey] !== undefined) {
        return Number(round.scores[lowerKey] || 0);
      }
    }

    // Si la position est numérique, essayer avec cette clé
    if (typeof position === "number" && round.scores[position] !== undefined) {
      return Number(round.scores[position] || 0);
    }

    // Si on a une structure différente, essayer de déduire la position
    const keys = Object.keys(round.scores);
    if (keys.length === 2) {
      // Si on a exactement deux scores, supposer que c'est un match 1v1
      // et retourner le premier ou le second selon la position
      if (position === "A" || position === 0) {
        return Number(round.scores[keys[0]] || 0);
      } else {
        return Number(round.scores[keys[1]] || 0);
      }
    }
  }

  // Dernier recours: retourner 0
  return 0;
};

// Fonction pour vérifier si un participant est dans un match
const isParticipantInMatch = (
  match: ExtendedMatch,
  participantId: string
): boolean => {
  if (!match || !participantId) return false;

  // Vérifier dans matchParticipants
  if (match.matchParticipants && Array.isArray(match.matchParticipants)) {
    return match.matchParticipants.some(
      (mp) =>
        mp.participantId === participantId ||
        (mp.participant && mp.participant.id === participantId)
    );
  }

  // Vérifier dans participants (autre structure possible)
  if (match.participants && Array.isArray(match.participants)) {
    return match.participants.some(
      (p: { id?: string; participantId?: string }) =>
        p.id === participantId || p.participantId === participantId
    );
  }

  // Vérifier les propriétés directes
  return (
    match.participantAId === participantId ||
    match.participantBId === participantId
  );
};

// Fonction pour trouver la position d'un participant dans un match
const findParticipantPosition = (
  match: ExtendedMatch,
  participantId: string
): string | number | null => {
  if (!match || !participantId) return null;

  // Vérifier dans matchParticipants
  if (match.matchParticipants && Array.isArray(match.matchParticipants)) {
    const mp = match.matchParticipants.find(
      (mp) =>
        mp.participantId === participantId ||
        (mp.participant && mp.participant.id === participantId)
    );
    if (mp) return mp.position;
  }

  // Vérifier dans participants
  if (match.participants && Array.isArray(match.participants)) {
    const p = match.participants.find(
      (p: {
        id?: string;
        participantId?: string;
        position?: string | number;
      }) => p.id === participantId || p.participantId === participantId
    );
    if (p && p.position !== undefined) return p.position;
  }

  // Vérifier les propriétés directes
  if (match.participantAId === participantId) return "A";
  if (match.participantBId === participantId) return "B";

  return null;
};

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
      console.log("Matches récupérés:", matches.length);
      console.log("Premier match exemple:", matches[0]);
      if (matches[0]?.rounds) {
        console.log("Exemple de rounds:", matches[0].rounds);
        console.log(
          "Format des scores:",
          matches[0].rounds[0]?.scores ||
            `scoreA: ${matches[0].rounds[0]?.scoreA}, scoreB: ${matches[0].rounds[0]?.scoreB}`
        );
      }

      // Créer les résultats directement à partir des matchs complétés
      // (Ne pas essayer de récupérer depuis /match/results qui n'existe pas)
      const matchResults: Record<string, MatchResult> = {};

      console.log("Création des résultats à partir des matchs complétés");
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

      // Vérifier si un match a des scores
      if (completedMatches.length > 0 && completedMatches[0].rounds) {
        const exampleMatch = completedMatches[0];
        console.log("Exemple de match complété:", {
          id: exampleMatch.id,
          rounds: exampleMatch.rounds,
          scores: exampleMatch.rounds[0]?.scores || {
            scoreA: exampleMatch.rounds[0]?.scoreA,
            scoreB: exampleMatch.rounds[0]?.scoreB,
          },
        });
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

                // Récupérer les participants depuis la poule (méthode plus fiable)
                if (pool.poolParticipants) {
                  pool.poolParticipants.forEach((poolParticipant) => {
                    if (
                      poolParticipant.participant &&
                      !participantsProcessed.has(poolParticipant.participant.id)
                    ) {
                      const participantId = poolParticipant.participant.id;
                      participantsProcessed.add(participantId);

                      // Trouver les matchs où ce participant a participé
                      const participantMatches = poolMatches.filter(
                        (m) =>
                          isParticipantInMatch(
                            m as ExtendedMatch,
                            participantId
                          ) && m.status === "completed"
                      );

                      // Calculer les victoires
                      const wins = participantMatches.filter(
                        (m) => (m as ExtendedMatch).winner === participantId
                      ).length;

                      // Calculer les rounds gagnés et perdus correctement
                      let roundsWon = 0;
                      let roundsLost = 0;
                      let pointsGained = 0;
                      let pointsLost = 0;

                      // Pour chaque match complété où le participant a joué
                      participantMatches.forEach((match) => {
                        if (
                          (match as ExtendedMatch).rounds &&
                          match.status === "completed"
                        ) {
                          const position = findParticipantPosition(
                            match as ExtendedMatch,
                            participantId
                          );
                          console.log(
                            `Match ${match.id} - Position du participant ${participantId}:`,
                            position
                          );

                          // Pour chaque round du match
                          (match as ExtendedMatch).rounds?.forEach((round) => {
                            // Vérifier les rounds gagnés
                            if (
                              round.winner === participantId ||
                              (position !== null &&
                                round.winnerPosition === position)
                            ) {
                              roundsWon++;
                            }
                            // Vérifier les rounds perdus
                            else if (
                              round.winner !== null ||
                              round.winnerPosition !== null
                            ) {
                              roundsLost++;
                            }

                            // Calculer les points marqués et concédés avec la fonction extractScore
                            if (
                              round.scores ||
                              round.scoreA !== undefined ||
                              round.scoreB !== undefined
                            ) {
                              console.log(
                                `Scores du round ${round.roundNumber}:`,
                                round.scores || {
                                  scoreA: round.scoreA,
                                  scoreB: round.scoreB,
                                }
                              );

                              // Déterminer la position opposée
                              const positionOpposee =
                                position === "A"
                                  ? "B"
                                  : position === "B"
                                  ? "A"
                                  : position === 0
                                  ? 1
                                  : position === 1
                                  ? 0
                                  : null;

                              // Extraire les scores avec notre fonction robuste
                              const pointsGagnes = extractScore(
                                round,
                                position
                              );
                              const pointsConcedes = extractScore(
                                round,
                                positionOpposee
                              );

                              // Ajouter aux totaux
                              pointsGained += pointsGagnes;
                              pointsLost += pointsConcedes;

                              console.log(
                                `Points pour ce round: gagnés +${pointsGagnes}, perdus +${pointsConcedes}`
                              );
                            }
                          });
                        }
                      });

                      // Calculer la différence de points
                      const pointsDiff = pointsGained - pointsLost;
                      console.log(
                        `Statistiques finales pour ${participantId}: Rounds gagnés=${roundsWon}, perdus=${roundsLost}, points marqués=${pointsGained}, concédés=${pointsLost}, diff=${pointsDiff}`
                      );

                      const participant = poolParticipant.participant;

                      poolParticipants.push({
                        id: participant.id,
                        nom: participant.nom || "",
                        prenom: participant.prenom || "",
                        ligue: participant.ligue || "",
                        club: (participant as ExtendedParticipant).club || "",
                        points: wins * 3, // 3 points par victoire
                        wins,
                        matches: participantMatches.length, // Nombre de matchs joués
                        roundsWon,
                        roundsLost,
                        pointsGained,
                        pointsLost,
                        pointsDiff,
                        rank: 0, // Sera calculé plus tard
                      });

                      console.log("Participant ajouté:", {
                        id: participant.id,
                        nom: participant.nom,
                        pointsGained,
                        pointsLost,
                        pointsDiff,
                      });
                    }
                  });
                } else {
                  // Méthode alternative: extraire les participants des matches si poolParticipants n'est pas disponible
                  poolMatches.forEach((match) => {
                    if ((match as ExtendedMatch).matchParticipants) {
                      (match as ExtendedMatch).matchParticipants?.forEach(
                        (mp) => {
                          if (
                            mp.participant &&
                            !participantsProcessed.has(mp.participant.id)
                          ) {
                            // Compiler les stats du participant
                            const wins = poolMatches.filter(
                              (m) =>
                                (m as ExtendedMatch).winner ===
                                mp.participant?.id
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

                            const roundsLost = poolMatches.reduce(
                              (total, m) => {
                                if (
                                  (m as ExtendedMatch).rounds &&
                                  (m as ExtendedMatch).matchParticipants?.some(
                                    (p) =>
                                      p.participantId === mp.participant?.id
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
                              },
                              0
                            );

                            // Calculer les points marqués et concédés
                            let pointsGained = 0;
                            let pointsLost = 0;

                            poolMatches.forEach((m) => {
                              if (
                                (m as ExtendedMatch).rounds &&
                                m.status === "completed"
                              ) {
                                const participantPosition = (
                                  m as ExtendedMatch
                                ).matchParticipants?.find(
                                  (p) => p.participantId === mp.participant?.id
                                )?.position;

                                if (participantPosition) {
                                  (m as ExtendedMatch).rounds?.forEach(
                                    (round) => {
                                      // Si le participant est en position A
                                      if (
                                        participantPosition === "A" ||
                                        participantPosition === 0
                                      ) {
                                        if (
                                          round.scores ||
                                          round.scoreA !== undefined ||
                                          round.scoreB !== undefined
                                        ) {
                                          // Utiliser extractScore pour les points
                                          pointsGained += extractScore(
                                            round,
                                            participantPosition
                                          );
                                          pointsLost += extractScore(
                                            round,
                                            participantPosition === "A"
                                              ? "B"
                                              : 1
                                          );
                                        }
                                      }
                                      // Si le participant est en position B
                                      else if (
                                        participantPosition === "B" ||
                                        participantPosition === 1
                                      ) {
                                        if (
                                          round.scores ||
                                          round.scoreA !== undefined ||
                                          round.scoreB !== undefined
                                        ) {
                                          // Utiliser extractScore pour les points
                                          pointsGained += extractScore(
                                            round,
                                            participantPosition
                                          );
                                          pointsLost += extractScore(
                                            round,
                                            participantPosition === "B"
                                              ? "A"
                                              : 0
                                          );
                                        }
                                      }
                                    }
                                  );
                                }
                              }
                            });

                            // Calculer la différence de points
                            const pointsDiff = pointsGained - pointsLost;

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
                              pointsGained,
                              pointsLost,
                              pointsDiff,
                              rank: 0, // Sera calculé plus tard
                            });
                          }
                        }
                      );
                    }
                  });
                }

                // Trier les participants par points
                poolParticipants.sort((a, b) => {
                  // 1. Nombre de points (3 pour victoire)
                  if (a.points !== b.points) return b.points - a.points;

                  // 2. Confrontation directe
                  const directWinner = getDirectMatchWinner(a, b, poolMatches);
                  if (directWinner === a.id) return -1;
                  if (directWinner === b.id) return 1;

                  // 3. Nombre de rounds gagnés
                  if (a.roundsWon !== b.roundsWon)
                    return b.roundsWon - a.roundsWon;

                  // 4. Différence de points
                  if (a.pointsDiff !== b.pointsDiff)
                    return b.pointsDiff - a.pointsDiff;

                  // Si tout est égal, garder l'ordre
                  return 0;
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
          console.log(
            "Exemple de résultat pour la première poule:",
            results.length > 0
              ? {
                  groupId: results[0].groupId,
                  participants: results[0].participants.map((p) => ({
                    nom: p.nom,
                    prenom: p.prenom,
                    points: p.points,
                    pointsGained: p.pointsGained,
                    pointsLost: p.pointsLost,
                    pointsDiff: p.pointsDiff,
                  })),
                }
              : "Aucun résultat"
          );

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

  // Ajouter une fonction pour trouver un match direct entre deux participants
  const findDirectMatch = (
    participant1Id: string,
    participant2Id: string,
    matches: Match[]
  ): Match | null => {
    if (
      !participant1Id ||
      !participant2Id ||
      !matches ||
      matches.length === 0
    ) {
      return null;
    }

    return (
      matches.find((match) => {
        // Vérifier dans matchParticipants (structure BD)
        if (match.matchParticipants && match.matchParticipants.length >= 2) {
          const participantIds = match.matchParticipants
            .filter((mp) => mp.participant)
            .map((mp) => mp.participant?.id);

          return (
            participantIds.includes(participant1Id) &&
            participantIds.includes(participant2Id)
          );
        }
        return false;
      }) || null
    );
  };

  // Ajouter une fonction pour déterminer le gagnant d'une confrontation directe
  const getDirectMatchWinner = (
    participantA: ParticipantResult,
    participantB: ParticipantResult,
    matches: Match[]
  ): string | null => {
    if (!participantA || !participantB) return null;

    const directMatch = findDirectMatch(
      participantA.id,
      participantB.id,
      matches
    );

    if (!directMatch) return null;

    if (directMatch.status === "completed" && directMatch.winner) {
      return directMatch.winner === participantA.id
        ? participantA.id
        : directMatch.winner === participantB.id
        ? participantB.id
        : null;
    }

    return null;
  };

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
    <div className="p-4 sm:p-6">
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

                {/* Vue desktop : tableau complet */}
                <div className="hidden md:block overflow-x-auto px-2 py-1">
                  <table className="w-full min-w-[650px]">
                    <thead>
                      <tr className="bg-gray-700 text-white">
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                          Place
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                          Athlète
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                          Club
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                          Pts
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          V
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          D
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          R+
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          R-
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          P+
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          P-
                        </th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          Diff
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.participants.map((participant, index) => {
                        console.log(`Affichage participant ${index}:`, {
                          nom: participant.nom,
                          pointsGained: participant.pointsGained,
                          pointsLost: participant.pointsLost,
                          pointsDiff: participant.pointsDiff,
                        });
                        return (
                          <tr
                            key={participant.id}
                            className={
                              index % 2 === 0 ? "bg-white" : "bg-blue-50"
                            }
                          >
                            <td className="px-2 sm:px-4 py-2 sm:py-3 font-bold text-gray-800">
                              {index + 1}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-800">
                              {participant.prenom} {participant.nom}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-800 truncate max-w-[120px]">
                              {participant.club || participant.ligue || "-"}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-blue-700">
                              {participant.points}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-green-700">
                              {participant.wins}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-red-700">
                              {participant.matches - participant.wins}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-800">
                              {participant.roundsWon}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-gray-800">
                              {participant.roundsLost}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-green-700">
                              {participant.pointsGained}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-medium text-red-700">
                              {participant.pointsLost}
                            </td>
                            <td
                              className={`px-2 sm:px-4 py-2 sm:py-3 text-center font-medium ${
                                participant.pointsDiff >= 0
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {participant.pointsDiff >= 0 ? "+" : ""}
                              {participant.pointsDiff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vue mobile : cartes individuelles */}
                <div className="md:hidden px-2 py-2 space-y-3">
                  {pool.participants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className={`p-3 rounded-lg shadow-sm ${
                        index % 2 === 0 ? "bg-white" : "bg-blue-50"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-xl text-gray-800 flex items-center">
                          <span className="bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full mr-2">
                            {index + 1}
                          </span>
                          <span className="text-base">
                            {participant.prenom} {participant.nom}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {participant.club || participant.ligue || "-"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col p-1 rounded bg-white shadow-sm">
                          <span className="text-xs text-gray-500">Points</span>
                          <span className="font-bold text-blue-700">
                            {participant.points}
                          </span>
                        </div>
                        <div className="flex flex-col p-1 rounded bg-white shadow-sm">
                          <span className="text-xs text-gray-500">V/D</span>
                          <span>
                            <span className="font-medium text-green-700">
                              {participant.wins}
                            </span>
                            {" / "}
                            <span className="font-medium text-red-700">
                              {participant.matches - participant.wins}
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-col p-1 rounded bg-white shadow-sm">
                          <span className="text-xs text-gray-500">Rounds</span>
                          <span>
                            <span className="font-medium text-green-700">
                              {participant.roundsWon}
                            </span>
                            {" / "}
                            <span className="font-medium text-red-700">
                              {participant.roundsLost}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col p-1 rounded bg-white shadow-sm">
                          <span className="text-xs text-gray-500">Points+</span>
                          <span className="font-medium text-green-700">
                            {participant.pointsGained}
                          </span>
                        </div>
                        <div className="flex flex-col p-1 rounded bg-white shadow-sm">
                          <span className="text-xs text-gray-500">Points-</span>
                          <span className="font-medium text-red-700">
                            {participant.pointsLost}
                          </span>
                        </div>
                        <div className="flex flex-col p-1 rounded bg-white shadow-sm">
                          <span className="text-xs text-gray-500">Diff</span>
                          <span
                            className={`font-medium ${
                              participant.pointsDiff >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {participant.pointsDiff >= 0 ? "+" : ""}
                            {participant.pointsDiff}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
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
