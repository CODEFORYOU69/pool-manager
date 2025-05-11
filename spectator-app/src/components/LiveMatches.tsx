"use client";

import { Match } from "@/types";
import Link from "next/link";

interface DelayInfo {
  delayInMinutes: number;
  lastCompletedMatch: number | null;
}

type LiveMatchesProps = {
  upcomingMatchesByArea: { [key: number]: Match[] };
  getParticipantName: (match: Match, position: string) => string;
  formatTime: (dateString?: string) => string;
  delayInfoByArea?: { [key: number]: DelayInfo };
  getAdjustedStartTime?: (match: Match) => string;
};

export default function LiveMatches({
  upcomingMatchesByArea,
  getParticipantName,
  formatTime,
  delayInfoByArea = {},
  getAdjustedStartTime,
}: LiveMatchesProps) {
  // Obtenir la liste des aires triées
  const areaNumbers = Object.keys(upcomingMatchesByArea)
    .map(Number)
    .sort((a, b) => a - b);

  if (areaNumbers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Aucun match programmé
        </h2>
        <p className="text-gray-800">
          Les matchs apparaîtront ici dès qu&apos;ils seront programmés.
        </p>
      </div>
    );
  }

  // Fonction pour déterminer si on affiche l'indicateur d'avance ou de retard
  const getDelayIndicator = (areaNumber: number) => {
    const delayInfo = delayInfoByArea[areaNumber];
    if (!delayInfo) return null;

    const { delayInMinutes } = delayInfo;

    if (delayInMinutes > 0) {
      return (
        <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-medium">
          Retard de {delayInMinutes} min.
        </span>
      );
    } else if (delayInMinutes < 0) {
      return (
        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">
          Avance de {Math.abs(delayInMinutes)} min.
        </span>
      );
    } else {
      return (
        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
          Dans les temps
        </span>
      );
    }
  };

  return (
    <div className="space-y-8">
      {areaNumbers.map((areaNumber) => (
        <div key={areaNumber} className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            Aire {areaNumber}{" "}
            <span className="text-sm font-medium text-gray-700 ml-2">
              ({upcomingMatchesByArea[areaNumber].length} matchs)
            </span>
            {delayInfoByArea[areaNumber] && getDelayIndicator(areaNumber)}
            {delayInfoByArea[areaNumber]?.lastCompletedMatch && (
              <span className="ml-2 text-xs text-gray-500">
                Dernier match terminé: #
                {delayInfoByArea[areaNumber].lastCompletedMatch}
              </span>
            )}
          </h2>

          <div className="space-y-4">
            {upcomingMatchesByArea[areaNumber].map((match, index) => {
              const isFirstMatch = index === 0;
              const isPending = match.status === "pending";
              const isInProgress = match.status === "in_progress";

              // Utiliser l'heure ajustée si disponible, sinon l'heure originale
              const adjustedStartTime = getAdjustedStartTime
                ? getAdjustedStartTime(match)
                : match.startTime;

              return (
                <div
                  key={match.id}
                  className={`bg-white rounded-lg shadow-sm overflow-hidden border ${
                    isFirstMatch ? "border-yellow-500" : "border-gray-200"
                  }`}
                >
                  <div
                    className={`px-4 py-3 flex justify-between items-center border-b ${
                      isFirstMatch
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          isFirstMatch
                            ? "bg-yellow-200 text-yellow-900"
                            : "bg-gray-200 text-gray-900"
                        }`}
                      >
                        Match #{match.matchNumber}
                      </span>
                      {isFirstMatch && (
                        <span className="ml-2 bg-red-200 text-red-900 px-2 py-1 rounded text-xs font-bold animate-pulse">
                          PROCHAIN
                        </span>
                      )}
                      {isInProgress && (
                        <span className="ml-2 bg-green-200 text-green-900 px-2 py-1 rounded text-xs font-bold animate-pulse">
                          EN COURS
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 text-right">
                        <div className="text-blue-800 font-bold truncate text-lg">
                          {getParticipantName(match, "A")}
                        </div>
                      </div>

                      <div className="mx-4 text-gray-700 font-bold">VS</div>

                      <div className="flex-1 text-left">
                        <div className="text-red-800 font-bold truncate text-lg">
                          {getParticipantName(match, "B")}
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-sm font-medium">
                      {isPending ? (
                        <div>
                          <div className="text-gray-700">
                            {/* Afficher l'heure originale prévue */}
                            Prévu à: {formatTime(match.startTime)}
                          </div>
                          {/* Afficher l'heure ajustée si différente de l'originale */}
                          {adjustedStartTime !== match.startTime &&
                            delayInfoByArea[areaNumber] && (
                              <div
                                className={
                                  delayInfoByArea[areaNumber].delayInMinutes > 0
                                    ? "text-red-700"
                                    : delayInfoByArea[areaNumber]
                                        .delayInMinutes < 0
                                    ? "text-green-700"
                                    : "text-blue-700"
                                }
                              >
                                Estimation: {formatTime(adjustedStartTime)}
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="text-gray-700">
                          Début: {formatTime(match.startTime)}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-center">
                      <Link
                        href={`/match/${match.id}`}
                        className="inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Voir détails
                        <svg
                          className="ml-1 w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5l7 7-7 7"
                          ></path>
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
