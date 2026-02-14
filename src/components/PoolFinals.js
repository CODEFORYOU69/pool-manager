import React, { useState, useEffect, useCallback } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  fetchPoolStandings,
  generateAndSaveFinals,
  fetchPoolMatches,
} from "../services/dbService";
import { getPhaseLabel } from "../utils/finalsGenerator";
import "../styles/PoolFinals.css";

const PoolFinals = ({ tournamentConfig, nextStep, prevStep }) => {
  const { competitionId } = useCompetition();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [standings, setStandings] = useState({}); // poolId -> standings[]
  const [finalsMatches, setFinalsMatches] = useState({}); // poolId -> matches[]
  const [poolPhases, setPoolPhases] = useState({}); // poolId -> phase
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState(null); // poolId being generated
  const [error, setError] = useState(null);

  // Charger les groupes et leurs poules
  const loadData = useCallback(async () => {
    if (!competitionId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/competition/${competitionId}/groupsWithDetails`
      );
      if (!response.ok) throw new Error("Erreur chargement des groupes");
      const groupsData = await response.json();
      setGroups(groupsData);

      if (groupsData.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsData[0].id);
      }

      // Charger les standings et matchs de finales pour chaque poule
      const standingsMap = {};
      const finalsMap = {};
      const phasesMap = {};

      for (const group of groupsData) {
        if (group.pools && group.pools.length > 0) {
          for (const pool of group.pools) {
            phasesMap[pool.id] = pool.phase || "config";

            try {
              const poolStandings = await fetchPoolStandings(pool.id);
              standingsMap[pool.id] = poolStandings;
            } catch (e) {
              console.warn(`Pas de classement pour la poule ${pool.id}:`, e);
              standingsMap[pool.id] = [];
            }

            // Charger les matchs de la poule pour trouver les finales
            try {
              const poolData = await fetchPoolMatches(pool.id);
              const allMatches = poolData.matches || [];
              finalsMap[pool.id] = allMatches.filter(
                (m) => m.phase && m.phase !== "pool"
              );
            } catch (e) {
              console.warn(`Pas de matchs pour la poule ${pool.id}:`, e);
              finalsMap[pool.id] = [];
            }
          }
        }
      }

      setStandings(standingsMap);
      setFinalsMatches(finalsMap);
      setPoolPhases(phasesMap);
    } catch (err) {
      console.error("Erreur:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [competitionId, selectedGroupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Vérifier si tous les matchs de poule sont terminés pour une poule donnée
  const areAllPoolMatchesCompleted = (poolId) => {
    const poolStandings = standings[poolId];
    if (!poolStandings || poolStandings.length === 0) return false;
    // Si on a des standings, les matchs de poule ont été joués
    // Vérifier via la phase
    const phase = poolPhases[poolId];
    return phase === "pool" || phase === "finals" || phase === "completed";
  };

  // Vérifier si les finales ont été générées
  const hasFinalsGenerated = (poolId) => {
    const finals = finalsMatches[poolId];
    return finals && finals.length > 0;
  };

  // Générer les finales
  const handleGenerateFinals = async (poolId) => {
    setGenerating(poolId);
    try {
      await generateAndSaveFinals(poolId);
      // Recharger les données
      await loadData();
    } catch (err) {
      console.error("Erreur génération finales:", err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setGenerating(null);
    }
  };

  // Obtenir le nom d'un participant depuis un match
  const getParticipantName = (match, position) => {
    if (match.matchParticipants) {
      const mp = match.matchParticipants.find((m) => m.position === position);
      if (mp && mp.participant) {
        return `${mp.participant.prenom || ""} ${mp.participant.nom || ""}`.trim();
      }
    }
    return "TBD";
  };

  // Obtenir le club d'un participant
  const getParticipantClub = (match, position) => {
    if (match.matchParticipants) {
      const mp = match.matchParticipants.find((m) => m.position === position);
      if (mp && mp.participant) {
        return mp.participant.club || mp.participant.ligue || "";
      }
    }
    return "";
  };

  // Obtenir le statut visuel d'un match
  const getMatchStatusIcon = (match) => {
    if (match.status === "completed") return "\u2705";
    return "\u23F3";
  };

  // Obtenir le vainqueur d'un match
  const getMatchWinner = (match) => {
    if (match.status !== "completed") return null;
    if (match.winner) return match.winner;
    if (match.winnerPosition) {
      return getParticipantName(match, match.winnerPosition);
    }
    return null;
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  if (isLoading) {
    return (
      <div className="pool-finals-container">
        <div className="loading">
          <p>Chargement des classements...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pool-finals-container">
        <div className="error-message">
          <h3>Erreur</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadData}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pool-finals-container">
      <h2>Classement & Finales</h2>

      {/* Onglets de groupes */}
      {groups.length > 1 && (
        <div className="group-tabs">
          {groups.map((group) => (
            <button
              key={group.id}
              className={`group-tab ${selectedGroupId === group.id ? "active" : ""}`}
              onClick={() => setSelectedGroupId(group.id)}
            >
              {group.name || `${group.gender === "female" ? "F" : "M"} ${group.ageCategoryName || ""} ${group.weightCategoryName || ""}`}
            </button>
          ))}
        </div>
      )}

      {/* Contenu du groupe sélectionné */}
      {selectedGroup && selectedGroup.pools && selectedGroup.pools.map((pool) => (
        <div key={pool.id} className="pool-finals-card">
          <h3 className="pool-title">
            {selectedGroup.name || `${selectedGroup.gender === "female" ? "Féminin" : "Masculin"} ${selectedGroup.ageCategoryName || ""} ${selectedGroup.weightCategoryName || ""}`}
            {selectedGroup.pools.length > 1 && ` - Poule ${pool.poolIndex + 1}`}
          </h3>

          {/* Classement */}
          <div className="standings-section">
            <h4>Classement de la poule</h4>
            {standings[pool.id] && standings[pool.id].length > 0 ? (
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Combattant</th>
                    <th>Club</th>
                    <th>V</th>
                    <th>D</th>
                    <th>RW</th>
                    <th>RL</th>
                    <th>PF</th>
                    <th>PC</th>
                    <th>Pen</th>
                  </tr>
                </thead>
                <tbody>
                  {standings[pool.id].map((fighter, idx) => (
                    <tr
                      key={fighter.participantId || idx}
                      className={idx < 4 ? "qualified" : ""}
                    >
                      <td>
                        {idx + 1}
                        {idx < 4 && <span className="star"> *</span>}
                      </td>
                      <td className="fighter-name">
                        {fighter.prenom || ""} {fighter.nom || fighter.name || ""}
                      </td>
                      <td>{fighter.club || fighter.ligue || "-"}</td>
                      <td className="stat">{fighter.victories || 0}</td>
                      <td className="stat">{fighter.defeats || 0}</td>
                      <td className="stat">{fighter.roundsWon || 0}</td>
                      <td className="stat">{fighter.roundsLost || 0}</td>
                      <td className="stat">{fighter.totalPoints || 0}</td>
                      <td className="stat">{fighter.totalPointsAgainst || 0}</td>
                      <td className="stat">{fighter.penalties || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">Aucun classement disponible. Les matchs de poule doivent d'abord être joués.</p>
            )}
            {standings[pool.id] && standings[pool.id].length >= 4 && (
              <p className="qualified-legend">* = Qualifié(e) pour les finales</p>
            )}
          </div>

          {/* Bouton génération finales */}
          {!hasFinalsGenerated(pool.id) && (
            <div className="generate-finals-section">
              <button
                className="btn-generate-finals"
                onClick={() => handleGenerateFinals(pool.id)}
                disabled={
                  generating === pool.id ||
                  !standings[pool.id] ||
                  standings[pool.id].length < 2
                }
              >
                {generating === pool.id
                  ? "Génération en cours..."
                  : "Générer les finales"}
              </button>
              {(!standings[pool.id] || standings[pool.id].length < 2) && (
                <p className="warning-text">
                  Au moins 2 combattants classés sont nécessaires pour générer les finales.
                </p>
              )}
            </div>
          )}

          {/* Bracket de finales */}
          {hasFinalsGenerated(pool.id) && (
            <div className="finals-bracket-section">
              <h4>Phase finale</h4>

              {/* Demi-finales */}
              {finalsMatches[pool.id].filter(
                (m) => m.phase === "semi1" || m.phase === "semi2"
              ).length > 0 && (
                <div className="bracket-round">
                  <h5>Demi-finales</h5>
                  <div className="bracket-matches">
                    {finalsMatches[pool.id]
                      .filter((m) => m.phase === "semi1" || m.phase === "semi2")
                      .sort((a, b) => (a.phase > b.phase ? 1 : -1))
                      .map((match) => (
                        <div
                          key={match.id}
                          className={`bracket-match ${match.status === "completed" ? "completed" : "pending"}`}
                        >
                          <div className="bracket-match-label">
                            {getPhaseLabel(match.phase)}
                          </div>
                          <div className="bracket-fighters">
                            <div className={`bracket-fighter rouge ${getMatchWinner(match) && getParticipantName(match, "A") === getMatchWinner(match) ? "winner" : ""}`}>
                              <span className="position-badge rouge">R</span>
                              <span className="fighter-info">
                                {getParticipantName(match, "A")}
                                <small>{getParticipantClub(match, "A")}</small>
                              </span>
                            </div>
                            <div className="vs">VS</div>
                            <div className={`bracket-fighter bleu ${getMatchWinner(match) && getParticipantName(match, "B") === getMatchWinner(match) ? "winner" : ""}`}>
                              <span className="position-badge bleu">B</span>
                              <span className="fighter-info">
                                {getParticipantName(match, "B")}
                                <small>{getParticipantClub(match, "B")}</small>
                              </span>
                            </div>
                          </div>
                          <div className="bracket-status">
                            {getMatchStatusIcon(match)}{" "}
                            {match.status === "completed"
                              ? `Vainqueur: ${getMatchWinner(match) || "?"}`
                              : "En attente"}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Finale */}
              {finalsMatches[pool.id].filter((m) => m.phase === "final").length > 0 && (
                <div className="bracket-round final-round">
                  <h5>Finale</h5>
                  <div className="bracket-matches">
                    {finalsMatches[pool.id]
                      .filter((m) => m.phase === "final")
                      .map((match) => (
                        <div
                          key={match.id}
                          className={`bracket-match final ${match.status === "completed" ? "completed" : "pending"}`}
                        >
                          <div className="bracket-match-label">
                            {getPhaseLabel(match.phase)}
                          </div>
                          <div className="bracket-fighters">
                            <div className={`bracket-fighter rouge ${getMatchWinner(match) && getParticipantName(match, "A") === getMatchWinner(match) ? "winner" : ""}`}>
                              <span className="position-badge rouge">R</span>
                              <span className="fighter-info">
                                {getParticipantName(match, "A")}
                                <small>{getParticipantClub(match, "A")}</small>
                              </span>
                            </div>
                            <div className="vs">VS</div>
                            <div className={`bracket-fighter bleu ${getMatchWinner(match) && getParticipantName(match, "B") === getMatchWinner(match) ? "winner" : ""}`}>
                              <span className="position-badge bleu">B</span>
                              <span className="fighter-info">
                                {getParticipantName(match, "B")}
                                <small>{getParticipantClub(match, "B")}</small>
                              </span>
                            </div>
                          </div>
                          <div className="bracket-status">
                            {getMatchStatusIcon(match)}{" "}
                            {match.status === "completed"
                              ? `Vainqueur: ${getMatchWinner(match) || "?"}`
                              : "En attente"}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Petite finale */}
              {finalsMatches[pool.id].filter((m) => m.phase === "bronze").length > 0 && (
                <div className="bracket-round bronze-round">
                  <h5>Petite finale (3e place)</h5>
                  <div className="bracket-matches">
                    {finalsMatches[pool.id]
                      .filter((m) => m.phase === "bronze")
                      .map((match) => (
                        <div
                          key={match.id}
                          className={`bracket-match bronze ${match.status === "completed" ? "completed" : "pending"}`}
                        >
                          <div className="bracket-match-label">
                            {getPhaseLabel(match.phase)}
                          </div>
                          <div className="bracket-fighters">
                            <div className={`bracket-fighter rouge ${getMatchWinner(match) && getParticipantName(match, "A") === getMatchWinner(match) ? "winner" : ""}`}>
                              <span className="position-badge rouge">R</span>
                              <span className="fighter-info">
                                {getParticipantName(match, "A")}
                                <small>{getParticipantClub(match, "A")}</small>
                              </span>
                            </div>
                            <div className="vs">VS</div>
                            <div className={`bracket-fighter bleu ${getMatchWinner(match) && getParticipantName(match, "B") === getMatchWinner(match) ? "winner" : ""}`}>
                              <span className="position-badge bleu">B</span>
                              <span className="fighter-info">
                                {getParticipantName(match, "B")}
                                <small>{getParticipantClub(match, "B")}</small>
                              </span>
                            </div>
                          </div>
                          <div className="bracket-status">
                            {getMatchStatusIcon(match)}{" "}
                            {match.status === "completed"
                              ? `Vainqueur: ${getMatchWinner(match) || "?"}`
                              : "En attente"}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Navigation */}
      <div className="navigation-buttons">
        <button className="btn-secondary" onClick={prevStep}>
          Retour - Saisie des scores
        </button>
        <button className="btn-primary" onClick={loadData}>
          Rafraichir
        </button>
        <button className="btn-primary" onClick={nextStep}>
          Voir les résultats
        </button>
      </div>
    </div>
  );
};

export default PoolFinals;
