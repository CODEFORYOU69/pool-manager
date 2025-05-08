import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  getCompletedMatches,
  saveMatchResult,
  updateMatchResult,
} from "../services/dbService";
import "../styles/ScoreInput.css";

const ScoreInput = ({ matches, schedule, setResults, nextStep, prevStep }) => {
  const { competitionId } = useCompetition();
  const [currentMatches, setCurrentMatches] = useState([]);
  const [matchResults, setMatchResults] = useState({});
  const [currentFilter, setCurrentFilter] = useState("all"); // 'all', 'pending', 'completed'
  const [currentArea, setCurrentArea] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [areasCount, setAreasCount] = useState(0);
  const [completedMatches, setCompletedMatches] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [savingMatch, setSavingMatch] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editedScores, setEditedScores] = useState(null);

  // Charger les combats terminés depuis la base de données au chargement
  useEffect(() => {
    if (competitionId) {
      loadCompletedMatches();
    }
  }, [competitionId]);

  // Fonction pour charger les combats terminés
  const loadCompletedMatches = async () => {
    try {
      const dbCompletedMatches = await getCompletedMatches(competitionId);
      setCompletedMatches(dbCompletedMatches);
    } catch (error) {
      console.error("Erreur lors du chargement des combats terminés:", error);
    }
  };

  useEffect(() => {
    if (matches && schedule) {
      setIsLoading(true);

      // Création de la liste des matchs avec les infos de planification
      const matchesWithSchedule = matches.map((match) => {
        const scheduleInfo = schedule.find(
          (s) => s.matchId === match.id && s.type === "match"
        );
        return {
          ...match,
          scheduled: !!scheduleInfo,
          ...(scheduleInfo || {}),
          status: matchResults[match.id] ? "completed" : "pending",
        };
      });

      setCurrentMatches(matchesWithSchedule);

      // Déterminer le nombre d'aires
      if (schedule && schedule.length > 0) {
        const maxArea = Math.max(...schedule.map((s) => s.areaNumber || 0));
        setAreasCount(maxArea);
      }

      setIsLoading(false);
    }
  }, [matches, schedule, matchResults]);

  // Gestion de la saisie des scores
  const handleScoreChange = (matchId, roundIndex, fighter, value) => {
    const scoreValue = parseInt(value, 10) || 0;

    setMatchResults((prev) => {
      // Récupérer ou initialiser les résultats du match
      const matchResult = prev[matchId] || {
        rounds: [
          { fighterA: 0, fighterB: 0, winner: null },
          { fighterA: 0, fighterB: 0, winner: null },
          { fighterA: 0, fighterB: 0, winner: null },
        ],
        winner: null,
        completed: false,
      };

      // Mettre à jour le score du round
      const updatedRounds = [...matchResult.rounds];
      if (fighter === "A") {
        updatedRounds[roundIndex] = {
          ...updatedRounds[roundIndex],
          fighterA: scoreValue,
        };
      } else {
        updatedRounds[roundIndex] = {
          ...updatedRounds[roundIndex],
          fighterB: scoreValue,
        };
      }

      // Déterminer le vainqueur du round
      const round = updatedRounds[roundIndex];
      if (round.fighterA > round.fighterB) {
        round.winner = "A";
      } else if (round.fighterB > round.fighterA) {
        round.winner = "B";
      } else {
        round.winner = null;
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          rounds: updatedRounds,
        },
      };
    });
  };

  // Finaliser un match
  const finalizeMatch = (matchId) => {
    setMatchResults((prev) => {
      const matchResult = prev[matchId];

      if (!matchResult) return prev;

      // Compter les rounds gagnés
      const roundsWonByA = matchResult.rounds.filter(
        (r) => r.winner === "A"
      ).length;
      const roundsWonByB = matchResult.rounds.filter(
        (r) => r.winner === "B"
      ).length;

      // Déterminer le vainqueur du match
      let winner = null;
      if (roundsWonByA > roundsWonByB) {
        winner = "A";
      } else if (roundsWonByB > roundsWonByA) {
        winner = "B";
      }

      return {
        ...prev,
        [matchId]: {
          ...matchResult,
          winner,
          completed: true,
        },
      };
    });
  };

  // Finaliser et sauvegarder un match
  const finalizeAndSaveMatch = async (matchId) => {
    setSavingMatch(matchId);
    console.log("=== Début de finalizeAndSaveMatch ===");
    console.log("ID du match à sauvegarder:", matchId);
    console.log("Type de l'ID:", typeof matchId);

    try {
      // D'abord finaliser le match localement
      finalizeMatch(matchId);
      console.log("Match finalisé localement");

      // Attendre un cycle pour s'assurer que le state est à jour
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Récupérer les résultats du match
      const matchResult = matchResults[matchId];
      console.log("État complet de matchResults:", matchResults);
      console.log("Résultats du match à sauvegarder:", matchResult);

      if (matchResult) {
        // Sauvegarder dans la base de données
        console.log("Tentative de sauvegarde avec les données:", {
          matchId,
          matchResult,
        });
        const saveResult = await saveMatchResult(matchId, matchResult);
        console.log("Réponse de saveMatchResult:", saveResult);

        if (saveResult.success) {
          // Recharger les combats terminés
          await loadCompletedMatches();
          console.log("Combats terminés rechargés avec succès");

          // Retirer le match de la liste courante ou le marquer comme complété
          setCurrentMatches((prev) =>
            prev.map((m) =>
              m.id === matchId ? { ...m, status: "completed" } : m
            )
          );

          // Mettre à jour les résultats globaux
          setResults((prevResults) => ({
            ...prevResults,
            [matchId]: matchResult,
          }));
        }
      } else {
        throw new Error("Match ou résultats non trouvés");
      }
    } catch (error) {
      console.error("Erreur détaillée lors de la sauvegarde du match:", error);
      console.error("Stack trace:", error.stack);
      alert("Erreur lors de la sauvegarde du match: " + error.message);
    } finally {
      setSavingMatch(null);
    }
  };

  // Fonction pour commencer l'édition d'un match
  const startEditMatch = (match) => {
    setEditingMatch(match);
    setEditedScores({
      rounds: match.rounds.map((round) => ({
        scoreA: round.scoreA,
        scoreB: round.scoreB,
        winner: round.winner,
      })),
      winner: match.winner,
    });
  };

  // Fonction pour mettre à jour un score pendant l'édition
  const handleEditScoreChange = (roundIndex, fighter, value) => {
    const newScores = { ...editedScores };
    const round = newScores.rounds[roundIndex];

    if (fighter === "A") {
      round.scoreA = parseInt(value) || 0;
    } else {
      round.scoreB = parseInt(value) || 0;
    }

    // Déterminer le vainqueur du round
    if (round.scoreA > round.scoreB) {
      round.winner = "A";
    } else if (round.scoreB > round.scoreA) {
      round.winner = "B";
    } else {
      round.winner = null;
    }

    // Déterminer le vainqueur du match
    const roundsWonByA = newScores.rounds.filter(
      (r) => r.winner === "A"
    ).length;
    const roundsWonByB = newScores.rounds.filter(
      (r) => r.winner === "B"
    ).length;

    if (roundsWonByA > roundsWonByB) {
      newScores.winner = "A";
    } else if (roundsWonByB > roundsWonByA) {
      newScores.winner = "B";
    } else {
      newScores.winner = null;
    }

    setEditedScores(newScores);
  };

  // Fonction pour sauvegarder les modifications
  const saveEditedMatch = async () => {
    try {
      const updatedMatch = {
        ...editingMatch,
        rounds: editedScores.rounds,
        winner: editedScores.winner,
        status: "completed",
        endTime: new Date(),
      };

      await updateMatchResult(editingMatch.id, updatedMatch);
      await loadCompletedMatches(); // Recharger la liste des matchs
      setEditingMatch(null);
      setEditedScores(null);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du match:", error);
      alert("Erreur lors de la mise à jour du match. Veuillez réessayer.");
    }
  };

  // Filtrer les matchs
  const getFilteredMatches = () => {
    return currentMatches
      .filter((match) => {
        // Filtre par statut
        if (currentFilter === "pending" && matchResults[match.id]?.completed) {
          return false;
        }
        if (
          currentFilter === "completed" &&
          !matchResults[match.id]?.completed
        ) {
          return false;
        }

        // Filtre par aire
        if (
          currentArea !== "all" &&
          match.areaNumber !== parseInt(currentArea, 10)
        ) {
          return false;
        }

        // Filtre par recherche
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const participantNames = match.participants.map((p) =>
            `${p.prenom} ${p.nom}`.toLowerCase()
          );

          if (
            !participantNames.some((name) => name.includes(searchLower)) &&
            !match.matchNumber.toString().includes(searchLower)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Tri par aire puis par horaire
        if (a.areaNumber !== b.areaNumber) {
          return a.areaNumber - b.areaNumber;
        }
        return new Date(a.startTime || 0) - new Date(b.startTime || 0);
      });
  };

  // Continuer vers l'étape suivante
  const handleContinue = () => {
    // Calculer les statistiques pour tous les combats terminés
    setResults(matchResults);
    nextStep();
  };

  // Récupérer le nom d'un participant
  const getParticipantName = (match, position) => {
    if (!match || !match.participants || !match.participants[position]) {
      return "Inconnu";
    }

    const participant = match.participants[position];
    return `${participant.prenom} ${participant.nom}`;
  };

  // Formater l'heure
  const formatTime = (dateString) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Ajouter un onglet de navigation pour les combats terminés
  const renderTabs = () => (
    <div className="tabs">
      <button
        className={`tab-btn ${!showCompleted ? "active" : ""}`}
        onClick={() => setShowCompleted(false)}
      >
        Combats en cours
      </button>
      <button
        className={`tab-btn ${showCompleted ? "active" : ""}`}
        onClick={() => setShowCompleted(true)}
      >
        Combats terminés ({completedMatches.length})
      </button>
    </div>
  );

  const filteredMatches = getFilteredMatches();
  const completedCount = currentMatches.filter(
    (m) => matchResults[m.id]?.completed
  ).length;
  const pendingCount = currentMatches.length - completedCount;

  // Modifier le rendu des matchs terminés pour inclure l'édition
  const renderCompletedMatches = () => (
    <div className="completed-matches">
      <h3>Combats terminés</h3>

      {completedMatches.length === 0 ? (
        <p>Aucun combat terminé pour le moment.</p>
      ) : (
        <table className="completed-matches-table">
          <thead>
            <tr>
              <th>N° Combat</th>
              <th>Aire</th>
              <th>Athlète A</th>
              <th>Score</th>
              <th>Athlète B</th>
              <th>Vainqueur</th>
              <th>Heure de fin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {completedMatches.map((match) => {
              const participantA = match.matchParticipants?.find(
                (p) => p.position === "A"
              )?.participant;
              const participantB = match.matchParticipants?.find(
                (p) => p.position === "B"
              )?.participant;

              if (!participantA || !participantB) return null;

              if (editingMatch?.id === match.id) {
                return (
                  <tr key={match.id} className="editing">
                    <td>{match.matchNumber}</td>
                    <td>{match.area.areaNumber}</td>
                    <td>{`${participantA.prenom} ${participantA.nom}`}</td>
                    <td>
                      {editedScores.rounds.map((round, i) => (
                        <div key={i} className="round-score-edit">
                          <input
                            type="number"
                            min="0"
                            value={round.scoreA}
                            onChange={(e) =>
                              handleEditScoreChange(i, "A", e.target.value)
                            }
                          />
                          {" - "}
                          <input
                            type="number"
                            min="0"
                            value={round.scoreB}
                            onChange={(e) =>
                              handleEditScoreChange(i, "B", e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </td>
                    <td>{`${participantB.prenom} ${participantB.nom}`}</td>
                    <td>
                      {editedScores.winner === "A"
                        ? `${participantA.prenom} ${participantA.nom}`
                        : `${participantB.prenom} ${participantB.nom}`}
                    </td>
                    <td>{formatTime(match.endTime)}</td>
                    <td>
                      <button onClick={saveEditedMatch} className="save-btn">
                        Sauvegarder
                      </button>
                      <button
                        onClick={() => setEditingMatch(null)}
                        className="cancel-btn"
                      >
                        Annuler
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={match.id}>
                  <td>{match.matchNumber}</td>
                  <td>{match.area.areaNumber}</td>
                  <td className={match.winner === "A" ? "winner" : ""}>
                    {`${participantA.prenom} ${participantA.nom}`}
                  </td>
                  <td>
                    {match.rounds.map((round, i) => (
                      <div key={i} className="round-score">
                        {round.scoreA} - {round.scoreB}
                      </div>
                    ))}
                  </td>
                  <td className={match.winner === "B" ? "winner" : ""}>
                    {`${participantB.prenom} ${participantB.nom}`}
                  </td>
                  <td>
                    {match.winner === "A"
                      ? `${participantA.prenom} ${participantA.nom}`
                      : `${participantB.prenom} ${participantB.nom}`}
                  </td>
                  <td>{formatTime(match.endTime)}</td>
                  <td>
                    <button
                      onClick={() => startEditMatch(match)}
                      className="edit-btn"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="score-input-container">
      <h2>Étape 5: Saisie des scores</h2>

      {isLoading ? (
        <div className="loading">
          <p>Chargement des combats...</p>
        </div>
      ) : (
        <>
          {renderTabs()}

          {showCompleted ? (
            renderCompletedMatches()
          ) : (
            <>
              <div className="match-stats">
                <div className="stat-card">
                  <h3>Total</h3>
                  <p>{currentMatches.length} combats</p>
                </div>
                <div className="stat-card completed">
                  <h3>Terminés</h3>
                  <p>{completedCount} combats</p>
                </div>
                <div className="stat-card pending">
                  <h3>En attente</h3>
                  <p>{pendingCount} combats</p>
                </div>
              </div>

              <div className="filters-container">
                <div className="filter-group">
                  <label htmlFor="statusFilter">Statut:</label>
                  <select
                    id="statusFilter"
                    value={currentFilter}
                    onChange={(e) => setCurrentFilter(e.target.value)}
                  >
                    <option value="all">Tous</option>
                    <option value="pending">En attente</option>
                    <option value="completed">Terminés</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="areaFilter">Aire:</label>
                  <select
                    id="areaFilter"
                    value={currentArea}
                    onChange={(e) => setCurrentArea(e.target.value)}
                  >
                    <option value="all">Toutes</option>
                    {[...Array(areasCount)].map((_, i) => (
                      <option key={i} value={i + 1}>
                        Aire {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group search">
                  <input
                    type="text"
                    placeholder="Rechercher un combat ou un athlète..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="matches-list">
                {filteredMatches.length === 0 ? (
                  <div className="no-matches">
                    <p>Aucun combat ne correspond aux filtres sélectionnés.</p>
                  </div>
                ) : (
                  filteredMatches.map((match) => {
                    const matchResult = matchResults[match.id] || {
                      rounds: [
                        { fighterA: 0, fighterB: 0, winner: null },
                        { fighterA: 0, fighterB: 0, winner: null },
                        { fighterA: 0, fighterB: 0, winner: null },
                      ],
                      winner: null,
                      completed: false,
                    };

                    return (
                      <div
                        key={match.id}
                        className={`match-card ${
                          matchResult.completed ? "completed" : "pending"
                        }`}
                      >
                        <div className="match-header">
                          <div className="match-number">
                            Combat #{match.matchNumber}
                          </div>
                          <div className="match-time">
                            <span className="area">
                              Aire {match.areaNumber || "?"}
                            </span>
                            <span className="time">
                              {formatTime(match.startTime)}
                            </span>
                          </div>
                        </div>

                        <div className="match-details">
                          <div className="fighters">
                            <div
                              className={`fighter fighter-a ${
                                matchResult.winner === "A" ? "winner" : ""
                              }`}
                            >
                              {getParticipantName(match, 0)}
                            </div>
                            <div className="vs">VS</div>
                            <div
                              className={`fighter fighter-b ${
                                matchResult.winner === "B" ? "winner" : ""
                              }`}
                            >
                              {getParticipantName(match, 1)}
                            </div>
                          </div>

                          <div className="rounds-scores">
                            {matchResult.rounds.map((round, roundIndex) => (
                              <div key={roundIndex} className="round">
                                <div className="round-title">
                                  Round {roundIndex + 1}
                                </div>
                                <div className="score-inputs">
                                  <input
                                    type="number"
                                    min="0"
                                    value={round.fighterA}
                                    onChange={(e) =>
                                      handleScoreChange(
                                        match.id,
                                        roundIndex,
                                        "A",
                                        e.target.value
                                      )
                                    }
                                    disabled={matchResult.completed}
                                    className={
                                      round.winner === "A" ? "winner" : ""
                                    }
                                  />
                                  <span className="separator">-</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={round.fighterB}
                                    onChange={(e) =>
                                      handleScoreChange(
                                        match.id,
                                        roundIndex,
                                        "B",
                                        e.target.value
                                      )
                                    }
                                    disabled={matchResult.completed}
                                    className={
                                      round.winner === "B" ? "winner" : ""
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="match-actions">
                            {!matchResult.completed && (
                              <>
                                <button
                                  className="finalize-btn"
                                  onClick={() => finalizeMatch(match.id)}
                                >
                                  Valider le résultat
                                </button>

                                <button
                                  className="save-btn"
                                  onClick={(e) => {
                                    console.log(
                                      "=== Clic sur le bouton Valider et Sauvegarder ==="
                                    );
                                    console.log("Event:", e);
                                    finalizeAndSaveMatch(match.id);
                                  }}
                                  disabled={savingMatch === match.id}
                                >
                                  {savingMatch === match.id
                                    ? "Sauvegarde..."
                                    : "Valider et Sauvegarder"}
                                </button>
                              </>
                            )}

                            {matchResult.completed && (
                              <div className="match-result">
                                <span>
                                  Vainqueur:{" "}
                                  {matchResult.winner === "A"
                                    ? getParticipantName(match, 0)
                                    : getParticipantName(match, 1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="navigation-buttons">
            <button className="prev-btn" onClick={prevStep}>
              Précédent
            </button>
            <button
              className="next-btn"
              onClick={handleContinue}
              disabled={pendingCount > 0 && !showCompleted}
            >
              Finaliser et voir les résultats
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScoreInput;
