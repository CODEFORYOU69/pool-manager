"use client";

import { Match } from "@/types";
import Link from "next/link";

type MatchHistoryProps = {
  recentMatches: Match[];
  getParticipantName: (match: Match, position: string) => string;
  formatTime: (dateString?: string) => string;
};

export default function MatchHistory({
  recentMatches,
  getParticipantName,
  formatTime,
}: MatchHistoryProps) {
  if (recentMatches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Aucun match terminé
        </h2>
        <p className="text-gray-600">
          Les résultats des matchs apparaîtront ici dès qu&apos;ils seront
          terminés.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Résultats récents{" "}
        <span className="text-sm font-normal text-gray-500">
          ({recentMatches.length})
        </span>
      </h2>

      <div className="space-y-4">
        {recentMatches.map((match) => {
          const winnerPosition =
            match.winnerPosition ||
            (match.winner ===
            match.matchParticipants?.find((p) => p.position === "A")
              ?.participantId
              ? "A"
              : match.winner ===
                match.matchParticipants?.find((p) => p.position === "B")
                  ?.participantId
              ? "B"
              : null);

          return (
            <div
              key={match.id}
              className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100"
            >
              <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">
                  Match #{match.matchNumber}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {formatTime(match.endTime)}
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`flex-1 text-right ${
                      winnerPosition === "A" ? "font-bold" : ""
                    }`}
                  >
                    <div
                      className={`${
                        winnerPosition === "A"
                          ? "text-blue-700 underline"
                          : "text-gray-700"
                      } truncate`}
                    >
                      {getParticipantName(match, "A")}
                    </div>
                  </div>

                  <div className="mx-4 text-gray-400 font-bold">VS</div>

                  <div
                    className={`flex-1 text-left ${
                      winnerPosition === "B" ? "font-bold" : ""
                    }`}
                  >
                    <div
                      className={`${
                        winnerPosition === "B"
                          ? "text-red-700 underline"
                          : "text-gray-700"
                      } truncate`}
                    >
                      {getParticipantName(match, "B")}
                    </div>
                  </div>
                </div>

                {match.rounds && match.rounds.length > 0 && (
                  <div className="flex justify-center space-x-3 my-2">
                    {match.rounds.map((round, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-100 px-2 py-1 rounded text-xs"
                      >
                        R{round.roundNumber}: {round.scoreA} - {round.scoreB}
                      </div>
                    ))}
                  </div>
                )}

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
  );
}
