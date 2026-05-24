import React, { useState, useEffect, useMemo } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { API_URL } from "../services/dbService";
import { performDraw, reorderPoolSchedule } from "../services/dbService";
import ManualAreaAssignment from "./ManualAreaAssignment";
import {
  validateFightsChoice,
  generateKRegularDraw,
  organizeFightsIntoTours,
  summarizeDraw,
} from "../utils/drawGenerator";
import {
  computePssAreaAssignment,
  getPssForGroup,
} from "../utils/pssAreaAssignment";
import ParticipantModal from "./ParticipantModal";
import "../styles/PoolConfig.css";

const PoolConfig = ({
  participants,
  tournamentConfig,
  setGroups,
  nextStep,
  prevStep,
}) => {
  const { competitionId } = useCompetition();

  // State: groups fetched from API
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global K selection
  const [globalK, setGlobalK] = useState(3);
  const [bulkDrawing, setBulkDrawing] = useState(false);
  const [bulkValidating, setBulkValidating] = useState(false);
  const [showAreaPanel, setShowAreaPanel] = useState(false);

  // Per-category state keyed by group id
  const [selectedK, setSelectedK] = useState({});
  const [drawResults, setDrawResults] = useState({});
  const [drawFights, setDrawFights] = useState({});
  const [drawTours, setDrawTours] = useState({});
  const [validating, setValidating] = useState({});
  const [validated, setValidated] = useState({});

  // Participant management
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);

  // PSS area mode
  const [areaMode, setAreaMode] = useState("balanced");

  // Fetch groups with details on mount
  useEffect(() => {
    const fetchGroups = async () => {
      if (!competitionId) {
        setError("Aucun ID de competition disponible.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/competition/${competitionId}/groupsWithDetails`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Erreur lors de la recuperation des categories: ${response.status}`
          );
        }

        const data = await response.json();
        setCategories(data);

        // Initialize default K=3 for each group
        // Detect pools that already have matches (draw already validated)
        const defaults = {};
        const alreadyValidated = {};
        data.forEach((group) => {
          defaults[group.id] = 3;
          // Check if any pool in this group already has matches
          const pool = group.pools?.[0];
          if (pool && pool.matches && pool.matches.length > 0) {
            alreadyValidated[group.id] = true;
            // Try to deduce K from existing matches
            const n = pool.poolParticipants?.length || 0;
            const totalMatches = pool.matches.filter(m => m.phase === "pool" || !m.phase).length;
            if (n > 0 && totalMatches > 0) {
              const k = Math.round((totalMatches * 2) / n);
              if (k >= 2 && k <= 4) defaults[group.id] = k;
            }
          }
        });
        setSelectedK(defaults);
        if (Object.keys(alreadyValidated).length > 0) {
          setValidated(alreadyValidated);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des categories:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [competitionId]);

  /**
   * Refresh categories from API (extracted from useEffect).
   */
  const refreshCategories = async () => {
    if (!competitionId) return;
    try {
      const response = await fetch(
        `${API_URL}/competition/${competitionId}/groupsWithDetails`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );
      if (!response.ok) throw new Error(`Erreur: ${response.status}`);
      const data = await response.json();
      setCategories(data);

      // Re-initialize selectedK defaults for new groups
      const defaults = { ...selectedK };
      const alreadyValidated = { ...validated };
      data.forEach((group) => {
        if (defaults[group.id] === undefined) defaults[group.id] = 3;
        const pool = group.pools?.[0];
        if (pool && pool.matches && pool.matches.length > 0) {
          alreadyValidated[group.id] = true;
        }
      });
      setSelectedK(defaults);
      setValidated(alreadyValidated);
    } catch (err) {
      console.error("Erreur lors du refresh des categories:", err);
    }
  };

  /**
   * Invalidate draw state for a set of groupIds (local + server).
   */
  const invalidateGroups = async (groupIds) => {
    for (const gid of groupIds) {
      // Clear local state
      setValidated((prev) => { const n = { ...prev }; delete n[gid]; return n; });
      setDrawResults((prev) => { const n = { ...prev }; delete n[gid]; return n; });
      setDrawFights((prev) => { const n = { ...prev }; delete n[gid]; return n; });
      setDrawTours((prev) => { const n = { ...prev }; delete n[gid]; return n; });

      // If draw was saved in DB, invalidate server-side
      const group = categories.find((g) => g.id === gid);
      const pool = group?.pools?.[0];
      if (pool && pool.matches && pool.matches.length > 0) {
        try {
          await fetch(`${API_URL}/group/${gid}/invalidateDraw`, { method: "POST" });
        } catch (err) {
          console.error("Erreur invalidateDraw pour group", gid, err);
        }
      }
    }
  };

  /**
   * Open modal in add mode (optionally for a specific group).
   */
  const handleAddParticipant = (groupId) => {
    setEditingParticipant(null);
    setEditingGroupId(groupId || null);
    setShowParticipantModal(true);
  };

  /**
   * Open modal in edit mode.
   */
  const handleEditParticipant = (participant, groupId) => {
    setEditingParticipant(participant);
    setEditingGroupId(groupId);
    setShowParticipantModal(true);
  };

  /**
   * Delete a participant.
   */
  const handleDeleteParticipant = async (participant, groupId) => {
    if (!window.confirm(`Supprimer ${participant.nom} ${participant.prenom} ?`)) return;
    try {
      const resp = await fetch(`${API_URL}/participant/${participant.id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error("Erreur suppression");
      const { groupIds } = await resp.json();
      const impactedIds = groupIds && groupIds.length > 0 ? groupIds : [groupId];
      await invalidateGroups(impactedIds);
      await refreshCategories();
    } catch (err) {
      alert(`Erreur lors de la suppression : ${err.message}`);
    }
  };

  /**
   * Save participant (add or edit) from modal.
   */
  const handleSaveParticipant = async (data) => {
    if (editingParticipant) {
      // --- Edit existing ---
      const resp = await fetch(`${API_URL}/participant/${editingParticipant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error("Erreur modification");

      // Reassign to correct group
      const reassignResp = await fetch(`${API_URL}/participant/${editingParticipant.id}/reassign`, {
        method: "POST",
      });
      if (!reassignResp.ok) throw new Error("Erreur reassignation");
      const { oldGroupIds, newGroupId } = await reassignResp.json();

      // Invalidate all impacted groups (old + new)
      const impactedIds = [...new Set([...(oldGroupIds || []), ...(newGroupId ? [newGroupId] : [])])];
      await invalidateGroups(impactedIds);
    } else {
      // --- Add new ---
      const resp = await fetch(`${API_URL}/competition/${competitionId}/addParticipant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error("Erreur ajout");
      const result = await resp.json();
      if (!result.groupId) {
        alert("Athlete cree mais aucune categorie correspondante trouvee.");
      } else {
        await invalidateGroups([result.groupId]);
      }
    }
    await refreshCategories();
  };

  // Compute PSS assignment when mode is PSS and categories are loaded
  const numAreas = useMemo(() => {
    if (!tournamentConfig) return 1;
    const n = parseInt(tournamentConfig.numAreas, 10);
    return !isNaN(n) && n > 0 ? n : 1;
  }, [tournamentConfig]);

  const pssAssignment = useMemo(() => {
    if (areaMode !== "pss" || categories.length === 0 || numAreas < 1) {
      return null;
    }
    return computePssAreaAssignment(categories, numAreas, globalK);
  }, [areaMode, categories, numAreas, globalK]);

  /**
   * Build a display name for a category group.
   */
  const getCategoryName = (group) => {
    const genderLabel = group.gender === "male" ? "Hommes" : "Femmes";
    const ageName = group.ageCategoryName || "";
    const weightName = group.weightCategoryName || "";
    return `${genderLabel} - ${ageName} - ${weightName}`;
  };

  /**
   * Get the list of fighters (participants) from a group.
   * The API returns participants via the group's participants relation.
   */
  const getFighters = (group) => {
    if (group.participants && Array.isArray(group.participants)) {
      return group.participants.map((pg) => pg.participant || pg);
    }
    return [];
  };

  /**
   * Get the pool ID for a group (first pool).
   */
  const getPoolId = (group) => {
    if (group.pools && group.pools.length > 0) {
      return group.pools[0].id;
    }
    return null;
  };

  /**
   * Get fighter IDs from a group's pool participants.
   */
  const getFighterIds = (group) => {
    if (group.pools && group.pools.length > 0) {
      const pool = group.pools[0];
      if (pool.poolParticipants && Array.isArray(pool.poolParticipants)) {
        return pool.poolParticipants.map((pp) => pp.participantId);
      }
    }
    // Fallback to group participants
    return getFighters(group).map((f) => f.id).filter(Boolean);
  };

  /**
   * Build a participants map (id -> participant object) for a group.
   */
  const buildParticipantsMap = (group) => {
    const fighters = getFighters(group);
    const map = {};
    fighters.forEach((f) => {
      if (f && f.id) {
        map[f.id] = f;
      }
    });
    return map;
  };

  /**
   * Get allowedAreas for a group based on PSS mode.
   */
  const getAllowedAreas = (groupId) => {
    if (areaMode !== "pss" || !pssAssignment) return undefined;
    return pssAssignment.groupAreaMap[groupId] || undefined;
  };

  /**
   * Handle K selection for a category.
   */
  const handleSelectK = (groupId, k) => {
    setSelectedK((prev) => ({ ...prev, [groupId]: k }));
    // Clear any existing draw when K changes
    setDrawResults((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setDrawFights((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setDrawTours((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setValidated((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  /**
   * Check if a given K is valid for a group.
   */
  const isKValid = (group, k) => {
    const n = getFighterIds(group).length;
    const validation = validateFightsChoice(n, k);
    return validation.valid;
  };

  /**
   * Get validation info for a group and K.
   */
  const getValidationInfo = (group, k) => {
    const n = getFighterIds(group).length;
    return validateFightsChoice(n, k);
  };

  /**
   * Run the draw for a category.
   */
  const handleDraw = (group) => {
    const groupId = group.id;
    const k = selectedK[groupId] || 3;
    const fighterIds = getFighterIds(group);
    const participantsMap = buildParticipantsMap(group);

    try {
      const fights = generateKRegularDraw(fighterIds, k, participantsMap);
      const tours = organizeFightsIntoTours(fights);
      const summary = summarizeDraw(fights, participantsMap);

      setDrawFights((prev) => ({ ...prev, [groupId]: fights }));
      setDrawTours((prev) => ({ ...prev, [groupId]: tours }));
      setDrawResults((prev) => ({ ...prev, [groupId]: summary }));
    } catch (err) {
      console.error("Erreur lors du tirage:", err);
      alert(`Erreur lors du tirage : ${err.message}`);
    }
  };

  /**
   * Redo the draw for a category.
   */
  const handleRedraw = (group) => {
    setValidated((prev) => {
      const next = { ...prev };
      delete next[group.id];
      return next;
    });
    handleDraw(group);
  };

  /**
   * Validate the draw: save to backend.
   */
  const handleValidateDraw = async (group) => {
    const groupId = group.id;
    const poolId = getPoolId(group);

    console.log("handleValidateDraw - group:", group.id, "poolId:", poolId, "pools:", group.pools);

    if (!poolId) {
      alert("Aucune poule trouvee pour cette categorie.");
      return;
    }

    const fights = drawFights[groupId];
    const tours = drawTours[groupId];
    const k = selectedK[groupId] || 3;

    if (!fights || !tours) {
      alert("Veuillez effectuer le tirage avant de valider.");
      return;
    }

    try {
      setValidating((prev) => ({ ...prev, [groupId]: true }));
      const allowedAreas = getAllowedAreas(groupId);
      await performDraw(poolId, fights, tours, k, allowedAreas);
      setValidated((prev) => ({ ...prev, [groupId]: true }));
      console.log(`Tirage valide pour la categorie ${getCategoryName(group)}`);
    } catch (err) {
      console.error("Erreur lors de la validation du tirage:", err);
      alert(`Erreur lors de la validation : ${err.message}`);
    } finally {
      setValidating((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  /**
   * Apply global K to all categories (only where valid).
   */
  const applyGlobalK = (k) => {
    setGlobalK(k);
    const newSelectedK = {};
    categories.forEach((group) => {
      const n = getFighterIds(group).length;
      const validation = validateFightsChoice(n, k);
      if (validation.valid) {
        newSelectedK[group.id] = k;
      } else {
        // Keep existing K if global K is invalid for this category
        newSelectedK[group.id] = selectedK[group.id] || 3;
      }
    });
    setSelectedK(newSelectedK);
    // Clear draws for categories whose K changed
    setDrawResults({});
    setDrawFights({});
    setDrawTours({});
    setValidated({});
  };

  /**
   * Bulk draw: run draw for all non-validated categories with a valid K.
   */
  const handleBulkDraw = () => {
    setBulkDrawing(true);
    const newDrawFights = { ...drawFights };
    const newDrawTours = { ...drawTours };
    const newDrawResults = { ...drawResults };
    let errors = [];

    categories.forEach((group) => {
      if (validated[group.id]) return; // skip already validated
      const groupId = group.id;
      const k = selectedK[groupId] || 3;
      const fighterIds = getFighterIds(group);
      const n = fighterIds.length;

      // Catégorie trop petite pour un tirage K-régulier : pas d'erreur, juste
      // un skip silencieux. L'athlète (N=1) ou la paire (N=2) passera direct
      // en finale via matchGenerator.
      if (n <= 2) return;

      const validation = validateFightsChoice(n, k);
      if (!validation.valid) {
        errors.push(`${getCategoryName(group)}: K=${k} invalide`);
        return;
      }

      try {
        const participantsMap = buildParticipantsMap(group);
        const fights = generateKRegularDraw(fighterIds, k, participantsMap);
        const tours = organizeFightsIntoTours(fights);
        const summary = summarizeDraw(fights, participantsMap);

        newDrawFights[groupId] = fights;
        newDrawTours[groupId] = tours;
        newDrawResults[groupId] = summary;
      } catch (err) {
        errors.push(`${getCategoryName(group)}: ${err.message}`);
      }
    });

    setDrawFights(newDrawFights);
    setDrawTours(newDrawTours);
    setDrawResults(newDrawResults);
    setBulkDrawing(false);

    if (errors.length > 0) {
      alert(`Tirage effectué avec des erreurs :\n${errors.join("\n")}`);
    }
  };

  /**
   * Bulk validate: save all draws to backend.
   */
  const handleBulkValidate = async () => {
    setBulkValidating(true);
    const errors = [];

    for (const group of categories) {
      const groupId = group.id;
      if (validated[groupId]) continue; // skip already validated
      if (!drawFights[groupId] || !drawTours[groupId]) continue; // skip no draw

      const poolId = getPoolId(group);
      console.log("bulkValidate - group:", groupId, "poolId:", poolId, "pools:", group.pools);
      if (!poolId) {
        errors.push(`${getCategoryName(group)}: pas de poule trouvée`);
        continue;
      }

      const k = selectedK[groupId] || 3;

      try {
        setValidating((prev) => ({ ...prev, [groupId]: true }));
        const allowedAreas = getAllowedAreas(groupId);
        await performDraw(poolId, drawFights[groupId], drawTours[groupId], k, allowedAreas);
        setValidated((prev) => ({ ...prev, [groupId]: true }));
      } catch (err) {
        errors.push(`${getCategoryName(group)}: ${err.message}`);
      } finally {
        setValidating((prev) => ({ ...prev, [groupId]: false }));
      }
    }

    // Réordonner le planning pour entrelacer les poules par paires sur chaque aire
    // (mode "Poule Unique + Finales" seulement — sinon chaque catégorie reste à sa place).
    if (
      errors.length === 0 &&
      competitionId &&
      tournamentConfig?.tournamentType === "poolFinals"
    ) {
      try {
        await reorderPoolSchedule(competitionId);
      } catch (err) {
        console.warn("Réorganisation du planning échouée:", err);
      }
    }

    setBulkValidating(false);

    if (errors.length > 0) {
      alert(`Validation terminée avec des erreurs :\n${errors.join("\n")}`);
    }
  };

  /**
   * Check how many categories have a draw ready but not validated.
   */
  const countReadyToValidate = () => {
    return categories.filter(
      (g) => !validated[g.id] && drawFights[g.id] && drawTours[g.id]
    ).length;
  };

  /**
   * Check how many categories still need a draw.
   */
  const countNeedDraw = () => {
    return categories.filter(
      (g) =>
        !validated[g.id] &&
        !drawFights[g.id] &&
        getFighterIds(g).length > 2 // N ≤ 2 → pas de tirage, finale directe
    ).length;
  };

  /**
   * Check if all categories have been validated.
   */
  const allValidated = () => {
    return (
      categories.length > 0 &&
      categories.every(
        (g) => validated[g.id] || getFighterIds(g).length <= 2
      )
    );
  };

  /**
   * Handle "Suivant" click.
   */
  const handleNext = () => {
    if (allValidated()) {
      nextStep();
    } else {
      nextStep();
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="pool-config-container">
        <h2>Configuration des poules et tirage</h2>
        <p className="loading-message">Chargement des categories...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="pool-config-container">
        <h2>Configuration des poules et tirage</h2>
        <p className="error-message">{error}</p>
        <div className="navigation-buttons">
          <button type="button" className="prev-btn" onClick={prevStep}>
            Precedent
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (categories.length === 0) {
    return (
      <div className="pool-config-container">
        <h2>Configuration des poules et tirage</h2>
        <p className="no-categories">
          Aucune categorie trouvee pour cette competition.
        </p>
        <div className="navigation-buttons">
          <button type="button" className="prev-btn" onClick={prevStep}>
            Precedent
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pool-config-container">
      <h2>Configuration des poules et tirage</h2>

      {/* Mode de repartition des aires */}
      <div className="area-mode-section">
        <label className="area-mode-label">Repartition des aires :</label>
        <div className="area-mode-options">
          <button
            type="button"
            className={`mode-option ${areaMode === "balanced" ? "active" : ""}`}
            onClick={() => setAreaMode("balanced")}
          >
            <span className="mode-option-title">Equilibre</span>
            <span className="mode-option-desc">Repartition equilibree sur toutes les aires</span>
          </button>
          <button
            type="button"
            className={`mode-option ${areaMode === "pss" ? "active" : ""}`}
            onClick={() => setAreaMode("pss")}
          >
            <span className="mode-option-title">Par taille de plastrons (PSS)</span>
            <span className="mode-option-desc">Regrouper par taille PSS (max 1-2 tailles/aire)</span>
          </button>
        </div>
      </div>

      {/* PSS Preview Table */}
      {areaMode === "pss" && pssAssignment && pssAssignment.pssSummary.length > 0 && (
        <div className="pss-preview">
          <h3>Affectation des aires par taille PSS</h3>
          <table className="pss-preview-table">
            <thead>
              <tr>
                <th>Taille(s) PSS</th>
                <th>Aire(s)</th>
                <th>Categories</th>
                <th>Combats estimes</th>
                <th>Combats/aire</th>
              </tr>
            </thead>
            <tbody>
              {pssAssignment.pssSummary.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="pss-badge">
                      {row.pssLabels.join(", ")}
                    </span>
                  </td>
                  <td>
                    {row.areaNumbers.map((a) => (
                      <span key={a} className="area-number-badge">{a}</span>
                    ))}
                  </td>
                  <td>
                    <div className="pss-categories-list">
                      {row.groups.map((g) => (
                        <span key={g.id} className="pss-category-tag">{g.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="pss-match-count">{row.matchEstimate}</td>
                  <td className="pss-match-count">{row.matchesPerArea}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions globales */}
      <div className="global-actions">
        <div className="global-k-section">
          <label className="global-k-label">
            Combats par personne (toutes categories) :
          </label>
          <div className="k-selector">
            {[2, 3, 4].map((kOption) => (
              <button
                key={kOption}
                type="button"
                className={`k-btn ${globalK === kOption ? "active" : ""}`}
                onClick={() => applyGlobalK(kOption)}
              >
                K = {kOption}
              </button>
            ))}
          </div>
        </div>

        <div className="global-buttons">
          <button
            type="button"
            className="add-participant-btn bulk-btn"
            onClick={() => handleAddParticipant(null)}
          >
            + Ajouter un athlete
          </button>
          <button
            type="button"
            className="draw-btn bulk-btn"
            onClick={handleBulkDraw}
            disabled={bulkDrawing || countNeedDraw() === 0}
          >
            {bulkDrawing
              ? "Tirage en cours..."
              : `Tirer toutes les categories (${countNeedDraw()})`}
          </button>
          <button
            type="button"
            className="validate-draw-btn bulk-btn"
            onClick={handleBulkValidate}
            disabled={bulkValidating || countReadyToValidate() === 0}
          >
            {bulkValidating
              ? "Validation en cours..."
              : `Valider tous les tirages (${countReadyToValidate()})`}
          </button>
          <button
            type="button"
            className="bulk-btn"
            onClick={() => setShowAreaPanel(true)}
            disabled={!allValidated()}
            title="Glisser-déposer les catégories sur les aires de votre choix"
          >
            Affecter les aires manuellement
          </button>
        </div>

        <div className="global-progress">
          <span className="progress-text">
            {Object.keys(validated).length} / {categories.length} categories validees
          </span>
          {allValidated() && (
            <span className="all-validated-badge">Tout est pret !</span>
          )}
        </div>
      </div>

      {/* Résumé des catégories */}
      <details className="categories-summary" open>
        <summary className="categories-summary-title">
          Résumé : {categories.length} catégories ·{" "}
          {categories.reduce((acc, g) => acc + getFighterIds(g).length, 0)}{" "}
          combattants
        </summary>
        <table className="categories-summary-table">
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Combattants</th>
            </tr>
          </thead>
          <tbody>
            {[...categories]
              .sort((a, b) => {
                const genderOrder = { male: 0, female: 1 };
                const ga = genderOrder[a.gender] ?? 2;
                const gb = genderOrder[b.gender] ?? 2;
                if (ga !== gb) return ga - gb;
                const ageA = (a.ageCategoryName || "").localeCompare(
                  b.ageCategoryName || ""
                );
                if (ageA !== 0) return ageA;
                return (a.weightCategoryName || "").localeCompare(
                  b.weightCategoryName || ""
                );
              })
              .map((group) => {
                const n = getFighterIds(group).length;
                return (
                  <tr key={group.id} className={n < 3 ? "low-count" : ""}>
                    <td>{getCategoryName(group)}</td>
                    <td className="summary-count">{n}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </details>

      <div className="categories-list">
        {categories.map((group) => {
          const fighters = getFighters(group);
          const fighterIds = getFighterIds(group);
          const n = fighterIds.length;
          const k = selectedK[group.id] || 3;
          const validation = getValidationInfo(group, k);
          const isOdd = n % 2 !== 0;
          const hasDraw = !!drawResults[group.id];
          const isValidated = !!validated[group.id];
          const isValidating = !!validating[group.id];
          const groupPss = getPssForGroup(group);
          const groupAllowedAreas = getAllowedAreas(group.id);

          return (
            <div
              key={group.id}
              className={`category-card ${isValidated ? "validated" : ""}`}
            >
              <div className="category-header">
                <div className="category-title-row">
                  <h3 className="category-title">{getCategoryName(group)}</h3>
                  <button
                    type="button"
                    className="add-participant-category-btn"
                    onClick={() => handleAddParticipant(group.id)}
                    title="Ajouter un athlete a cette categorie"
                  >
                    +
                  </button>
                </div>
                <div className="category-info">
                  <span className="fighters-count">
                    {n} combattant{n > 1 ? "s" : ""}
                  </span>
                  <span className={`parity-badge ${isOdd ? "odd" : "even"}`}>
                    {isOdd ? "Impair" : "Pair"}
                  </span>
                  {groupPss && (
                    <span className="pss-badge">PSS: {groupPss}</span>
                  )}
                  {areaMode === "pss" && groupAllowedAreas && (
                    <span className="pss-area-info">
                      Aire{groupAllowedAreas.length > 1 ? "s" : ""}: {groupAllowedAreas.join(", ")}
                    </span>
                  )}
                  {isValidated && (
                    <span className="validated-badge">Valide</span>
                  )}
                </div>
              </div>

              {/* Fighters table */}
              {fighters.length > 0 && (
                <table className="fighters-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nom</th>
                      <th>Club</th>
                      <th>Ligue</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fighters.map((fighter, idx) => (
                      <tr key={fighter.id || idx}>
                        <td>{idx + 1}</td>
                        <td>
                          {fighter.nom} {fighter.prenom}
                        </td>
                        <td>{fighter.club || "-"}</td>
                        <td>{fighter.ligue || "-"}</td>
                        <td className="actions-col">
                          <button
                            type="button"
                            className="action-btn edit-btn"
                            onClick={() => handleEditParticipant(fighter, group.id)}
                            title="Modifier"
                          >
                            &#9998;
                          </button>
                          <button
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteParticipant(fighter, group.id)}
                            title="Supprimer"
                          >
                            &#10005;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {fighters.length > 0 && fighters.length < 2 && (
                <p className="warning-message">
                  Moins de 2 combattants — tirage impossible.
                </p>
              )}

              {/* K selector */}
              {!isValidated && (
                <div className="k-selector-section">
                  <label className="k-label">
                    Nombre de combats par personne :
                  </label>
                  <div className="k-selector">
                    {[2, 3, 4].map((kOption) => {
                      const kValid = isKValid(group, kOption);
                      const isSelected = k === kOption;
                      return (
                        <button
                          key={kOption}
                          type="button"
                          className={`k-btn ${isSelected ? "active" : ""} ${
                            !kValid ? "disabled" : ""
                          }`}
                          disabled={!kValid}
                          onClick={() => handleSelectK(group.id, kOption)}
                        >
                          K = {kOption}
                        </button>
                      );
                    })}
                  </div>

                  {/* Validation error for selected K */}
                  {!validation.valid && (
                    <p className="error-message">
                      {validation.reason ||
                        "Combinaison impossible pour ce nombre de combattants."}
                      {validation.alternatives &&
                        validation.alternatives.length > 0 && (
                          <span>
                            {" "}
                            Alternatives possibles : K ={" "}
                            {validation.alternatives.join(" ou ")}.
                          </span>
                        )}
                    </p>
                  )}

                  {/* Show total fights if valid */}
                  {validation.valid && (
                    <p className="total-fights-info">
                      Nombre total de combats : <strong>{validation.totalFights}</strong>{" "}
                      ({n} x {k} / 2)
                    </p>
                  )}

                  {/* Draw button */}
                  {validation.valid && !hasDraw && (
                    <button
                      type="button"
                      className="draw-btn"
                      onClick={() => handleDraw(group)}
                    >
                      Effectuer le tirage
                    </button>
                  )}
                </div>
              )}

              {/* Draw results */}
              {hasDraw && (
                <div className="draw-result">
                  <h4>Resultat du tirage</h4>

                  {/* Tours summary */}
                  {drawTours[group.id] && (
                    <div className="tours-summary">
                      <p>
                        <strong>{drawTours[group.id].length}</strong> tour
                        {drawTours[group.id].length > 1 ? "s" : ""} de combats
                      </p>
                    </div>
                  )}

                  {/* Per-fighter opponents */}
                  <div className="draw-summary">
                    {drawResults[group.id].map((entry, idx) => {
                      const fighter = entry.fighter;
                      const opponents = entry.opponents;
                      return (
                        <div key={fighter.id || idx} className="fighter-draw">
                          <span className="fighter-name">
                            {fighter.nom} {fighter.prenom}
                          </span>
                          <span className="vs-label"> vs </span>
                          <span className="opponents-list">
                            {opponents
                              .map((o) => `${o.nom || ""} ${o.prenom || ""}`.trim())
                              .join(", ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Redraw and validate buttons */}
                  {!isValidated && (
                    <div className="draw-actions">
                      <button
                        type="button"
                        className="redraw-btn"
                        onClick={() => handleRedraw(group)}
                      >
                        Refaire le tirage
                      </button>
                      <button
                        type="button"
                        className="validate-draw-btn"
                        onClick={() => handleValidateDraw(group)}
                        disabled={isValidating}
                      >
                        {isValidating
                          ? "Validation en cours..."
                          : "Valider le tirage"}
                      </button>
                    </div>
                  )}

                  {isValidated && (
                    <p className="validated-message">
                      Tirage valide et sauvegarde avec succes.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <div className="navigation-buttons">
        <button type="button" className="prev-btn" onClick={prevStep}>
          Precedent
        </button>
        <button type="button" className="next-btn" onClick={handleNext}>
          Suivant
        </button>
      </div>

      <ParticipantModal
        isOpen={showParticipantModal}
        onClose={() => setShowParticipantModal(false)}
        onSave={handleSaveParticipant}
        participant={editingParticipant}
      />

      {showAreaPanel && (
        <ManualAreaAssignment
          groups={categories}
          numAreas={numAreas}
          onValidate={() => {
            setShowAreaPanel(false);
            alert("Affectation appliquée. Tu peux maintenant aller au planning.");
          }}
          onCancel={() => setShowAreaPanel(false)}
        />
      )}
    </div>
  );
};

export default PoolConfig;
