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
    <header className="glass-header text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-xl p-1.5 flex items-center justify-center flex-shrink-0">
              <Image
                src="/logopng.png"
                alt="KYO Logo"
                width={56}
                height={56}
                className="object-contain"
              />
            </div>
            <div className="bg-white rounded-xl p-1.5 flex items-center justify-center flex-shrink-0">
              <Image
                src="/logo-fftda.png"
                alt="Logo FFTDA"
                width={44}
                height={44}
                className="object-contain"
              />
            </div>
            <div className="bg-white rounded-xl p-0.5 flex items-center justify-center flex-shrink-0">
              <Image
                src="/30ansfftda.jpeg"
                alt="30 ans FFTDA"
                width={48}
                height={48}
                className="object-contain rounded-lg"
              />
            </div>
            <div className="text-center md:text-left pl-1">
              <h1 className="text-2xl font-extrabold tracking-tight">Competition Live</h1>
              <p className="text-white/45 text-xs font-medium mt-1">
                Dernière mise à jour: {formatTime(lastUpdate.toISOString())}
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto">
            <select
              value={competitionId || ""}
              onChange={(e) => setCompetitionId(e.target.value)}
              disabled={loading || competitions.length === 0}
              className="w-full md:w-64 px-3 py-2 bg-white/5 border border-[#7eb10e]/30 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#7eb10e]/40 focus:border-[#7eb10e]/60 cursor-pointer"
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
