"use client";

import Results from "@/components/Results";
import Link from "next/link";
import { useEffect, useState } from "react";

// URL de l'API - toujours utiliser les routes internes Next.js
const API_URL = "/api";

type Competition = {
  id: string;
  name: string;
  date: string;
};

export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  // Charger les compétitions
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch(`${API_URL}/competitions`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        setCompetitions(data);

        // Sélectionner la première compétition par défaut
        if (data.length > 0 && !competitionId) {
          setCompetitionId(data[0].id);
        }

        setLoading(false);
      } catch (err) {
        console.error("Erreur lors du chargement des compétitions:", err);
        setError(
          "Impossible de charger les compétitions. Vérifiez la connexion à l'API."
        );
        setLoading(false);
      }
    };

    fetchCompetitions();
  }, [competitionId]);

  const handleCompetitionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCompetitionId(e.target.value);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary-800">
            Résultats des compétitions
          </h1>
          <nav className="flex space-x-4">
            <Link
              href="/"
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              Accueil
            </Link>
            <Link
              href="/match"
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              Matchs
            </Link>
            <Link
              href="/results"
              className="px-3 py-2 rounded-lg bg-primary-50 text-primary-700 font-semibold text-sm"
            >
              Résultats
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-grow">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label
                htmlFor="competition-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Sélectionner une compétition
              </label>
              <select
                id="competition-select"
                className="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200"
                value={competitionId || ""}
                onChange={handleCompetitionChange}
              >
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name} (
                    {new Date(competition.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {competitionId && <Results competitionId={competitionId} />}
          </>
        )}
      </main>

      <footer className="bg-gray-100 border-t">
        <div className="container mx-auto px-4 py-3 text-center text-gray-600 text-sm">
          © {new Date().getFullYear()} Taekwondo Tournament Manager -
          Application Spectateur
        </div>
      </footer>
    </div>
  );
}
