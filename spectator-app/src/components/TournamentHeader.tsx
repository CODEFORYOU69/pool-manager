"use client";

import { Competition } from "@/types";

type TournamentHeaderProps = {
  competitionId: string | null;
  competitions: Competition[];
  setCompetitionId: (id: string) => void;
  loading: boolean;
  lastUpdate: Date;
  formatTime: (dateString?: string) => string;
};

export default function TournamentHeader({
  competitionId,
  competitions,
  setCompetitionId,
  loading,
  lastUpdate,
  formatTime,
}: TournamentHeaderProps) {
  return (
    <header className="bg-blue-900 text-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-2xl font-bold">Tournoi de Taekwondo</h1>
            <p className="text-blue-200 text-sm">
              Dernière mise à jour: {formatTime(lastUpdate.toISOString())}
            </p>
          </div>

          <div className="w-full md:w-auto">
            <select
              value={competitionId || ""}
              onChange={(e) => setCompetitionId(e.target.value)}
              disabled={loading || competitions.length === 0}
              className="w-full md:w-64 px-3 py-2 bg-blue-800 border border-blue-700 rounded-md text-white"
            >
              {competitions.length === 0 ? (
                <option value="">Aucune compétition disponible</option>
              ) : (
                competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
