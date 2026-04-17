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

          const getClub = (pos: string) =>
            match.matchParticipants?.find((mp) => mp.position === pos)
              ?.participant?.club || "";

          return (
            <div
              key={match.id}
              className="match-card-enhanced"
            >
              {/* Header */}
              <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    #{match.matchNumber}
                  </span>
                  {match.area && (
                    <span className="text-xs text-gray-400">
                      Aire {match.area?.areaNumber || "-"}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500 text-white">
                    TERMINÉ
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(match.endTime)}
                </span>
              </div>

              {/* Fighters */}
              <div>
                <div
                  className={`fighter-row bleu ${
                    winnerPosition === "A" ? "winner" : ""
                  }`}
                >
                  <span className="corner-label">BLEU</span>
                  <div className="flex-1 min-w-0">
                    <div className="name truncate">
                      {getParticipantName(match, "A")}
                    </div>
                    <div className="club truncate">{getClub("A")}</div>
                  </div>
                </div>

                <div
                  className={`fighter-row rouge ${
                    winnerPosition === "B" ? "winner" : ""
                  }`}
                >
                  <span className="corner-label">ROUGE</span>
                  <div className="flex-1 min-w-0">
                    <div className="name truncate">
                      {getParticipantName(match, "B")}
                    </div>
                    <div className="club truncate">{getClub("B")}</div>
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
                        {((round.penaltyA ?? 0) > 0 || (round.penaltyB ?? 0) > 0) && (
                          <span className="ml-1 text-orange-700">
                            (G: {round.penaltyA || 0}-{round.penaltyB || 0})
                          </span>
                        )}
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
