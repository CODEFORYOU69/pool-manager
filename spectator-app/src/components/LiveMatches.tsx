"use client";

import { Match } from "@/types";
import Link from "next/link";

type LiveMatchesProps = {
  upcomingMatchesByArea: { [key: number]: Match[] };
  getParticipantName: (match: Match, position: string) => string;
  formatTime: (dateString?: string) => string;
};

export default function LiveMatches({
  upcomingMatchesByArea,
  getParticipantName,
  formatTime,
}: LiveMatchesProps) {
  // Obtenir la liste des aires triées
  const areaNumbers = Object.keys(upcomingMatchesByArea)
    .map(Number)
    .sort((a, b) => a - b);

  if (areaNumbers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Aucun match programmé
        </h2>
        <p className="text-gray-600">
          Les matchs apparaîtront ici dès qu&apos;ils seront programmés.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {areaNumbers.map((areaNumber) => (
        <div key={areaNumber} className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Aire {areaNumber}{" "}
            <span className="text-sm font-normal text-gray-500">
              ({upcomingMatchesByArea[areaNumber].length} matchs)
            </span>
          </h2>

          <div className="space-y-4">
            {upcomingMatchesByArea[areaNumber].map((match, index) => {
              const isFirstMatch = index === 0;
              const isPending = match.status === "pending";
              const isInProgress = match.status === "in_progress";

              return (
                <div
                  key={match.id}
                  className={`bg-white rounded-lg shadow-sm overflow-hidden border ${
                    isFirstMatch ? "border-yellow-400" : "border-gray-200"
                  }`}
                >
                  <div
                    className={`px-4 py-3 flex justify-between items-center border-b ${
                      isFirstMatch
                        ? "bg-yellow-50 border-yellow-100"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div className="flex items-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          isFirstMatch
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        Match #{match.matchNumber}
                      </span>
                      {isFirstMatch && (
                        <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium animate-pulse">
                          PROCHAIN
                        </span>
                      )}
                      {isInProgress && (
                        <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium animate-pulse">
                          EN COURS
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 text-right">
                        <div className="text-blue-700 font-semibold truncate">
                          {getParticipantName(match, "A")}
                        </div>
                      </div>

                      <div className="mx-4 text-gray-400 font-bold">VS</div>

                      <div className="flex-1 text-left">
                        <div className="text-red-700 font-semibold truncate">
                          {getParticipantName(match, "B")}
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-sm text-gray-500">
                      {isPending ? "Prévu à: " : "Début: "}
                      {formatTime(match.startTime)}
                    </div>

                    <div className="mt-3 text-center">
                      <Link
                        href={`/match/${match.id}`}
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
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
