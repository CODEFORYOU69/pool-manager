import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { fetchResultsData } from "../services/dbService";
import "../styles/Results.css";
import { calculateResults } from "../utils/resultsCalculator";

const Results = ({
  participants: initialParticipants,
  groups: initialGroups,
  matches: initialMatches,
  results: initialResults,
  tournamentConfig,
  prevStep,
}) => {
  const { competitionId } = useCompetition();
  const [poolResults, setPoolResults] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [participants, setParticipants] = useState(initialParticipants);
  const [groups, setGroups] = useState(initialGroups);
  const [matches, setMatches] = useState(initialMatches);
  const [matchResults, setMatchResults] = useState(initialResults || {});
  const [error, setError] = useState(null);
  const [noCompletedMatches, setNoCompletedMatches] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  // Fonction pour exporter les classements au format CSV
  const exportClassementsCSV = () => {
    setExportingCSV(true);
    try {
      // Créer le contenu du CSV
      let csvContent =
        "Catégorie,Poule,Place,Nom,Prénom,Club,Points,Victoires,Défaites,Rounds+,Rounds-,Points+,Points-,Différence\n";

      // Ajouter les données de chaque poule
      poolResults.forEach((pool) => {
        pool.participants.forEach((participant, index) => {
          const row = [
            pool.groupName.replace(/,/g, " "),
            `Poule ${pool.poolIndex + 1}`,
            index + 1,
            participant.nom.replace(/,/g, " "),
            participant.prenom.replace(/,/g, " "),
            (participant.club || participant.ligue || "-").replace(/,/g, " "),
            participant.points,
            participant.wins,
            participant.matches - participant.wins,
            participant.roundsWon,
            participant.roundsLost,
            participant.pointsGained,
            participant.pointsLost,
            participant.pointsDiff,
          ].join(",");
          csvContent += row + "\n";
        });
      });

      // Créer et télécharger le fichier
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `classements_competition_${new Date()
          .toLocaleDateString()
          .replace(/\//g, "-")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur lors de l'export CSV des classements:", err);
      alert("Erreur lors de la création du fichier CSV.");
    } finally {
      setExportingCSV(false);
    }
  };

  // Fonction pour déterminer les qualifiés selon les règles
  const getQualifiésParGroupe = () => {
    // Regrouper les poules par groupId
    const poulesByGroup = {};
    poolResults.forEach((pool) => {
      if (!poulesByGroup[pool.groupId]) {
        poulesByGroup[pool.groupId] = {
          groupName: pool.groupName,
          pools: [],
        };
      }
      poulesByGroup[pool.groupId].pools.push(pool);
    });

    // Déterminer les qualifiés pour chaque groupe
    const qualifiésParGroupe = {};

    Object.keys(poulesByGroup).forEach((groupId) => {
      const groupData = poulesByGroup[groupId];
      const pools = groupData.pools;
      const qualifiés = [];

      // Trier les poules par index
      pools.sort((a, b) => a.poolIndex - b.poolIndex);

      // Règles de qualification selon le nombre de poules
      if (pools.length === 1) {
        // Une seule poule - prendre les 4 premiers
        qualifiés.push(
          ...pools[0].participants.slice(0, 4).map((p) => ({
            ...p,
            pouleIndex: pools[0].poolIndex,
            place: pools[0].participants.indexOf(p) + 1,
          }))
        );
      } else if (pools.length === 2) {
        // Deux poules - prendre les 2 premiers de chaque poule
        pools.forEach((pool) => {
          qualifiés.push(
            ...pool.participants.slice(0, 2).map((p) => ({
              ...p,
              pouleIndex: pool.poolIndex,
              place: pool.participants.indexOf(p) + 1,
            }))
          );
        });
      } else if (pools.length === 3) {
        // Trois poules - prendre les 2 premiers de chaque poule
        pools.forEach((pool) => {
          qualifiés.push(
            ...pool.participants.slice(0, 2).map((p) => ({
              ...p,
              pouleIndex: pool.poolIndex,
              place: pool.participants.indexOf(p) + 1,
            }))
          );
        });
      } else if (pools.length > 3) {
        // Plus de 3 poules - prendre le 1er des poules de 3 et les 2 premiers des poules de 4+
        pools.forEach((pool) => {
          // Vérifier le nombre de participants dans la poule
          const nbToTake = pool.participants.length <= 3 ? 1 : 2;
          qualifiés.push(
            ...pool.participants.slice(0, nbToTake).map((p) => ({
              ...p,
              pouleIndex: pool.poolIndex,
              place: pool.participants.indexOf(p) + 1,
            }))
          );
        });
      }

      qualifiésParGroupe[groupId] = {
        groupName: groupData.groupName,
        qualifiés: qualifiés,
      };
    });

    return qualifiésParGroupe;
  };

  // Fonction pour exporter les qualifiés au format CSV
  const exportQualifiésCSV = () => {
    setExportingCSV(true);
    try {
      const qualifiésParGroupe = getQualifiésParGroupe();

      // Créer le contenu du CSV
      let csvContent =
        "Catégorie,Poule,Place,Nom,Prénom,Club,Points,Victoires,Défaites,Rounds+,Rounds-,Points+,Points-,Différence\n";

      // Ajouter les données des qualifiés
      Object.values(qualifiésParGroupe).forEach((groupe) => {
        groupe.qualifiés.forEach((qualifié) => {
          const row = [
            groupe.groupName.replace(/,/g, " "),
            `Poule ${qualifié.pouleIndex + 1}`,
            qualifié.place,
            qualifié.nom.replace(/,/g, " "),
            qualifié.prenom.replace(/,/g, " "),
            (qualifié.club || qualifié.ligue || "-").replace(/,/g, " "),
            qualifié.points,
            qualifié.wins,
            qualifié.matches - qualifié.wins,
            qualifié.roundsWon || 0,
            qualifié.roundsLost || 0,
            qualifié.pointsGained || 0,
            qualifié.pointsLost || 0,
            qualifié.pointsDiff || 0,
          ].join(",");
          csvContent += row + "\n";
        });
      });

      // Créer et télécharger le fichier
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `qualifiés_competition_${new Date()
          .toLocaleDateString()
          .replace(/\//g, "-")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur lors de l'export CSV des qualifiés:", err);
      alert("Erreur lors de la création du fichier CSV.");
    } finally {
      setExportingCSV(false);
    }
  };

  useEffect(() => {
    if (competitionId) {
      fetchData();
    }
  }, [competitionId]);

  const fetchData = async () => {
    setIsLoading(true);
    setRefreshing(true);
    setError(null);
    setNoCompletedMatches(false);

    try {
      console.log("Récupération des données depuis le serveur...");
      const data = await fetchResultsData(competitionId);

      console.log("Données récupérées:", {
        participants: data.participants.length,
        groups: data.groups.length,
        matches: data.matches.length,
        matchResults: Object.keys(data.matchResults).length,
      });

      // Compter les matchs complétés
      const completedMatchCount = data.matches.filter(
        (m) => m.status === "completed"
      ).length;
      console.log(`Matchs complétés: ${completedMatchCount}`);

      if (completedMatchCount === 0) {
        setNoCompletedMatches(true);
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      // Utiliser les nouvelles données récupérées
      setParticipants(data.participants);
      setGroups(data.groups);
      setMatches(data.matches);
      setMatchResults(data.matchResults);

      // Calculer les résultats
      calculateAndSetResults(
        data.participants,
        data.groups,
        data.matches,
        data.matchResults
      );
    } catch (err) {
      console.error("Erreur lors de la récupération des données:", err);
      setError(err.toString());
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAndSetResults = (
    participants,
    groups,
    matches,
    matchResults
  ) => {
    try {
      console.log("Calcul des résultats...");

      // Vérification des structures des données
      console.log("Détails des données reçues:");
      console.log(
        "Participants:",
        participants?.length,
        participants ? typeof participants[0] : "N/A"
      );
      console.log("Groups:", groups?.length, groups ? typeof groups[0] : "N/A");
      if (groups && groups.length > 0) {
        const firstGroup = groups[0];
        console.log("Premier groupe:", {
          id: firstGroup.id,
          pools: firstGroup.pools ? firstGroup.pools.length : "N/A",
          poolsType: firstGroup.pools ? typeof firstGroup.pools : "N/A",
          isArray: firstGroup.pools ? Array.isArray(firstGroup.pools) : false,
        });

        if (firstGroup.pools && firstGroup.pools.length > 0) {
          const firstPool = firstGroup.pools[0];
          console.log("Première poule:", {
            id: firstPool.id,
            poolIndex: firstPool.poolIndex,
            poolParticipants: firstPool.poolParticipants
              ? firstPool.poolParticipants.length
              : "N/A",
          });
        }
      }
      console.log(
        "matchResults type:",
        typeof matchResults,
        "keys:",
        Object.keys(matchResults || {}).length
      );

      const results = calculateResults(
        participants,
        groups,
        matches,
        matchResults
      );
      console.log("Résultats calculés:", results);

      if (results.length === 0) {
        setNoCompletedMatches(true);
      } else {
        setPoolResults(results);

        // Sélectionner le premier groupe par défaut s'il existe et si aucun groupe n'est déjà sélectionné
        if (results.length > 0 && !selectedGroup) {
          setSelectedGroup(results[0].groupId);
        }
      }
    } catch (err) {
      console.error("Erreur lors du calcul des résultats:", err);
      setError(`Erreur lors du calcul des résultats: ${err.message}`);
    }
  };

  const handleGroupSelect = (groupId) => {
    setSelectedGroup(groupId);
  };

  const handleRefresh = () => {
    fetchData();
  };

  // Générer la liste des groupes uniques à partir des résultats
  const uniqueGroups = [...new Set(poolResults.map((pr) => pr.groupId))].map(
    (groupId) => {
      const group = poolResults.find((pr) => pr.groupId === groupId);
      return {
        id: groupId,
        name: group ? group.groupName : `Groupe ${groupId}`,
      };
    }
  );

  // Filtrer les poules du groupe sélectionné
  const selectedGroupPools = poolResults.filter(
    (pr) => pr.groupId === selectedGroup
  );

  // Tri par index de poule
  selectedGroupPools.sort((a, b) => a.poolIndex - b.poolIndex);

  if (isLoading) {
    return (
      <div className="loading">
        <p>Chargement des résultats...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <h3>Erreur lors du chargement des résultats</h3>
        <p>{error}</p>
        <button className="refresh-btn" onClick={handleRefresh}>
          Réessayer
        </button>
      </div>
    );
  }

  if (noCompletedMatches) {
    return (
      <div className="no-data-message">
        <h3>Aucun match complété</h3>
        <p>
          Il n'y a pas encore de matchs complétés pour calculer les résultats.
          Veuillez terminer au moins un match dans l'onglet "Saisie des scores".
        </p>
        <button className="refresh-btn" onClick={handleRefresh}>
          Rafraîchir
        </button>
      </div>
    );
  }

  return (
    <div className="results-container">
      <h2>Résultats par poules</h2>

      <div className="actions-container">
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Rafraîchissement..." : "Rafraîchir les résultats"}
        </button>

        <div className="export-buttons">
          <button
            className="export-btn"
            onClick={exportClassementsCSV}
            disabled={
              exportingCSV || noCompletedMatches || poolResults.length === 0
            }
          >
            {exportingCSV ? "Exportation..." : "Exporter les classements (CSV)"}
          </button>

          <button
            className="export-btn qualified-btn"
            onClick={exportQualifiésCSV}
            disabled={
              exportingCSV || noCompletedMatches || poolResults.length === 0
            }
          >
            {exportingCSV ? "Exportation..." : "Exporter les qualifiés (CSV)"}
          </button>
        </div>
      </div>

      {uniqueGroups.length > 0 ? (
        <>
          <div className="group-tabs">
            {uniqueGroups.map((group) => (
              <button
                key={group.id}
                className={`group-tab ${
                  selectedGroup === group.id ? "active" : ""
                }`}
                onClick={() => handleGroupSelect(group.id)}
              >
                {group.name}
              </button>
            ))}
          </div>

          <div className="pools-container">
            {selectedGroupPools.map((pool) => (
              <div className="pool-results" key={pool.poolId}>
                <h3>Poule {pool.poolIndex + 1}</h3>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Place</th>
                      <th>Athlète</th>
                      <th>Club</th>
                      <th>Points</th>
                      <th>V</th>
                      <th>D</th>
                      <th>R+</th>
                      <th>R-</th>
                      <th>P+</th>
                      <th>P-</th>
                      <th>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.participants.map((participant, index) => (
                      <tr key={participant.participantId}>
                        <td>{index + 1}</td>
                        <td>
                          {participant.prenom} {participant.nom}
                        </td>
                        <td>{participant.club || participant.ligue || "-"}</td>
                        <td className="points">{participant.points}</td>
                        <td>{participant.wins}</td>
                        <td>{participant.matches - participant.wins}</td>
                        <td>{participant.roundsWon}</td>
                        <td>{participant.roundsLost}</td>
                        <td>{participant.pointsGained}</td>
                        <td>{participant.pointsLost}</td>
                        <td
                          className={`diff ${
                            participant.pointsDiff >= 0
                              ? "positive"
                              : "negative"
                          }`}
                        >
                          {participant.pointsDiff >= 0 ? "+" : ""}
                          {participant.pointsDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="no-data-message">
          <p>
            Aucun résultat disponible. Veuillez d'abord saisir les scores des
            matchs.
          </p>
          <button className="refresh-btn" onClick={handleRefresh}>
            Vérifier à nouveau
          </button>
        </div>
      )}
    </div>
  );
};

export default Results;
