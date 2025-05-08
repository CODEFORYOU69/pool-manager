import React, { useState, useEffect } from "react";
import { calculateResults } from "../utils/resultsCalculator";
import "../styles/Results.css";

const Results = ({
  participants,
  groups,
  matches,
  results,
  tournamentConfig,
  prevStep,
}) => {
  const [poolResults, setPoolResults] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tournamentStats, setTournamentStats] = useState({
    totalParticipants: 0,
    totalMatches: 0,
    totalCompletedMatches: 0,
    totalPools: 0,
    totalGroups: 0,
  });

  useEffect(() => {
    if (participants && groups && matches && results) {
      setIsLoading(true);

      try {
        // Calculer les résultats et classements
        const calculatedResults = calculateResults(
          participants,
          groups,
          matches,
          results
        );
        setPoolResults(calculatedResults.poolResults);

        // Définir le premier groupe comme sélectionné par défaut
        if (calculatedResults.poolResults.length > 0) {
          setSelectedGroup(calculatedResults.poolResults[0].groupId);
        }

        // Calculer les statistiques globales du tournoi
        setTournamentStats({
          totalParticipants: participants.length,
          totalMatches: matches.length,
          totalCompletedMatches: Object.values(results).filter(
            (r) => r.completed
          ).length,
          totalPools: groups.reduce(
            (acc, group) => acc + group.pools.length,
            0
          ),
          totalGroups: groups.length,
        });
      } catch (error) {
        console.error("Erreur lors du calcul des résultats:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [participants, groups, matches, results]);

  // Fonction pour obtenir le nom du groupe
  const getGroupName = (groupId) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return "Groupe inconnu";

    return `${group.gender === "male" ? "H" : "F"} ${group.ageCategory.name} ${
      group.weightCategory.name
    }`;
  };

  // Fonction pour obtenir les résultats du groupe sélectionné
  const getSelectedGroupResults = () => {
    if (!selectedGroup) return [];

    return poolResults.filter((result) => result.groupId === selectedGroup);
  };

  // Exporter les résultats en CSV
  const exportResultsCSV = () => {
    const headers = [
      "Groupe",
      "Poule",
      "Position",
      "Nom",
      "Prénom",
      "Ligue",
      "Points",
      "Rounds gagnés",
      "Points marqués",
    ];

    let csvContent = headers.join(",") + "\n";

    poolResults.forEach((poolResult) => {
      const groupName = getGroupName(poolResult.groupId);

      poolResult.rankings.forEach((participant) => {
        const row = [
          groupName,
          poolResult.poolIndex + 1,
          participant.rank,
          participant.nom,
          participant.prenom,
          participant.ligue,
          participant.points,
          participant.roundsWon,
          participant.scoreTotal,
        ];

        csvContent +=
          row
            .map((cell) => {
              // Échapper les virgules et les guillemets dans les valeurs
              const value = String(cell);
              if (value.includes(",") || value.includes('"')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(",") + "\n";
      });
    });

    // Créer un blob et le télécharger
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `resultats_tournoi_taekwondo_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimer les résultats
  const printResults = () => {
    window.print();
  };

  return (
    <div className="results-container">
      <h2>Résultats de la compétition</h2>

      {isLoading ? (
        <div className="loading">
          <p>Calcul des résultats en cours...</p>
        </div>
      ) : (
        <>
          <div className="tournament-summary">
            <div className="summary-card">
              <h3>Participants</h3>
              <p>{tournamentStats.totalParticipants}</p>
            </div>
            <div className="summary-card">
              <h3>Groupes</h3>
              <p>{tournamentStats.totalGroups}</p>
            </div>
            <div className="summary-card">
              <h3>Poules</h3>
              <p>{tournamentStats.totalPools}</p>
            </div>
            <div className="summary-card">
              <h3>Combats</h3>
              <p>
                {tournamentStats.totalCompletedMatches} /{" "}
                {tournamentStats.totalMatches}
              </p>
            </div>
          </div>

          <div className="export-actions">
            <button className="export-btn csv-btn" onClick={exportResultsCSV}>
              Exporter en CSV
            </button>
            <button className="export-btn print-btn" onClick={printResults}>
              Imprimer les résultats
            </button>
          </div>

          <div className="results-navigation">
            <div className="group-selector">
              <label htmlFor="groupSelect">Sélectionner un groupe:</label>
              <select
                id="groupSelect"
                value={selectedGroup || ""}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {getGroupName(group.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="results-display">
            {getSelectedGroupResults().map((poolResult) => (
              <div
                key={`${poolResult.groupId}-${poolResult.poolIndex}`}
                className="pool-result"
              >
                <h3>
                  Groupe: {getGroupName(poolResult.groupId)} - Poule{" "}
                  {poolResult.poolIndex + 1}
                </h3>

                <table className="rankings-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Ligue</th>
                      <th>Points</th>
                      <th>Rounds gagnés</th>
                      <th>Points marqués</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolResult.rankings.map((participant, index) => (
                      <tr key={index} className={`rank-${participant.rank}`}>
                        <td>{participant.rank}</td>
                        <td>{participant.nom}</td>
                        <td>{participant.prenom}</td>
                        <td>{participant.ligue}</td>
                        <td>{participant.points}</td>
                        <td>{participant.roundsWon}</td>
                        <td>{participant.scoreTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="matches-summary">
                  <h4>Résumé des combats</h4>
                  <table className="matches-table">
                    <thead>
                      <tr>
                        <th>Combat</th>
                        <th>Athlète A</th>
                        <th>Score</th>
                        <th>Athlète B</th>
                        <th>Vainqueur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolResult.matches.map((match, index) => (
                        <tr key={index}>
                          <td>{match.matchNumber}</td>
                          <td className={match.winner === "A" ? "winner" : ""}>
                            {match.participants[0].prenom}{" "}
                            {match.participants[0].nom}
                          </td>
                          <td>
                            {match.rounds.map((round, roundIndex) => (
                              <div key={roundIndex} className="round-score">
                                {round.fighterA} - {round.fighterB}
                              </div>
                            ))}
                          </td>
                          <td className={match.winner === "B" ? "winner" : ""}>
                            {match.participants[1].prenom}{" "}
                            {match.participants[1].nom}
                          </td>
                          <td>
                            {match.winner === "A"
                              ? `${match.participants[0].prenom} ${match.participants[0].nom}`
                              : `${match.participants[1].prenom} ${match.participants[1].nom}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="navigation-buttons">
            <button className="prev-btn" onClick={prevStep}>
              Retour à la saisie des scores
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Results;
