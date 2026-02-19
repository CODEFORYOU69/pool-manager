import React, { useState, useEffect, useCallback } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  fetchPoolStandings,
  generateAndSaveFinals,
  fetchPoolMatches,
} from "../services/dbService";
import { getPhaseLabel } from "../utils/finalsGenerator";
import { exportMatchesToDaedoCsv } from "../utils/csvExporter";
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
  const [generatingAll, setGeneratingAll] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
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

  // Générer les finales pour TOUTES les catégories d'un coup
  const handleGenerateAllFinals = async () => {
    setGeneratingAll(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const group of groups) {
        if (group.pools && group.pools.length > 0) {
          for (const pool of group.pools) {
            // Skip si finales déjà générées ou pas assez de standings
            const poolStands = standings[pool.id];
            const alreadyGenerated = finalsMatches[pool.id] && finalsMatches[pool.id].length > 0;
            if (alreadyGenerated) continue;
            if (!poolStands || poolStands.length < 2) continue;

            try {
              await generateAndSaveFinals(pool.id);
              successCount++;
            } catch (err) {
              console.error(`Erreur finales pool ${pool.id}:`, err);
              errorCount++;
            }
          }
        }
      }

      await loadData();

      if (errorCount > 0) {
        alert(`${successCount} finales générées, ${errorCount} erreur(s)`);
      }
    } catch (err) {
      console.error("Erreur génération globale:", err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setGeneratingAll(false);
    }
  };

  // Exporter les matchs de finales au format CSV Daedo
  const handleExportFinalsCsv = async () => {
    setExportLoading(true);
    try {
      // Collecter tous les matchs de finales de toutes les poules
      const allFinalsMatches = [];
      for (const group of groups) {
        if (group.pools && group.pools.length > 0) {
          for (const pool of group.pools) {
            const finals = finalsMatches[pool.id] || [];
            allFinalsMatches.push(...finals);
          }
        }
      }

      if (allFinalsMatches.length === 0) {
        alert("Aucun match de finales à exporter. Générez d'abord les finales.");
        return;
      }

      await exportMatchesToDaedoCsv(
        allFinalsMatches,
        competitionId,
        groups,
        "finals_export_daedo.csv"
      );
    } catch (err) {
      console.error("Erreur export CSV:", err);
      alert(`Erreur: ${err.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  // Compter les pools sans finales
  const poolsWithoutFinals = groups.reduce((count, group) => {
    if (!group.pools) return count;
    return count + group.pools.filter((pool) => {
      const alreadyGenerated = finalsMatches[pool.id] && finalsMatches[pool.id].length > 0;
      const hasStandings = standings[pool.id] && standings[pool.id].length >= 2;
      return !alreadyGenerated && hasStandings;
    }).length;
  }, 0);

  const totalFinalsMatches = Object.values(finalsMatches).reduce(
    (sum, matches) => sum + (matches ? matches.length : 0), 0
  );

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

      {/* Boutons globaux */}
      <div className="global-actions" style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        {poolsWithoutFinals > 0 && (
          <button
            className="btn-generate-finals"
            onClick={handleGenerateAllFinals}
            disabled={generatingAll}
            style={{ padding: "10px 20px", fontSize: "14px", fontWeight: "bold" }}
          >
            {generatingAll
              ? "Génération en cours..."
              : `Générer toutes les finales (${poolsWithoutFinals} catégorie${poolsWithoutFinals > 1 ? "s" : ""})`}
          </button>
        )}
        {totalFinalsMatches > 0 && (
          <button
            className="btn-primary"
            onClick={handleExportFinalsCsv}
            disabled={exportLoading}
            style={{ padding: "10px 20px", fontSize: "14px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            {exportLoading ? "Export en cours..." : `Exporter CSV Daedo (${totalFinalsMatches} matchs)`}
          </button>
        )}
      </div>

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
                        {fighter.participant?.prenom || fighter.prenom || ""} {fighter.participant?.nom || fighter.nom || fighter.name || ""}
                      </td>
                      <td>{fighter.participant?.club || fighter.club || fighter.participant?.ligue || fighter.ligue || "-"}</td>
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
