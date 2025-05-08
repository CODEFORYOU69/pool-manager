import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  checkExistingGroupsAndPools,
  fetchFormattedGroupsAndPools,
  saveGroupsAndPools,
} from "../services/dbService";
import "../styles/GroupsDisplay.css";
import { createGroups } from "../utils/groupManager";

const GroupDisplay = ({
  participants,
  tournamentConfig,
  setGroups,
  nextStep,
  prevStep,
}) => {
  const { competitionId } = useCompetition();
  const [generatedGroups, setGeneratedGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupStats, setGroupStats] = useState({
    totalGroups: 0,
    totalPools: 0,
    totalParticipants: participants.length,
    unusedParticipants: 0,
  });
  const [savingGroups, setSavingGroups] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dataSource, setDataSource] = useState(""); // 'new' ou 'existing'

  useEffect(() => {
    if (participants.length > 0 && tournamentConfig && competitionId) {
      loadOrGenerateGroups();
    }
  }, [participants, tournamentConfig, competitionId]);

  // Nouvelle fonction pour vérifier l'existence des groupes et charger ou générer selon le cas
  const loadOrGenerateGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Vérifier si des groupes existent déjà pour cette compétition
      const existingGroupsResult = await checkExistingGroupsAndPools(
        competitionId
      );

      if (existingGroupsResult.exists && existingGroupsResult.count > 0) {
        console.log(
          `${existingGroupsResult.count} groupes existants trouvés, chargement des données...`
        );
        setDataSource("existing");

        // Charger les groupes existants
        await loadExistingGroups();
      } else {
        console.log(
          "Aucun groupe existant trouvé, génération de nouveaux groupes..."
        );
        setDataSource("new");

        // Générer de nouveaux groupes
        generateNewGroups();
      }
    } catch (error) {
      console.error(
        "Erreur lors de la vérification/chargement des groupes:",
        error
      );
      setError(`Erreur lors du chargement des données: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Nouvelle fonction pour charger les groupes existants
  const loadExistingGroups = async () => {
    try {
      const loadedGroups = await fetchFormattedGroupsAndPools(competitionId);

      console.log(
        `${loadedGroups.length} groupes chargés depuis la base de données`
      );

      // Ajouter du débogage pour examiner la structure des groupes chargés
      if (loadedGroups.length > 0) {
        const firstGroup = loadedGroups[0];
        console.log("Premier groupe chargé:", {
          id: firstGroup.id,
          gender: firstGroup.gender,
          ageCategory: firstGroup.ageCategory,
          weightCategory: firstGroup.weightCategory,
          participantsCount: firstGroup.participants
            ? firstGroup.participants.length
            : 0,
          poolsCount: firstGroup.pools ? firstGroup.pools.length : 0,
        });

        // Vérifier la structure des participants dans le groupe
        if (firstGroup.participants && firstGroup.participants.length > 0) {
          console.log(
            "Premier participant dans le groupe:",
            firstGroup.participants[0]
          );
        }

        // Vérifier la structure des poules
        if (firstGroup.pools && firstGroup.pools.length > 0) {
          console.log("Première poule du groupe:", firstGroup.pools[0]);

          // Vérifier les IDs dans la poule
          const poolParticipantIds = firstGroup.pools[0];
          console.log(
            "IDs des participants dans la première poule:",
            poolParticipantIds
          );

          // Vérifier si les IDs correspondent aux participants
          if (firstGroup.participants && firstGroup.participants.length > 0) {
            const foundParticipants = poolParticipantIds.map((id) =>
              firstGroup.participants.find((p) => p.id === id)
            );
            console.log(
              "Participants trouvés dans la poule:",
              foundParticipants.filter(Boolean).length
            );
            console.log(
              "Participants non trouvés dans la poule:",
              foundParticipants.filter((p) => !p).length
            );
          }
        }
      }

      // Charger les informations complètes des participants si elles manquent
      // Pour chaque groupe, pour chaque poule, s'assurer que les participants dans le groupe sont complets
      const groupsWithCompletedParticipants = await Promise.all(
        loadedGroups.map(async (group) => {
          // S'assurer que le groupe a des participants et qu'ils ont des informations complètes
          if (!group.participants || group.participants.length === 0) {
            console.log(
              `Groupe ${group.id} n'a pas de participants ou participants incomplets, tentative de récupération`
            );

            // Collecter tous les IDs de participants dans les poules de ce groupe
            const participantIdsInPools = new Set();
            if (group.pools) {
              group.pools.forEach((pool) => {
                pool.forEach((participantId) => {
                  participantIdsInPools.add(participantId);
                });
              });
            }

            // Si le groupe a des participants incomplets, tenter de les compléter
            if (participantIdsInPools.size > 0) {
              console.log(
                `Tentative de récupération des informations pour ${participantIdsInPools.size} participants du groupe ${group.id}`
              );

              // Si certains IDs ne sont pas dans les participants du groupe, les récupérer
              const participantsToFetch = [...participantIdsInPools].filter(
                (id) =>
                  !group.participants ||
                  !group.participants.some((p) => p.id === id)
              );

              if (participantsToFetch.length > 0) {
                console.log(
                  `${participantsToFetch.length} participants à récupérer pour le groupe ${group.id}`
                );

                // Tenter de trouver les participants manquants dans la liste globale
                const foundInGlobalList = participantsToFetch
                  .map((id) => participants.find((p) => p.id === id))
                  .filter(Boolean);

                console.log(
                  `${foundInGlobalList.length} participants trouvés dans la liste globale`
                );

                // Mettre à jour le groupe avec les participants trouvés
                group.participants = [
                  ...(group.participants || []),
                  ...foundInGlobalList,
                ];
              }
            }
          }

          return group;
        })
      );

      setGeneratedGroups(groupsWithCompletedParticipants);

      // Calculer les statistiques
      let totalPools = 0;
      groupsWithCompletedParticipants.forEach((group) => {
        if (group.pools) {
          totalPools += group.pools.length;
        }
      });

      // Calculer les participants non utilisés
      const usedParticipantIds = new Set();
      groupsWithCompletedParticipants.forEach((group) => {
        group.pools.forEach((pool) => {
          pool.forEach((participantId) => {
            usedParticipantIds.add(participantId);
          });
        });
      });

      const unusedParticipants = participants.length - usedParticipantIds.size;

      setGroupStats({
        totalGroups: groupsWithCompletedParticipants.length,
        totalPools: totalPools,
        totalParticipants: participants.length,
        unusedParticipants: unusedParticipants,
      });

      setError(null);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors du chargement des groupes existants:", error);
      setError(`Erreur lors du chargement des groupes: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Fonction pour générer de nouveaux groupes
  const generateNewGroups = () => {
    try {
      // Générer les groupes à partir des participants et de la configuration
      const { groups, stats } = createGroups(participants, tournamentConfig);
      setGeneratedGroups(groups);
      setGroupStats({
        totalGroups: groups.length,
        totalPools: stats.totalPools,
        totalParticipants: participants.length,
        unusedParticipants: stats.unusedParticipants,
      });
      setError(null);
    } catch (err) {
      setError(`Erreur lors de la génération des groupes: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour continuer vers l'étape suivante
  const handleContinue = () => {
    // Mettre à jour l'état global avec les groupes générés
    setGroups(generatedGroups);
    nextStep();
  };

  // Format du nom d'un groupe
  const formatGroupName = (group) => {
    return `${group.gender === "male" ? "H" : "F"} ${group.ageCategory.name} ${
      group.weightCategory.name
    }`;
  };

  // Fonction pour sauvegarder les groupes
  const handleSaveGroups = async () => {
    setSavingGroups(true);
    try {
      await saveGroupsAndPools(competitionId, generatedGroups);
      setSaveSuccess(true);
      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des groupes:", error);
      alert("Erreur lors de la sauvegarde des groupes. Veuillez réessayer.");
    } finally {
      setSavingGroups(false);
    }
  };

  return (
    <div className="groups-display-container">
      <h2>Étape 3: Répartition des participants en groupes et poules</h2>

      {isLoading ? (
        <div className="loading">
          <p>Chargement des groupes en cours...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="groups-stats">
            <h3>Résumé</h3>
            <p>Nombre total de groupes: {groupStats.totalGroups}</p>
            <p>Nombre total de poules: {groupStats.totalPools}</p>
            <p>
              Participants utilisés:{" "}
              {groupStats.totalParticipants - groupStats.unusedParticipants} sur{" "}
              {groupStats.totalParticipants}
            </p>
            {groupStats.unusedParticipants > 0 && (
              <p className="warning">
                Attention: {groupStats.unusedParticipants} participants n'ont
                pas pu être placés dans des poules.
              </p>
            )}
            {dataSource === "existing" && (
              <p className="info">
                Des groupes existants ont été chargés depuis la base de données.
              </p>
            )}
          </div>

          <div className="action-buttons">
            <button
              className="save-btn"
              onClick={handleSaveGroups}
              disabled={
                isLoading ||
                generatedGroups.length === 0 ||
                savingGroups ||
                dataSource === "existing"
              }
            >
              {savingGroups
                ? "Sauvegarde en cours..."
                : dataSource === "existing"
                ? "Groupes déjà sauvegardés"
                : "Sauvegarder les groupes"}
            </button>

            {dataSource === "existing" && (
              <button
                className="reload-btn"
                onClick={() => loadOrGenerateGroups()}
                disabled={isLoading}
              >
                {isLoading ? "Chargement..." : "Actualiser les données"}
              </button>
            )}

            {saveSuccess && (
              <div className="success-message">
                Les groupes ont été sauvegardés avec succès !
              </div>
            )}
          </div>

          <div className="groups-list">
            <h3>Groupes et poules</h3>

            {generatedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="group-card">
                <h4 className="group-title">{formatGroupName(group)}</h4>
                <p>Nombre de participants: {group.participants.length}</p>
                <p>Nombre de poules: {group.pools.length}</p>

                <div className="pools-container">
                  {group.pools.map((pool, poolIndex) => (
                    <div key={poolIndex} className="pool-card">
                      <h5>Poule {poolIndex + 1}</h5>
                      <table className="participants-table">
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Prénom</th>
                            <th>Ligue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pool.map((participantId, partIndex) => {
                            // Chercher d'abord dans les participants du groupe qui contient des objets complets
                            const participantInGroup =
                              group.participants &&
                              Array.isArray(group.participants)
                                ? group.participants.find(
                                    (p) => p.id === participantId
                                  )
                                : null;

                            // Si non trouvé dans le groupe, chercher dans les participants globaux
                            const participant =
                              participantInGroup ||
                              participants.find((p) => p.id === participantId);

                            if (!participant) {
                              console.log(
                                `Participant avec ID ${participantId} non trouvé`
                              );
                              return (
                                <tr key={partIndex}>
                                  <td colSpan="3">
                                    Participant ID: {participantId} (non trouvé)
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={partIndex}>
                                <td>{participant.nom}</td>
                                <td>{participant.prenom}</td>
                                <td>{participant.ligue}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {generatedGroups.length === 0 && (
              <p className="no-groups">
                Aucun groupe n'a pu être généré avec les paramètres actuels.
              </p>
            )}
          </div>

          {groupStats.unusedParticipants > 0 && (
            <div className="unused-participants">
              <h3>Participants non placés</h3>
              <p>
                Les participants suivants n'ont pas pu être placés dans des
                poules, généralement parce qu'ils ne correspondent à aucune
                catégorie ou qu'il n'y a pas assez de participants dans leur
                catégorie pour former une poule complète.
              </p>

              <table className="participants-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Sexe</th>
                    <th>Âge</th>
                    <th>Poids</th>
                    <th>Ligue</th>
                  </tr>
                </thead>
                <tbody>
                  {participants
                    .filter(
                      (p) =>
                        !generatedGroups.some((group) =>
                          group.pools.some((pool) => pool.includes(p.id))
                        )
                    )
                    .map((participant, index) => (
                      <tr key={index}>
                        <td>{participant.nom}</td>
                        <td>{participant.prenom}</td>
                        <td>{participant.sexe}</td>
                        <td>{participant.age}</td>
                        <td>{participant.poids}</td>
                        <td>{participant.ligue}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={prevStep} disabled={isLoading}>
          Précédent
        </button>
        <button
          className="next-btn"
          onClick={handleContinue}
          disabled={isLoading || generatedGroups.length === 0}
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default GroupDisplay;
