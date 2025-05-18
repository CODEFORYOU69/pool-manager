"use client";

interface MatchFiltersProps {
  filters: {
    areaNumber: string;
    participantName: string;
    ligue: string;
    club: string;
    status: string;
  };
  onFilterChange: (filters: {
    areaNumber?: string;
    participantName?: string;
    ligue?: string;
    club?: string;
    status?: string;
  }) => void;
  areas: number[];
  ligues: string[];
  clubs?: string[];
}

export default function MatchFilters({
  filters,
  onFilterChange,
  areas,
  ligues,
  clubs = [],
}: MatchFiltersProps) {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Filtre par aire */}
          <div>
            <label
              htmlFor="area"
              className="block text-sm font-semibold text-gray-900 mb-1"
            >
              Aire
            </label>
            <select
              id="area"
              name="area"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white shadow-sm text-gray-900"
              value={filters.areaNumber}
              onChange={(e) => onFilterChange({ areaNumber: e.target.value })}
            >
              <option value="">Toutes les aires</option>
              {areas.map((area) => (
                <option key={area} value={area.toString()}>
                  Aire {area}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par nom */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-gray-900 mb-1"
            >
              Nom du participant
            </label>
            <input
              type="text"
              name="name"
              id="name"
              className="mt-1 block w-full px-3 py-2 text-base border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white shadow-sm text-gray-900 placeholder-gray-500"
              placeholder="Rechercher un participant..."
              value={filters.participantName}
              onChange={(e) =>
                onFilterChange({ participantName: e.target.value })
              }
            />
          </div>

          {/* Filtre par ligue */}
          <div>
            <label
              htmlFor="ligue"
              className="block text-sm font-semibold text-gray-900 mb-1"
            >
              Ligue
            </label>
            <select
              id="ligue"
              name="ligue"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white shadow-sm text-gray-900"
              value={filters.ligue}
              onChange={(e) => onFilterChange({ ligue: e.target.value })}
            >
              <option value="">Toutes les ligues</option>
              {ligues.map((ligue) => (
                <option key={ligue} value={ligue}>
                  {ligue}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par club */}
          <div>
            <label
              htmlFor="club"
              className="block text-sm font-semibold text-gray-900 mb-1"
            >
              Club
            </label>
            <select
              id="club"
              name="club"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white shadow-sm text-gray-900"
              value={filters.club}
              onChange={(e) => onFilterChange({ club: e.target.value })}
            >
              <option value="">Tous les clubs</option>
              {clubs.map((club) => (
                <option key={club} value={club}>
                  {club}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par statut */}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-semibold text-gray-900 mb-1"
            >
              Statut
            </label>
            <select
              id="status"
              name="status"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white shadow-sm text-gray-900"
              value={filters.status}
              onChange={(e) => onFilterChange({ status: e.target.value })}
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminé</option>
            </select>
          </div>

          {/* Bouton de réinitialisation */}
          <div className="flex items-end">
            <button
              onClick={() =>
                onFilterChange({
                  areaNumber: "",
                  participantName: "",
                  ligue: "",
                  club: "",
                  status: "",
                })
              }
              className="w-full inline-flex justify-center items-center px-4 py-2 border-2 border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
