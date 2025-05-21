import React, { useEffect, useState } from "react";
import "../styles/PhaseEditor.css";
import { createDefaultPhases, validatePhases } from "../utils/phaseManager";

const PhaseEditor = ({ groups, tournamentConfig, onPhasesChange }) => {
  const [phases, setPhases] = useState([]);
  const [error, setError] = useState(null);
  const [unusedGroups, setUnusedGroups] = useState([]);
  const [numAreas, setNumAreas] = useState(1);
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false);

  useEffect(() => {
    if (groups && groups.length > 0 && tournamentConfig) {
      let areasCount = 1;

      if (
        typeof tournamentConfig.numAreas === "number" &&
        tournamentConfig.numAreas > 0
      ) {
        areasCount = tournamentConfig.numAreas;
        console.log("Nombre d'aires détecté directement (number):", areasCount);
      } else if (tournamentConfig.numAreas) {
        const parsedValue = parseInt(tournamentConfig.numAreas, 10);
        if (!isNaN(parsedValue) && parsedValue > 0) {
          areasCount = parsedValue;
        }
        console.log(
          "Nombre d'aires détecté après conversion de string:",
          areasCount
        );
      }

      if (
        tournamentConfig.scheduleStats &&
        tournamentConfig.scheduleStats.totalAreas
      ) {
        const statsAreas = parseInt(
          tournamentConfig.scheduleStats.totalAreas,
          10
        );
        if (!isNaN(statsAreas) && statsAreas > 0) {
          areasCount = statsAreas;
          console.log(
            "Nombre d'aires récupéré depuis scheduleStats:",
            areasCount
          );
        }
      }

      console.log("----- INITIALISATION DU PHASE EDITOR -----");
      console.log("Configuration du tournoi:", tournamentConfig);
      console.log("Type de numAreas:", typeof tournamentConfig.numAreas);
      console.log("Valeur brute de numAreas:", tournamentConfig.numAreas);
      console.log("Nombre d'aires final:", areasCount);

      if (
        areasCount === 1 &&
        typeof tournamentConfig.numAreas === "string" &&
        tournamentConfig.numAreas.includes("6")
      ) {
        console.log(
          "Correction du nombre d'aires: forcé à 6 car la valeur '6' a été détectée"
        );
        areasCount = 6;
      }

      if (!manuallyAdjusted && areasCount !== numAreas) {
        setNumAreas(areasCount);
      }

      const defaultPhases = createDefaultPhases(groups, {
        ...tournamentConfig,
        numAreas: manuallyAdjusted ? numAreas : areasCount,
      });
      setPhases(defaultPhases);
      onPhasesChange(defaultPhases);
    }
  }, [
    groups,
    tournamentConfig?.numAreas,
    onPhasesChange,
    manuallyAdjusted,
    numAreas,
  ]);

  useEffect(() => {
    if (tournamentConfig?.scheduleStats?.totalAreas) {
      const statsAreas = parseInt(
        tournamentConfig.scheduleStats.totalAreas,
        10
      );

      if (
        !isNaN(statsAreas) &&
        statsAreas > 0 &&
        statsAreas !== numAreas &&
        !manuallyAdjusted
      ) {
        console.log(
          "Mise à jour du nombre d'aires depuis scheduleStats:",
          statsAreas
        );
        setNumAreas(statsAreas);
      }
    }
  }, [tournamentConfig?.scheduleStats?.totalAreas, manuallyAdjusted, numAreas]);

  useEffect(() => {
    if (!groups || !phases) return;

    // Recueillir tous les groupes déjà utilisés
    const usedGroupIds = new Set();
    phases.forEach((phase) => {
      phase.groups.forEach((group) => {
        usedGroupIds.add(group.groupId);
      });
    });

    const notUsed = groups.filter((group) => !usedGroupIds.has(group.id));
    setUnusedGroups(notUsed);
  }, [groups, phases]);

  const handleAddPhase = () => {
    setPhases([...phases, { groups: [] }]);
  };

  const handleRemovePhase = (phaseIndex) => {
    const newPhases = [...phases];
    newPhases.splice(phaseIndex, 1);
    setPhases(newPhases);
    onPhasesChange(newPhases);
  };

  const handleAddGroupToPhase = (phaseIndex) => {
    // Recueillir tous les groupes déjà utilisés dans toutes les phases
    const usedGroupIds = new Set();
    phases.forEach((phase) => {
      phase.groups.forEach((group) => {
        usedGroupIds.add(group.groupId);
      });
    });

    // Trouver les groupes disponibles (non utilisés)
    const availableGroups = groups.filter(
      (group) => !usedGroupIds.has(group.id)
    );

    if (availableGroups.length === 0) {
      setError("Tous les groupes sont déjà utilisés dans les phases");
      return;
    }

    const newPhases = [...phases];
    newPhases[phaseIndex].groups.push({
      groupId: availableGroups[0].id,
      gender: availableGroups[0].gender,
      ageCategory: availableGroups[0].ageCategory?.name,
      weightCategory: availableGroups[0].weightCategory?.name,
      aires: Array.from({ length: Math.min(3, numAreas) }, (_, i) => i + 1),
    });

    setPhases(newPhases);
    onPhasesChange(newPhases);
  };

  const handleRemoveGroupFromPhase = (phaseIndex, groupIndex) => {
    const newPhases = [...phases];
    newPhases[phaseIndex].groups.splice(groupIndex, 1);
    setPhases(newPhases);
    onPhasesChange(newPhases);
  };

  const handleGroupChange = (phaseIndex, groupIndex, groupId) => {
    const newPhases = [...phases];
    const selectedGroup = groups.find((g) => g.id === groupId);

    if (!selectedGroup) return;

    newPhases[phaseIndex].groups[groupIndex] = {
      ...newPhases[phaseIndex].groups[groupIndex],
      groupId,
      gender: selectedGroup.gender,
      ageCategory: selectedGroup.ageCategory?.name,
      weightCategory: selectedGroup.weightCategory?.name,
    };

    setPhases(newPhases);
    onPhasesChange(newPhases);
  };

  const toggleAreaSelection = (phaseIndex, groupIndex, areaNumber) => {
    const newPhases = [...phases];
    const currentAires = newPhases[phaseIndex].groups[groupIndex].aires;

    if (currentAires.includes(areaNumber)) {
      if (currentAires.length > 1) {
        newPhases[phaseIndex].groups[groupIndex].aires = currentAires.filter(
          (aire) => aire !== areaNumber
        );
      } else {
        setError("Chaque groupe doit avoir au moins une aire attribuée");
        return;
      }
    } else {
      newPhases[phaseIndex].groups[groupIndex].aires = [
        ...currentAires,
        areaNumber,
      ].sort((a, b) => a - b);
    }

    const validation = validatePhases(newPhases, numAreas);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setPhases(newPhases);
    onPhasesChange(newPhases);
    setError(null);
  };

  const selectAllAreas = (phaseIndex, groupIndex) => {
    const newPhases = [...phases];
    newPhases[phaseIndex].groups[groupIndex].aires = Array.from(
      { length: numAreas },
      (_, i) => i + 1
    );

    const validation = validatePhases(newPhases, numAreas);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setPhases(newPhases);
    onPhasesChange(newPhases);
    setError(null);
  };

  const getGroupName = (group) => {
    if (!group) return "Groupe inconnu";

    const foundGroup = groups.find((g) => g.id === group.groupId);
    if (!foundGroup) return `Groupe ${group.groupId}`;

    return `${foundGroup.gender === "male" ? "H" : "F"} ${
      foundGroup.ageCategory?.name || ""
    } ${foundGroup.weightCategory?.name || ""}`;
  };

  const movePhaseUp = (phaseIndex) => {
    if (phaseIndex <= 0) return;

    const newPhases = [...phases];
    const temp = newPhases[phaseIndex];
    newPhases[phaseIndex] = newPhases[phaseIndex - 1];
    newPhases[phaseIndex - 1] = temp;

    setPhases(newPhases);
    onPhasesChange(newPhases);
  };

  const movePhaseDown = (phaseIndex) => {
    if (phaseIndex >= phases.length - 1) return;

    const newPhases = [...phases];
    const temp = newPhases[phaseIndex];
    newPhases[phaseIndex] = newPhases[phaseIndex + 1];
    newPhases[phaseIndex + 1] = temp;

    setPhases(newPhases);
    onPhasesChange(newPhases);
  };

  const resetToDefault = () => {
    const defaultPhases = createDefaultPhases(groups, {
      ...tournamentConfig,
      numAreas,
    });
    setPhases(defaultPhases);
    onPhasesChange(defaultPhases);
    setError(null);
  };

  const renderAreaButtons = (phaseIndex, groupIndex, selectedAires) => {
    const totalAreas = numAreas;
    console.log("Rendu des boutons d'aires. Nombre total d'aires:", totalAreas);

    const areaButtons = [];

    for (let i = 1; i <= totalAreas; i++) {
      const isSelected = selectedAires.includes(i);
      areaButtons.push(
        <button
          key={i}
          className={`area-button ${isSelected ? "selected" : ""}`}
          onClick={() => toggleAreaSelection(phaseIndex, groupIndex, i)}
          title={
            isSelected
              ? "Cliquer pour retirer l'aire"
              : "Cliquer pour ajouter l'aire"
          }
        >
          {i}
        </button>
      );
    }

    return (
      <div className="area-buttons-container">
        {areaButtons}
        <button
          className="select-all-button"
          onClick={() => selectAllAreas(phaseIndex, groupIndex)}
          title="Sélectionner toutes les aires"
        >
          Toutes
        </button>
      </div>
    );
  };

  const handleChangeNumAreas = (newValue) => {
    const value = parseInt(newValue, 10);
    if (!isNaN(value) && value > 0 && value <= 12) {
      setNumAreas(value);
      setManuallyAdjusted(true);
      console.log("Nombre d'aires manuellement modifié à:", value);
    }
  };

  // Cette fonction détermine quels groupes sont disponibles pour ce sélecteur spécifique
  const getAvailableGroupsForSelector = (
    currentPhaseIndex,
    currentGroupIndex
  ) => {
    if (!groups) return [];

    // Recueillir tous les IDs de groupes déjà utilisés dans toutes les phases
    const usedGroupIds = new Set();

    phases.forEach((phase, phaseIdx) => {
      phase.groups.forEach((group, groupIdx) => {
        // Ne pas compter le groupe actuel comme utilisé
        if (phaseIdx === currentPhaseIndex && groupIdx === currentGroupIndex) {
          return;
        }
        usedGroupIds.add(group.groupId);
      });
    });

    // Retourner tous les groupes qui ne sont pas déjà utilisés
    // ou celui actuellement sélectionné
    return groups.filter(
      (group) =>
        !usedGroupIds.has(group.id) ||
        phases[currentPhaseIndex]?.groups[currentGroupIndex]?.groupId ===
          group.id
    );
  };

  // Cette fonction vérifie s'il reste des groupes non utilisés
  const areThereAvailableGroups = (phaseIndex) => {
    // Recueillir tous les groupes déjà utilisés
    const usedGroupIds = new Set();
    phases.forEach((phase) => {
      phase.groups.forEach((group) => {
        usedGroupIds.add(group.groupId);
      });
    });

    // Vérifier s'il reste des groupes non utilisés
    return groups.some((group) => !usedGroupIds.has(group.id));
  };

  return (
    <div className="phase-editor">
      <h3>Configuration des Phases de la Compétition</h3>

      <div className="debug-info">
        <div className="debug-areas-count">
          <strong>Nombre d'aires configurées: {numAreas}</strong>
          {tournamentConfig.numAreas && (
            <div className="source-info">
              Source:{" "}
              {typeof tournamentConfig.numAreas === "number"
                ? "Valeur numérique"
                : "Conversion de chaîne"}
              (Valeur brute: {tournamentConfig.numAreas})
            </div>
          )}
        </div>
        <div className="debug-area-selector">
          <label>Modifier manuellement:</label>
          <select
            value={numAreas}
            onChange={(e) => handleChangeNumAreas(e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>
        {!manuallyAdjusted && (
          <div className="auto-detection-note">
            <i>Le nombre d'aires a été détecté automatiquement</i>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="phases-container">
        {phases.map((phase, phaseIndex) => (
          <div key={phaseIndex} className="phase-card">
            <div className="phase-header">
              <h4>Phase {phaseIndex + 1}</h4>
              <div className="phase-controls">
                <button
                  onClick={() => movePhaseUp(phaseIndex)}
                  disabled={phaseIndex === 0}
                  title="Déplacer vers le haut"
                >
                  ↑
                </button>
                <button
                  onClick={() => movePhaseDown(phaseIndex)}
                  disabled={phaseIndex === phases.length - 1}
                  title="Déplacer vers le bas"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleRemovePhase(phaseIndex)}
                  title="Supprimer la phase"
                  className="delete-phase-btn"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <div className="phase-groups">
              {phase.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="phase-group">
                  <div className="group-header">
                    <h5>Groupe {groupIndex + 1}</h5>
                    <button
                      onClick={() =>
                        handleRemoveGroupFromPhase(phaseIndex, groupIndex)
                      }
                      title="Supprimer le groupe"
                      className="delete-group-btn"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="group-selection">
                    <label>Catégorie:</label>
                    <select
                      value={group.groupId}
                      onChange={(e) =>
                        handleGroupChange(
                          phaseIndex,
                          groupIndex,
                          e.target.value
                        )
                      }
                    >
                      {getAvailableGroupsForSelector(
                        phaseIndex,
                        groupIndex
                      ).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.gender === "male" ? "H" : "F"}{" "}
                          {g.ageCategory?.name || ""}{" "}
                          {g.weightCategory?.name || ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="group-aires">
                    <label>Aires attribuées:</label>
                    {renderAreaButtons(phaseIndex, groupIndex, group.aires)}
                    <div className="aires-help">
                      Cliquez sur les numéros pour sélectionner/désélectionner
                      les aires.
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => handleAddGroupToPhase(phaseIndex)}
                className="add-group-btn"
                disabled={!areThereAvailableGroups(phaseIndex)}
              >
                + Ajouter un groupe à cette phase
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="phase-editor-controls">
        <button onClick={handleAddPhase} className="add-phase-btn">
          + Ajouter une nouvelle phase
        </button>
        <button onClick={resetToDefault} className="reset-btn">
          Réinitialiser à la configuration par défaut
        </button>
      </div>

      {unusedGroups.length > 0 && (
        <div className="unused-groups">
          <h4>Groupes non utilisés dans les phases</h4>
          <ul>
            {unusedGroups.map((group) => (
              <li key={group.id}>
                {group.gender === "male" ? "H" : "F"}{" "}
                {group.ageCategory?.name || ""}{" "}
                {group.weightCategory?.name || ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PhaseEditor;
