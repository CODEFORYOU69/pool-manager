import React, { useEffect, useMemo, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { API_URL, applyAreaAssignments } from "../services/dbService";
import {
  getPssForGroup,
  computePssAreaAssignment,
} from "../utils/pssAreaAssignment";
import "../styles/ManualAreaAssignment.css";

/**
 * UI manuelle pour affecter les catégories aux aires.
 *
 * Props :
 *  - groups : groupes avec pools[0].matches (depuis groupsWithDetails)
 *  - numAreas
 *  - onValidate : callback appelé après application réussie
 *  - onCancel : callback pour fermer sans rien faire
 */
const ManualAreaAssignment = ({ groups: groupsProp, numAreas, onValidate, onCancel }) => {
  const { competitionId } = useCompetition();
  const [sortMode, setSortMode] = useState("age"); // "age" | "pss"
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState(groupsProp || []);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Refetch les groupes au montage pour avoir les matchs créés par
  // handleBulkValidate (les props sont stale après la validation).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/competition/${competitionId}/groupsWithDetails`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setGroups(data || []);
      } catch (e) {
        console.warn("Refetch groups échoué:", e);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  // assignments[areaNumber] = Map<groupId, matchId[]>
  // Si un groupId n'apparaît dans aucun assignments[N], il est dans la sidebar.
  const [assignments, setAssignments] = useState(() => {
    const m = new Map();
    for (let i = 1; i <= numAreas; i++) m.set(i, new Map());
    return m;
  });

  const allCategories = useMemo(() => {
    return groups
      .filter((g) => g.pools?.[0]?.matches?.length > 0)
      .map((g) => {
        const matches = g.pools[0].matches;
        return {
          groupId: g.id,
          pss: getPssForGroup(g) || "?",
          gender: g.gender === "male" ? "H" : "F",
          ageCategoryName: g.ageCategoryName,
          weightCategoryName: g.weightCategoryName,
          label: `${g.gender === "male" ? "H" : "F"} ${g.ageCategoryName} ${g.weightCategoryName}`,
          matches: matches.map((m) => m.id),
          totalMatches: matches.length,
        };
      });
  }, [groups]);

  const placedMatchIds = useMemo(() => {
    const s = new Set();
    for (const [, gMap] of assignments) {
      for (const [, ids] of gMap) ids.forEach((id) => s.add(id));
    }
    return s;
  }, [assignments]);

  const totalMatches = useMemo(
    () => allCategories.reduce((s, c) => s + c.totalMatches, 0),
    [allCategories]
  );
  const placedCount = placedMatchIds.size;

  // Catégories disponibles dans la sidebar : celles dont AUCUN match n'est placé
  const sidebarCats = useMemo(() => {
    return allCategories.filter(
      (c) => !c.matches.some((id) => placedMatchIds.has(id))
    );
  }, [allCategories, placedMatchIds]);

  // Catégories partiellement placées (matchs split entre cards et sidebar)
  // Si certains matchs sont placés et d'autres non, on les montre côté sidebar
  // aussi avec un décompte ajusté
  const partialCats = useMemo(() => {
    return allCategories
      .map((c) => {
        const remaining = c.matches.filter((id) => !placedMatchIds.has(id));
        if (remaining.length === 0 || remaining.length === c.totalMatches)
          return null;
        return { ...c, remainingMatches: remaining };
      })
      .filter(Boolean);
  }, [allCategories, placedMatchIds]);

  const sortedSidebar = useMemo(() => {
    const groupedByAge = new Map();
    for (const c of sidebarCats) {
      if (sortMode === "age") {
        const key = c.ageCategoryName;
        if (!groupedByAge.has(key)) groupedByAge.set(key, []);
        groupedByAge.get(key).push(c);
      }
    }
    if (sortMode === "pss") {
      return [...sidebarCats].sort((a, b) => String(a.pss).localeCompare(String(b.pss)));
    }
    return null; // grouped mode
  }, [sidebarCats, sortMode]);

  // ----- DnD handlers -----
  const handleDragCategoryStart = (e, cat, fromAreaNumber = null) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "category",
        groupId: cat.groupId,
        matchIds: fromAreaNumber
          ? assignments.get(fromAreaNumber).get(cat.groupId) || []
          : cat.matches,
        fromAreaNumber,
      })
    );
  };

  const handleDragMatchStart = (e, matchId, groupId, fromAreaNumber) => {
    e.stopPropagation();
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "match",
        matchId,
        groupId,
        fromAreaNumber,
      })
    );
  };

  const handleDropOnArea = (e, targetAreaNumber) => {
    e.preventDefault();
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }

    setAssignments((prev) => {
      const next = new Map(prev);
      for (const [a, m] of next) next.set(a, new Map(m));

      if (payload.type === "category") {
        const matchIds = payload.matchIds || [];
        // Retirer de la source si présente
        if (payload.fromAreaNumber) {
          const srcMap = next.get(payload.fromAreaNumber);
          srcMap.delete(payload.groupId);
        }
        // Retirer aussi de toutes les autres aires au cas où (sécurité)
        for (const [a, m] of next) {
          if (a !== targetAreaNumber) {
            const existing = m.get(payload.groupId);
            if (existing) {
              // Filtrer les ids qu'on ajoute pour ne pas dupliquer
              const filtered = existing.filter(
                (id) => !matchIds.includes(id)
              );
              if (filtered.length === 0) m.delete(payload.groupId);
              else m.set(payload.groupId, filtered);
            }
          }
        }
        // Ajouter sur la cible
        const targetMap = next.get(targetAreaNumber);
        const existing = targetMap.get(payload.groupId) || [];
        const merged = Array.from(new Set([...existing, ...matchIds]));
        targetMap.set(payload.groupId, merged);
      } else if (payload.type === "match") {
        // Retirer de la source
        if (payload.fromAreaNumber) {
          const srcMap = next.get(payload.fromAreaNumber);
          const list = srcMap.get(payload.groupId) || [];
          const filtered = list.filter((id) => id !== payload.matchId);
          if (filtered.length === 0) srcMap.delete(payload.groupId);
          else srcMap.set(payload.groupId, filtered);
        }
        // Ajouter sur la cible
        const targetMap = next.get(targetAreaNumber);
        const existing = targetMap.get(payload.groupId) || [];
        if (!existing.includes(payload.matchId)) {
          targetMap.set(payload.groupId, [...existing, payload.matchId]);
        }
      }
      return next;
    });
  };

  const handleDropOnSidebar = (e) => {
    e.preventDefault();
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (!payload.fromAreaNumber) return; // déjà dans sidebar
    setAssignments((prev) => {
      const next = new Map(prev);
      for (const [a, m] of next) next.set(a, new Map(m));
      const srcMap = next.get(payload.fromAreaNumber);
      if (payload.type === "category") {
        srcMap.delete(payload.groupId);
      } else if (payload.type === "match") {
        const list = srcMap.get(payload.groupId) || [];
        const filtered = list.filter((id) => id !== payload.matchId);
        if (filtered.length === 0) srcMap.delete(payload.groupId);
        else srcMap.set(payload.groupId, filtered);
      }
      return next;
    });
  };

  const removeCategoryFromArea = (areaNumber, groupId) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      for (const [a, m] of next) next.set(a, new Map(m));
      next.get(areaNumber).delete(groupId);
      return next;
    });
  };

  const handlePrefillPss = () => {
    const result = computePssAreaAssignment(groups, numAreas);
    const newAssignments = new Map();
    for (let i = 1; i <= numAreas; i++) newAssignments.set(i, new Map());

    for (const cat of allCategories) {
      const target = result.groupAreaMap?.[cat.groupId];
      const areaNumber = Array.isArray(target) ? target[0] : null;
      if (areaNumber && newAssignments.has(areaNumber)) {
        newAssignments.get(areaNumber).set(cat.groupId, [...cat.matches]);
      }
    }
    setAssignments(newAssignments);
  };

  const handleClearAll = () => {
    if (!window.confirm("Tout vider et reprendre depuis zéro ?")) return;
    const next = new Map();
    for (let i = 1; i <= numAreas; i++) next.set(i, new Map());
    setAssignments(next);
  };

  const handleValidate = async () => {
    if (placedCount < totalMatches) {
      if (
        !window.confirm(
          `${totalMatches - placedCount} combat(s) ne sont pas placés sur une aire. Continuer quand même ? Ils resteront à leur emplacement actuel.`
        )
      ) {
        return;
      }
    }
    setSubmitting(true);
    try {
      const flat = [];
      for (const [areaNumber, gMap] of assignments) {
        for (const [, ids] of gMap) {
          for (const matchId of ids) flat.push({ matchId, areaNumber });
        }
      }
      if (flat.length === 0) {
        alert("Aucune assignation à appliquer. Utilisez 'Pré-remplir auto' ou glissez des catégories.");
        setSubmitting(false);
        return;
      }
      await applyAreaAssignments(competitionId, flat);
      onValidate && onValidate();
    } catch (err) {
      console.error("Erreur applyAreaAssignments:", err);
      alert(`Erreur : ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderSidebarCategory = (cat, isPartial = false) => {
    const matchCount = isPartial ? cat.remainingMatches.length : cat.totalMatches;
    const matchIds = isPartial ? cat.remainingMatches : cat.matches;
    return (
      <div
        key={cat.groupId + (isPartial ? "-partial" : "")}
        className="cat-item"
        draggable
        onDragStart={(e) =>
          handleDragCategoryStart(
            e,
            { ...cat, matches: matchIds },
            null
          )
        }
      >
        <span className="cat-name">{cat.label}</span>
        <span className="cat-meta">
          {matchCount} combat{matchCount > 1 ? "s" : ""} · PSS {cat.pss}
        </span>
      </div>
    );
  };

  return (
    <div className="manual-area-overlay">
      <div className="manual-area-container">
        <header className="manual-area-header">
          <h2>Affectation manuelle des aires</h2>
          <div className="manual-area-counter">
            <strong>{placedCount}</strong> / {totalMatches} combats placés
          </div>
          <div className="manual-area-actions">
            <button type="button" onClick={handlePrefillPss}>
              Pré-remplir auto (PSS)
            </button>
            <button type="button" onClick={handleClearAll}>
              Tout vider
            </button>
            <button type="button" onClick={onCancel} disabled={submitting}>
              Annuler
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleValidate}
              disabled={submitting}
            >
              {submitting ? "Application…" : "Valider l'affectation"}
            </button>
          </div>
        </header>

        <div className="manual-area-body">
          <div className="manual-area-grid">
            {Array.from(assignments.entries()).map(([areaNumber, gMap]) => {
              const totalOnArea = Array.from(gMap.values()).reduce(
                (s, ids) => s + ids.length,
                0
              );
              return (
                <div
                  key={areaNumber}
                  className="area-card"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnArea(e, areaNumber)}
                >
                  <div className="area-card-header">
                    <span className="area-name">Aire {areaNumber}</span>
                    <span className="area-count">
                      {totalOnArea} combat{totalOnArea > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="area-card-body">
                    {gMap.size === 0 ? (
                      <div className="empty-hint">Déposer des catégories ici</div>
                    ) : (
                      Array.from(gMap.entries()).map(([groupId, ids]) => {
                        const cat = allCategories.find(
                          (c) => c.groupId === groupId
                        );
                        if (!cat) return null;
                        const isPartial = ids.length !== cat.totalMatches;
                        return (
                          <div
                            key={groupId}
                            className="placed-cat"
                            draggable
                            onDragStart={(e) =>
                              handleDragCategoryStart(e, cat, areaNumber)
                            }
                          >
                            <div className="placed-cat-row">
                              <span className="cat-name">{cat.label}</span>
                              <span className="cat-meta">
                                {ids.length} combat{ids.length > 1 ? "s" : ""} · PSS{" "}
                                {cat.pss}
                                {isPartial && " (partiel)"}
                              </span>
                              <button
                                type="button"
                                className="remove-btn"
                                onClick={() =>
                                  removeCategoryFromArea(areaNumber, groupId)
                                }
                                title="Retirer cette catégorie"
                              >
                                ×
                              </button>
                            </div>
                            {isPartial && (
                              <ul className="match-list">
                                {ids.map((id) => (
                                  <li
                                    key={id}
                                    draggable
                                    onDragStart={(e) =>
                                      handleDragMatchStart(
                                        e,
                                        id,
                                        groupId,
                                        areaNumber
                                      )
                                    }
                                  >
                                    Combat (id court : {id.slice(0, 6)})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <aside
            className="manual-area-sidebar"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnSidebar}
          >
            <div className="sidebar-header">
              <h3>Catégories à placer</h3>
              <div className="sort-toggle">
                <button
                  type="button"
                  className={sortMode === "age" ? "active" : ""}
                  onClick={() => setSortMode("age")}
                >
                  Par âge
                </button>
                <button
                  type="button"
                  className={sortMode === "pss" ? "active" : ""}
                  onClick={() => setSortMode("pss")}
                >
                  Par PSS
                </button>
              </div>
            </div>

            {loadingGroups ? (
              <div className="empty-hint">Chargement…</div>
            ) : sidebarCats.length === 0 && partialCats.length === 0 ? (
              <div className="empty-hint">Toutes les catégories sont placées.</div>
            ) : sortMode === "age" ? (
              <>
                {Array.from(
                  sidebarCats.reduce((m, c) => {
                    if (!m.has(c.ageCategoryName)) m.set(c.ageCategoryName, []);
                    m.get(c.ageCategoryName).push(c);
                    return m;
                  }, new Map())
                ).map(([ageName, cats]) => (
                  <details key={ageName} open>
                    <summary>
                      {ageName} ({cats.length})
                    </summary>
                    {cats.map((c) => renderSidebarCategory(c))}
                  </details>
                ))}
                {partialCats.length > 0 && (
                  <details open>
                    <summary>Combats restants ({partialCats.length})</summary>
                    {partialCats.map((c) => renderSidebarCategory(c, true))}
                  </details>
                )}
              </>
            ) : (
              <>
                {sortedSidebar?.map((c) => renderSidebarCategory(c))}
                {partialCats.map((c) => renderSidebarCategory(c, true))}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ManualAreaAssignment;
