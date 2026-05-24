import React, { useState, useEffect } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { API_URL, applyAreaMoves } from "../services/dbService";
import { exportMatchesToDaedoCsv } from "../utils/csvExporter";
import { computeRebalanceMoves } from "../utils/areaRebalancer";
import "../styles/PoolSchedule.css";

const PoolSchedule = ({ tournamentConfig, nextStep, prevStep, setSchedule: setParentSchedule, setMatches: setParentMatches }) => {
  const { competitionId } = useCompetition();
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  // Surcharge utilisateur de la durée par combat (minutes) — recalcule l'estim.
  const [customMatchMinutes, setCustomMatchMinutes] = useState("");
  const [customBreakSeconds, setCustomBreakSeconds] = useState("");

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

        // Remonter les matchs au parent pour ScoreInput
        if (setParentMatches) {
          setParentMatches(poolMatches);
        }

        // Construire le schedule pour le calcul des retards dans ScoreInput
        if (setParentSchedule && poolMatches.length > 0) {
          const roundDuration = tournamentConfig?.roundDuration || 120;
          const matchDurationMs = (roundDuration * 3 + 30 * 2 + 60) * 1000;

          const scheduleItems = poolMatches.map((match) => {
            const startTime = match.startTime
              ? new Date(match.startTime)
              : new Date();
            const endTime = new Date(startTime.getTime() + matchDurationMs);

            return {
              type: "match",
              matchId: match.id,
              matchNumber: match.matchNumber,
              areaNumber: match.area?.areaNumber || match.areaNumber || 1,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            };
          });

          setParentSchedule(scheduleItems);
        }
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

  /**
   * Rééquilibre les aires : calcule les déplacements de poules pour égaliser
   * la charge entre aires d'un même slot PSS, puis applique côté backend.
   */
  const handleRebalanceAreas = async () => {
    const pools = [];
    for (const group of groups) {
      const pool = group.pools?.[0];
      if (!pool) continue;
      const poolMatches = pool.matches || [];
      if (poolMatches.length === 0) continue;
      const currentAreaNumber =
        poolMatches[0]?.area?.areaNumber || poolMatches[0]?.areaNumber || null;
      if (!currentAreaNumber) continue;
      pools.push({
        id: pool.id,
        group,
        currentAreaNumber,
        matchCount: poolMatches.length,
      });
    }

    if (pools.length === 0) {
      alert("Aucune poule avec des combats à rééquilibrer.");
      return;
    }

    const { moves, summary } = computeRebalanceMoves(pools);

    if (moves.length === 0) {
      alert(
        `Les aires sont déjà équilibrées (min ${summary.before.min}, max ${summary.before.max} combats).`
      );
      return;
    }

    const confirmMsg =
      `Rééquilibrage proposé :\n` +
      `Charge avant : min ${summary.before.min}, max ${summary.before.max}\n` +
      `Charge après : min ${summary.after.min}, max ${summary.after.max}\n` +
      `Poules déplacées : ${moves.length}\n\n` +
      moves
        .map(
          (m) =>
            `  • aire ${m.fromAreaNumber} → aire ${m.toAreaNumber} (${m.matchCount} combats)`
        )
        .join("\n") +
      `\n\nAppliquer ?`;

    if (!window.confirm(confirmMsg)) return;

    setRebalancing(true);
    try {
      await applyAreaMoves(
        competitionId,
        moves.map((m) => ({
          poolId: m.poolId,
          targetAreaNumber: m.toAreaNumber,
        }))
      );
      // Refetch matches + groups au lieu d'un reload complet
      const [mRes, gRes] = await Promise.all([
        fetch(`${API_URL}/competition/${competitionId}/matchesWithDetails`),
        fetch(`${API_URL}/competition/${competitionId}/groupsWithDetails`),
      ]);
      if (mRes.ok) {
        const mData = await mRes.json();
        setMatches((mData || []).filter((m) => m.phase === "pool"));
      }
      if (gRes.ok) {
        const gData = await gRes.json();
        setGroups(gData || []);
      }
      alert(`Rééquilibrage appliqué : ${moves.length} poule(s) déplacée(s).`);
    } catch (err) {
      console.error("Erreur rebalance:", err);
      alert(`Erreur lors du rééquilibrage : ${err.message}`);
    } finally {
      setRebalancing(false);
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

  // Estimation de la durée et heure de fin
  const roundDuration = tournamentConfig?.roundDuration || 120;
  const breakDuration = tournamentConfig?.breakDuration || 30;
  const computedMatchSeconds = roundDuration * 3 + breakDuration * 2 + 60; // 3 rounds + 2 pauses + 60s setup
  // Si l'utilisateur a saisi une durée custom, on l'utilise. Sinon valeur calculée.
  const matchDurationSeconds =
    customMatchMinutes !== "" && !isNaN(parseFloat(customMatchMinutes))
      ? Math.max(1, parseFloat(customMatchMinutes)) * 60
      : computedMatchSeconds;
  const breakBetweenMatchesSeconds =
    customBreakSeconds !== "" && !isNaN(parseInt(customBreakSeconds, 10))
      ? Math.max(0, parseInt(customBreakSeconds, 10))
      : 60;

  // Répartition par aire pour trouver le goulot d'étranglement
  const matchesByArea = {};
  matches.forEach((m) => {
    const area = m.area?.areaNumber || m.areaNumber || 1;
    matchesByArea[area] = (matchesByArea[area] || 0) + 1;
  });
  const maxMatchesPerArea = Math.max(0, ...Object.values(matchesByArea));
  const totalDurationSeconds =
    maxMatchesPerArea * matchDurationSeconds +
    Math.max(0, maxMatchesPerArea - 1) * breakBetweenMatchesSeconds;

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
    return `${m} min`;
  };

  const formatTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Heure de début : plus tôt startTime trouvé, sinon config, sinon maintenant
  const startTimes = matches
    .map((m) => m.startTime)
    .filter(Boolean)
    .map((t) => new Date(t).getTime());
  const earliestStart =
    startTimes.length > 0
      ? new Date(Math.min(...startTimes))
      : tournamentConfig?.startTime
      ? new Date(tournamentConfig.startTime)
      : null;
  const estimatedEndTime = earliestStart
    ? new Date(earliestStart.getTime() + totalDurationSeconds * 1000)
    : null;

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
              {" | "}
              <strong>{Object.keys(matchesByArea).length}</strong> aire{Object.keys(matchesByArea).length > 1 ? "s" : ""}
            </p>
            <p>
              Durée estimée (sur {Object.keys(matchesByArea).length} aire{Object.keys(matchesByArea).length > 1 ? "s" : ""}) :{" "}
              <strong>{formatDuration(totalDurationSeconds)}</strong>
              {earliestStart && (
                <>
                  {" | "}
                  Début : <strong>{formatTime(earliestStart)}</strong>
                  {" | "}
                  Fin estimée : <strong>{formatTime(estimatedEndTime)}</strong>
                </>
              )}
              {" | "}
              <strong>
                {Math.round(
                  3600 / (matchDurationSeconds + breakBetweenMatchesSeconds)
                )}
              </strong>{" "}
              combats/h/aire
              {" · "}
              <strong>
                {Math.round(
                  (3600 / (matchDurationSeconds + breakBetweenMatchesSeconds)) *
                    Object.keys(matchesByArea).length
                )}
              </strong>{" "}
              combats/h total
            </p>
            <p className="duration-note">
              Estimation basée sur l'aire la plus chargée ({maxMatchesPerArea} combats) ·{" "}
              <label>
                Durée par combat :{" "}
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={
                    customMatchMinutes !== ""
                      ? customMatchMinutes
                      : Math.round((computedMatchSeconds / 60) * 10) / 10
                  }
                  onChange={(e) => setCustomMatchMinutes(e.target.value)}
                  style={{ width: 60, margin: "0 4px" }}
                />
                min
              </label>{" "}
              +{" "}
              <label>
                pause{" "}
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={
                    customBreakSeconds !== "" ? customBreakSeconds : 60
                  }
                  onChange={(e) => setCustomBreakSeconds(e.target.value)}
                  style={{ width: 60, margin: "0 4px" }}
                />
                s entre combats
              </label>
              . Les finales ajouteront du temps supplémentaire.
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
            <button
              className="export-btn"
              onClick={handleRebalanceAreas}
              disabled={rebalancing}
              title="Équilibre les combats entre aires d'un même slot PSS"
            >
              {rebalancing ? "Rééquilibrage..." : "Rééquilibrer les aires"}
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
                                  <span className="fighter fighter-blue">
                                    {fighterA}
                                    {clubA && (
                                      <span className="fighter-club"> ({clubA})</span>
                                    )}
                                    <span className="fighter-color-tag blue-tag">B</span>
                                  </span>
                                  <span className="fight-vs">vs</span>
                                  <span className="fighter fighter-red">
                                    {fighterB}
                                    {clubB && (
                                      <span className="fighter-club"> ({clubB})</span>
                                    )}
                                    <span className="fighter-color-tag red-tag">R</span>
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
