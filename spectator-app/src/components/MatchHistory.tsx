"use client";

import { Match } from "@/types";

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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Aucun match terminé
        </h2>
        <p className="text-gray-800">
          Les résultats des matchs apparaîtront ici dès qu&apos;ils seront
          terminés.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-0">
      <h2 className="text-2xl font-bold text-gray-900">
        Résultats récents{" "}
        <span className="text-sm font-medium text-gray-700">
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
              className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
            >
              <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                <div className="flex items-center">
                  <span className="font-bold text-gray-900">
                    Match #{match.matchNumber}
                  </span>
                  {match.area && (
                    <span className="ml-2 text-xs text-gray-600">
                      Aire {match.area?.areaNumber || "-"}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {formatTime(match.endTime)}
                </span>
              </div>

              <div className="p-4">
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  {/* Participant Bleu */}
                  <div
                    className={`flex-1 flex flex-col border-l-4 rounded-r pl-3 py-2 ${
                      winnerPosition === "A"
                        ? "border-blue-600 bg-blue-100 ring-2 ring-green-500"
                        : "border-blue-300 bg-blue-50"
                    }`}
                  >
                    <span
                      className={`font-medium ${
                        winnerPosition === "A"
                          ? "text-blue-800 font-bold"
                          : "text-blue-700"
                      }`}
                    >
                      {getParticipantName(match, "A")}
                      {winnerPosition === "A" && (
                        <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-semibold">
                          Vainqueur
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-600 mt-1">
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "A"
                      )?.participant?.club || ""}{" "}
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "A"
                      )?.participant?.ligue
                        ? `(${
                            match.matchParticipants?.find(
                              (mp) => mp.position === "A"
                            )?.participant?.ligue
                          })`
                        : ""}
                    </span>
                  </div>

                  {/* Participant Rouge */}
                  <div
                    className={`flex-1 flex flex-col border-l-4 rounded-r pl-3 py-2 ${
                      winnerPosition === "B"
                        ? "border-rose-600 bg-rose-100 ring-2 ring-green-500"
                        : "border-rose-300 bg-rose-50"
                    }`}
                  >
                    <span
                      className={`font-medium ${
                        winnerPosition === "B"
                          ? "text-rose-800 font-bold"
                          : "text-rose-700"
                      }`}
                    >
                      {getParticipantName(match, "B")}
                      {winnerPosition === "B" && (
                        <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-semibold">
                          Vainqueur
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-600 mt-1">
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "B"
                      )?.participant?.club || ""}{" "}
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "B"
                      )?.participant?.ligue
                        ? `(${
                            match.matchParticipants?.find(
                              (mp) => mp.position === "B"
                            )?.participant?.ligue
                          })`
                        : ""}
                    </span>
                  </div>
                </div>

                {match.rounds && match.rounds.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 my-3 bg-gray-50 p-2 rounded-md">
                    {match.rounds.map((round, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          round.winnerPosition === "A"
                            ? "bg-blue-200 text-blue-800"
                            : round.winnerPosition === "B"
                            ? "bg-rose-200 text-rose-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        <span className="font-bold">R{round.roundNumber}:</span>{" "}
                        {round.scoreA} - {round.scoreB}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
