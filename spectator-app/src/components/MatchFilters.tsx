"use client";

type MatchFiltersProps = {
  filters: {
    areaNumber: string;
    participantName: string;
    ligue: string;
  };
  onFilterChange: (filters: {
    areaNumber?: string;
    participantName?: string;
    ligue?: string;
  }) => void;
  areas: number[];
  ligues: string[];
};

export default function MatchFilters({
  filters,
  onFilterChange,
  areas,
  ligues,
}: MatchFiltersProps) {
  return (
    <div className="bg-white py-4 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtre par aire */}
          <div>
            <label
              htmlFor="areaFilter"
              className="block text-sm font-bold text-gray-800 mb-1"
            >
              Aire
            </label>
            <select
              id="areaFilter"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
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

          {/* Filtre par nom de participant */}
          <div>
            <label
              htmlFor="nameFilter"
              className="block text-sm font-bold text-gray-800 mb-1"
            >
              Nom du participant
            </label>
            <input
              type="text"
              id="nameFilter"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
              placeholder="Nom ou prénom..."
              value={filters.participantName}
              onChange={(e) =>
                onFilterChange({ participantName: e.target.value })
              }
            />
          </div>

          {/* Filtre par ligue */}
          <div>
            <label
              htmlFor="ligueFilter"
              className="block text-sm font-bold text-gray-800 mb-1"
            >
              Ligue
            </label>
            <select
              id="ligueFilter"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
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
        </div>

        {/* Bouton pour réinitialiser les filtres */}
        {(filters.areaNumber || filters.participantName || filters.ligue) && (
          <div className="mt-4 text-center">
            <button
              onClick={() =>
                onFilterChange({
                  areaNumber: "",
                  participantName: "",
                  ligue: "",
                })
              }
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-md text-red-800 bg-red-200 hover:bg-red-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
