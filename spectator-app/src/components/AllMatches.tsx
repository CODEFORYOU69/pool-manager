"use client";

import { Match } from "@/types";
import { useEffect, useState } from "react";

interface AllMatchesProps {
  matches: Match[];
  filters: {
    areaNumber: string;
    participantName: string;
    ligue: string;
  };
  formatTime: (dateString?: string) => string;
  getParticipantName: (match: Match, position: string) => string;
}

export default function AllMatches({
  matches,
  filters,
  formatTime,
  getParticipantName,
}: AllMatchesProps) {
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);

  // Appliquer les filtres quand ils changent
  useEffect(() => {
    if (!matches) return;

    let result = [...matches];

    // Filtrer par aire
    if (filters.areaNumber) {
      const areaNum = parseInt(filters.areaNumber);
      result = result.filter((match) => {
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
          matchAreaNum = (match.matchNumber % 6) + 1;
        }

        // Assurer que l'aire est dans la plage valide (1-6)
        if (matchAreaNum < 1 || matchAreaNum > 6) {
          matchAreaNum = (matchAreaNum % 6) + 1;
        }

        return matchAreaNum === areaNum;
      });
    }

    // Filtrer par nom de participant
    if (filters.participantName) {
      const nameFilter = filters.participantName.toLowerCase();
      result = result.filter((match) => {
        return match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant) return false;

          const fullName = `${participant.prenom || ""} ${
            participant.nom || ""
          }`.toLowerCase();
          return fullName.includes(nameFilter);
        });
      });
    }

    // Filtrer par ligue
    if (filters.ligue) {
      result = result.filter((match) => {
        return match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant || !participant.ligue) return false;

          return participant.ligue === filters.ligue;
        });
      });
    }

    // Trier les matchs par numéro
    result.sort((a, b) => a.matchNumber - b.matchNumber);

    setFilteredMatches(result);
  }, [matches, filters]);

  // Déterminer la couleur de statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  // Déterminer le texte de statut en français
  const getStatusText = (status: string) => {
    switch (status) {
      case "in_progress":
        return "En cours";
      case "completed":
        return "Terminé";
      default:
        return "En attente";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Tous les matchs ({filteredMatches.length})
      </h2>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Aucun match trouvé avec les filtres appliqués
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  N° Match
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  Aire
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  Rouge
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  Bleu
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  Ligue
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  Statut
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                >
                  Heure
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMatches.map((match) => {
                // Récupérer la ligue (prendre la première ligue disponible parmi les participants)
                const ligue =
                  match.matchParticipants?.find((mp) => mp.participant?.ligue)
                    ?.participant?.ligue || "Inconnue";

                return (
                  <tr key={match.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {match.matchNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {match.area?.areaNumber || match.areaNumber || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-rose-700">
                      {getParticipantName(match, "A")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">
                      {getParticipantName(match, "B")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ligue}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusColor(
                          match.status
                        )}`}
                      >
                        {getStatusText(match.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(match.startTime)}
                      {match.status === "completed" && match.endTime && (
                        <span className="text-xs text-gray-500 ml-1">
                          → {formatTime(match.endTime)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
