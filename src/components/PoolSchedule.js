import React, { useState, useEffect } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { API_URL } from "../services/dbService";
import { exportMatchesToDaedoCsv } from "../utils/csvExporter";
import "../styles/PoolSchedule.css";

const PoolSchedule = ({ tournamentConfig, nextStep, prevStep }) => {
  const { competitionId } = useCompetition();
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (!competitionId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [matchesResponse, groupsResponse] = await Promise.all([
          fetch(`${API_URL}/competition/${competitionId}/matchesWithDetails`),
          fetch(`${API_URL}/competition/${competitionId}/groupsWithDetails`),
        ]);

        if (!matchesResponse.ok) {
          throw new Error("Erreur lors du chargement des combats");
        }
        if (!groupsResponse.ok) {
          throw new Error("Erreur lors du chargement des groupes");
        }

        const matchesData = await matchesResponse.json();
        const groupsData = await groupsResponse.json();

        // Filtrer uniquement les matchs de phase "pool"
        const poolMatches = (matchesData || []).filter(
          (m) => m.phase === "pool"
        );

        setMatches(poolMatches);
        setGroups(groupsData || []);
      } catch (err) {
        console.error("Erreur lors du chargement des donnees:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [competitionId]);

  /**
   * Organise les matchs par groupe, puis par tour au sein de chaque groupe.
   */
  const getMatchesByGroup = () => {
    const groupMap = {};

    matches.forEach((match) => {
      const groupId = match.group?.id || match.groupId;
      if (!groupId) return;

      if (!groupMap[groupId]) {
        groupMap[groupId] = {
          groupId,
          group: match.group || groups.find((g) => g.id === groupId) || {},
          matches: [],
          tours: {},
        };
      }

      groupMap[groupId].matches.push(match);

      const tour = match.tour || 1;
      if (!groupMap[groupId].tours[tour]) {
        groupMap[groupId].tours[tour] = [];
      }
      groupMap[groupId].tours[tour].push(match);
    });

    return Object.values(groupMap);
  };

  /**
   * Construit le libelle de la categorie a partir des infos du groupe.
   */
  const getCategoryLabel = (group) => {
    const gender = group.gender === "female" ? "Femmes" : "Hommes";
    const age = group.ageCategoryName || "";
    const weight = group.weightCategoryName || "";
    return [gender, age, weight].filter(Boolean).join(" - ");
  };

  /**
   * Recupere le nom complet d'un participant a partir du match.
   */
  const getParticipantName = (match, position) => {
    if (match.matchParticipants) {
      const mp = match.matchParticipants.find((p) => p.position === position);
      if (mp && mp.participant) {
        return `${mp.participant.prenom || ""} ${mp.participant.nom || ""}`.trim();
      }
    }
    return "---";
  };

  /**
   * Recupere le club d'un participant.
   */
  const getParticipantClub = (match, position) => {
    if (match.matchParticipants) {
      const mp = match.matchParticipants.find((p) => p.position === position);
      if (mp && mp.participant) {
        return mp.participant.club || "";
      }
    }
    return "";
  };

  /**
   * Export CSV au format Daedo scoring.
   */
  const handleExportCsv = async () => {
    setExportLoading(true);
    try {
      await exportMatchesToDaedoCsv(matches, competitionId, groups, "pool_schedule_export.csv");
    } catch (err) {
      console.error("Erreur lors de l'export CSV:", err);
    } finally {
      setExportLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pool-schedule-container">
        <div className="loading">Chargement du planning des combats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pool-schedule-container">
        <div className="error-message">{error}</div>
        <div className="navigation-buttons">
          <button className="prev-btn" onClick={prevStep}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  const groupedMatches = getMatchesByGroup();

  return (
    <div className="pool-schedule-container">
      <h2>Planning des combats - Poule Unique + Finales</h2>

      {matches.length === 0 ? (
        <div className="no-matches-message">
          Aucun combat de poule n'a encore ete genere.
        </div>
      ) : (
        <>
          <div className="schedule-summary-global">
            <p>
              <strong>{matches.length}</strong> combat{matches.length > 1 ? "s" : ""} de poule au total
              {" | "}
              <strong>{groupedMatches.length}</strong> categorie{groupedMatches.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="export-buttons">
            <button
              className="export-btn csv-btn"
              onClick={handleExportCsv}
              disabled={exportLoading}
            >
              {exportLoading ? "Export en cours..." : "Exporter CSV (format scoring)"}
            </button>
          </div>

          {groupedMatches.map((groupData) => {
            const { group, matches: groupMatches, tours } = groupData;
            const categoryLabel = getCategoryLabel(group);
            const tourNumbers = Object.keys(tours)
              .map(Number)
              .sort((a, b) => a - b);
            const totalTours = tourNumbers.length;

            // Compter le nombre de combattants uniques
            const fighters = new Set();
            groupMatches.forEach((m) => {
              if (m.matchParticipants) {
                m.matchParticipants.forEach((mp) => {
                  if (mp.participant) {
                    fighters.add(mp.participant.id || `${mp.participant.nom}-${mp.participant.prenom}`);
                  }
                });
              }
            });
            const nbFighters = fighters.size;
            const fightsPerPerson = groupMatches[0]?.pool?.fightsPerPerson || 0;

            return (
              <div key={groupData.groupId} className="category-schedule">
                <div className="category-header">
                  <h3>{categoryLabel}</h3>
                  <p className="category-summary">
                    {nbFighters} combattant{nbFighters > 1 ? "s" : ""}
                    {fightsPerPerson > 0 && (
                      <> &times; {fightsPerPerson} combat{fightsPerPerson > 1 ? "s" : ""}</>
                    )}
                    {" = "}
                    {groupMatches.length} combat{groupMatches.length > 1 ? "s" : ""}
                    {" en "}
                    {totalTours} tour{totalTours > 1 ? "s" : ""}
                  </p>
                </div>

                {tourNumbers.map((tourNum) => {
                  const tourMatches = tours[tourNum];
                  return (
                    <div key={tourNum} className="tour-section">
                      <div className="tour-header">
                        <h4>Tour {tourNum}</h4>
                        <span className="tour-match-count">
                          {tourMatches.length} combat{tourMatches.length > 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="tour-fights">
                        {tourMatches
                          .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
                          .map((match) => {
                            const fighterA = getParticipantName(match, "A");
                            const clubA = getParticipantClub(match, "A");
                            const fighterB = getParticipantName(match, "B");
                            const clubB = getParticipantClub(match, "B");
                            const isCompleted = match.status === "completed";

                            return (
                              <div
                                key={match.id}
                                className={`fight-item ${isCompleted ? "completed" : "pending"}`}
                              >
                                <div className="fight-number">
                                  Combat {match.matchNumber || "?"}
                                </div>
                                <div className="fight-participants">
                                  <span className="fighter fighter-red">
                                    {fighterA}
                                    {clubA && (
                                      <span className="fighter-club"> ({clubA})</span>
                                    )}
                                    <span className="fighter-color-tag red-tag">R</span>
                                  </span>
                                  <span className="fight-vs">vs</span>
                                  <span className="fighter fighter-blue">
                                    {fighterB}
                                    {clubB && (
                                      <span className="fighter-club"> ({clubB})</span>
                                    )}
                                    <span className="fighter-color-tag blue-tag">B</span>
                                  </span>
                                </div>
                                <div
                                  className={`fight-status ${
                                    isCompleted ? "completed" : "pending"
                                  }`}
                                >
                                  {isCompleted ? "Termine" : "En attente"}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={prevStep}>
          Retour
        </button>
        <button className="next-btn" onClick={nextStep}>
          Saisir les scores
        </button>
      </div>
    </div>
  );
};

export default PoolSchedule;
