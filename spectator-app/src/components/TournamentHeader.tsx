"use client";

import { Competition } from "@/types";
import Image from "next/image";

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
    <header className="bg-primary-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-4">
            <Image
              src="/logo-fftda.png"
              alt="Logo FFTDA"
              width={64}
              height={64}
              className="object-contain"
            />
            <Image
              src="/30ansfftda.jpeg"
              alt="30 ans FFTDA"
              width={64}
              height={64}
              className="object-contain rounded"
            />
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-extrabold tracking-tight">Competition Live</h1>
              <p className="text-primary-200 text-xs font-medium mt-1">
                Dernière mise à jour: {formatTime(lastUpdate.toISOString())}
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto">
            <select
              value={competitionId || ""}
              onChange={(e) => setCompetitionId(e.target.value)}
              disabled={loading || competitions.length === 0}
              className="w-full md:w-64 px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
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
