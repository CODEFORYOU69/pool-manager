import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  checkExistingMatches,
  fetchFormattedMatches,
  saveGeneratedMatches,
  saveGroupsAndPools,
} from "../services/dbService";
import "../styles/MatchSchedule.css";
import { generateMatches } from "../utils/matchGenerator";
import { createSchedule } from "../utils/scheduleManager";
// Correction de l'importation pour la génération PDF
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const MatchSchedule = ({
  groups,
  tournamentConfig,
  setMatches,
  setSchedule,
  nextStep,
  prevStep,
}) => {
  const { competitionId, competitionName } = useCompetition();
  const [generatedMatches, setGeneratedMatches] = useState([]);
  const [generatedSchedule, setGeneratedSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleStats, setScheduleStats] = useState({
    totalMatches: 0,
    totalAreas: 0,
    estimatedDuration: 0,
    estimatedEndTime: null,
  });
  const [viewMode, setViewMode] = useState("byGroup"); // 'byGroup' ou 'bySchedule'
  const [exportLoading, setExportLoading] = useState({
    pdf: false,
    csv: false,
  });
  const [dataSource, setDataSource] = useState(""); // 'new' ou 'existing'

  useEffect(() => {
    if (groups && groups.length > 0 && tournamentConfig && competitionId) {
      loadOrGenerateMatchSchedule();
    }
  }, [groups, tournamentConfig, competitionId]);

  // Nouvelle fonction pour vérifier l'existence des matchs et charger ou générer selon le cas
  const loadOrGenerateMatchSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Vérifier si des matchs existent déjà pour cette compétition
      const existingMatchesResult = await checkExistingMatches(competitionId);

      if (existingMatchesResult.exists && existingMatchesResult.count > 0) {
        console.log(
          `${existingMatchesResult.count} matchs existants trouvés, chargement des données...`
        );
        setDataSource("existing");

        // Charger les matchs existants
        await loadExistingMatches();
      } else {
        console.log(
          "Aucun match existant trouvé, génération d'un nouveau planning..."
        );
        setDataSource("new");

        // Générer de nouveaux matchs
        await handleGenerateSchedule();
      }
    } catch (error) {
      console.error(
        "Erreur lors de la vérification/chargement des matchs:",
        error
      );
      setError(`Erreur lors du chargement des données: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Nouvelle fonction pour charger les matchs existants
  const loadExistingMatches = async () => {
    try {
      const { matches: loadedMatches, schedule: loadedSchedule } =
        await fetchFormattedMatches(competitionId);

      console.log(
        `${loadedMatches.length} matchs chargés depuis la base de données`
      );
      console.log(`${loadedSchedule.length} éléments de planning chargés`);

      setGeneratedMatches(loadedMatches);
      setGeneratedSchedule(loadedSchedule);

      // Calculer les statistiques
      const totalDuration = loadedSchedule.reduce((total, item) => {
        if (item.endTime && item.startTime) {
          const start = new Date(item.startTime);
          const end = new Date(item.endTime);
          const durationInMinutes = (end - start) / 60000;
          return total + durationInMinutes;
        }
        return total;
      }, 0);

      const numAreas = tournamentConfig?.numAreas || 1;
      const estimatedDuration = totalDuration / numAreas;

      // Calculer l'heure de fin estimée
      const now = new Date();
      const endTime = new Date(now.getTime() + estimatedDuration * 60000);

      setScheduleStats({
        totalMatches: loadedMatches.length,
        totalAreas: numAreas,
        estimatedDuration: estimatedDuration,
        estimatedEndTime: endTime,
      });

      setError(null);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors du chargement des matchs existants:", error);
      setError(`Erreur lors du chargement des matchs: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Fonction pour générer le planning et les matchs
  const handleGenerateSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Générer tous les combats pour toutes les poules
      const allMatches = generateMatches(groups);
      console.log("Matchs générés:", allMatches.length);

      // Créer le planning des combats
      const { schedule, updatedMatches, stats } = createSchedule(
        allMatches,
        tournamentConfig
      );
      console.log("Planning créé:", schedule.length, "éléments");
      console.log("Statistiques:", stats);

      // Utiliser les matchs mis à jour avec leurs numéros et aires attribués
      const matchesWithSchedule = updatedMatches;
      console.log("Matchs avec planification:", matchesWithSchedule.length);

      // Mettre à jour les matchs avec les numéros et horaires du planning
      const matchesWithNumbers = matchesWithSchedule.map((match) => {
        const scheduledMatch = schedule.find((s) => s.matchId === match.id);
        if (scheduledMatch) {
          return {
            ...match,
            number: scheduledMatch.matchNumber,
            areaNumber: scheduledMatch.areaNumber,
            startTime: scheduledMatch.startTime,
          };
        }
        return match;
      });

      console.log("Matchs avec numéros:", matchesWithNumbers.length);

      // Exemple du premier match avec les informations complètes
      if (matchesWithNumbers.length > 0) {
        console.log("Exemple de match avec numéro:", matchesWithNumbers[0]);
      }

      // S'assurer que les groupes sont sauvegardés avant les matchs
      saveGroupsAndPools(competitionId, groups)
        .then((savedGroupsResult) => {
          console.log("Groupes sauvegardés avec succès:", savedGroupsResult);
          const savedGroups = savedGroupsResult.savedGroups || [];

          // Mettre à jour les IDs des groupes dans les matchs
          const updatedMatches = matchesWithNumbers.map((match) => {
            if (!match.groupId || !Array.isArray(groups)) {
              console.error("Données de match invalides:", match);
              return match;
            }

            const originalGroup = groups.find((g) => g.id === match.groupId);
            if (!originalGroup) {
              console.error("Groupe original non trouvé pour le match:", match);
              return match;
            }

            const savedGroup = savedGroups.find(
              (sg) =>
                sg &&
                sg.gender === originalGroup.gender &&
                sg.ageCategoryName === originalGroup.ageCategory.name &&
                sg.weightCategoryName === originalGroup.weightCategory.name
            );

            if (!savedGroup) {
              console.error(
                "Groupe sauvegardé non trouvé pour le match:",
                match
              );
              return match;
            }

            return {
              ...match,
              groupId: savedGroup.id,
            };
          });

          // Organiser les matchs par poule comme attendu par saveGeneratedMatches
          const matchesByPool = [];

          // Récupérer toutes les poules uniques
          const uniquePools = new Set();
          updatedMatches.forEach((match) => {
            if (match.poolId) {
              uniquePools.add(match.poolId);
            }
          });

          console.log(
            `Organisation des matchs pour ${uniquePools.size} poules uniques`
          );

          // Si nous n'avons pas directement des poolId, utiliser les combinaisons groupId et poolIndex
          if (uniquePools.size === 0) {
            // Grouper par combinaison groupId + poolIndex
            const poolMap = new Map();
            updatedMatches.forEach((match) => {
              const key = `${match.groupId}-${match.poolIndex}`;
              if (!poolMap.has(key)) {
                poolMap.set(key, []);
              }
              poolMap.get(key).push(match);
            });

            console.log(
              `Organisé ${poolMap.size} groupes de matchs par groupe/index de poule`
            );

            // Pour chaque savedGroup, trouver ses poules et les ajouter à matchesByPool
            savedGroups.forEach((group) => {
              const groupPools = group.poolIds || [];
              groupPools.forEach((poolId, index) => {
                const matches = poolMap.get(`${group.id}-${index}`);
                if (matches && matches.length > 0) {
                  matchesByPool.push({
                    poolId: poolId,
                    matches: matches,
                  });
                  console.log(
                    `Ajout de ${matches.length} matchs pour la poule ${poolId} (groupe ${group.id}, index ${index})`
                  );
                }
              });
            });
          } else {
            // Si nous avons des poolId, nous pouvons les utiliser directement
            uniquePools.forEach((poolId) => {
              const poolMatches = updatedMatches.filter(
                (match) => match.poolId === poolId
              );
              if (poolMatches.length > 0) {
                matchesByPool.push({
                  poolId: poolId,
                  matches: poolMatches,
                });
                console.log(
                  `Ajout de ${poolMatches.length} matchs pour la poule ${poolId}`
                );
              }
            });
          }

          // Vérifier si nous avons des matchs à sauvegarder
          if (matchesByPool.length === 0) {
            throw new Error(
              "Impossible d'organiser les matchs par poule. Vérifiez que les poules ont été correctement sauvegardées."
            );
          }

          console.log(
            `Envoi de ${matchesByPool.length} poules avec leurs matchs pour sauvegarde`
          );

          // Vérifier le contenu du premier groupe de matchs
          if (matchesByPool.length > 0 && matchesByPool[0].matches.length > 0) {
            console.log("Exemple de match à sauvegarder:", {
              poolId: matchesByPool[0].poolId,
              matchExample: matchesByPool[0].matches[0],
            });
          }

          // Sauvegarder les matchs avec le format attendu
          return saveGeneratedMatches(competitionId, matchesByPool);
        })
        .then((savedMatches) => {
          console.log("Tous les matchs ont été sauvegardés:", savedMatches);
          setGeneratedMatches(matchesWithSchedule);
          setGeneratedSchedule(schedule);

          // Calculer l'heure de fin estimée
          const now = new Date();
          const endTime = new Date(now.getTime() + stats.totalDuration * 60000);

          setScheduleStats({
            totalMatches: matchesWithSchedule.length,
            totalAreas: tournamentConfig.numAreas,
            estimatedDuration: stats.totalDuration,
            estimatedEndTime: endTime,
          });

          setError(null);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Erreur lors de la sauvegarde:", error);
          setError(`Erreur lors de la sauvegarde: ${error.message}`);
          setIsLoading(false);
        });
    } catch (err) {
      setError(`Erreur lors de la génération du planning: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Fonction pour continuer vers l'étape suivante
  const handleContinue = () => {
    // Mettre à jour l'état global avec les matchs et le planning
    setMatches(generatedMatches);
    setSchedule(generatedSchedule);
    nextStep();
  };

  // Formatage de la durée en heures et minutes
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };

  // Formatage de l'heure
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Formatage de la date
  const formatDate = (date) => {
    return date.toLocaleDateString();
  };

  // Obtenir le nom du participant
  const getParticipantName = (matchInfo, position) => {
    if (
      !matchInfo ||
      !matchInfo.participants ||
      !matchInfo.participants[position]
    ) {
      return "Inconnu";
    }

    const participant = matchInfo.participants[position];
    return `${participant.prenom} ${participant.nom}`;
  };

  // Obtenir la ligue du participant
  const getParticipantLigue = (matchInfo, position) => {
    if (
      !matchInfo ||
      !matchInfo.participants ||
      !matchInfo.participants[position]
    ) {
      return "-";
    }

    const participant = matchInfo.participants[position];
    return participant.ligue || "-";
  };

  // Génération du fichier PDF
  const handleGeneratePDF = () => {
    try {
      setExportLoading({ ...exportLoading, pdf: true });

      // Créer un nouveau document PDF - correction de l'instanciation
      const doc = new jsPDF("landscape");
      const title = `Planning des combats - ${
        competitionName || "Compétition"
      } - ${formatDate(new Date())}`;

      // Ajouter un titre
      doc.setFontSize(18);
      doc.text(title, 15, 15);

      // Ajouter les informations générales
      doc.setFontSize(12);
      doc.text(`Total des combats: ${scheduleStats.totalMatches}`, 15, 25);
      doc.text(`Nombre d'aires: ${scheduleStats.totalAreas}`, 15, 30);
      doc.text(
        `Durée estimée: ${formatDuration(scheduleStats.estimatedDuration)}`,
        15,
        35
      );
      doc.text(
        `Heure de fin estimée: ${formatTime(scheduleStats.estimatedEndTime)}`,
        15,
        40
      );

      // Préparer les données au format adapté pour autoTable
      let tableData = [];

      // Si nous sommes en vue par groupe
      if (viewMode === "byGroup") {
        groups.forEach((group) => {
          // Ajouter un en-tête de groupe
          tableData.push([
            {
              content: `Groupe: ${
                group.gender === "male" ? "Hommes" : "Femmes"
              } ${group.ageCategory.name} ${group.weightCategory.name}`,
              colSpan: 7,
              styles: { fontStyle: "bold", fillColor: [220, 220, 220] },
            },
          ]);

          group.pools.forEach((pool, poolIndex) => {
            // En-tête de poule
            tableData.push([
              {
                content: `Poule ${poolIndex + 1}`,
                colSpan: 7,
                styles: { fontStyle: "italic", fillColor: [240, 240, 240] },
              },
            ]);

            // En-tête de tableau
            tableData.push([
              "N°",
              "Athlète A",
              "Ligue",
              "Athlète B",
              "Ligue",
              "Aire",
              "Horaire",
            ]);

            // Combats de la poule
            const poolMatches = generatedMatches.filter(
              (match) =>
                match.groupId === group.id && match.poolIndex === poolIndex
            );

            poolMatches.forEach((match) => {
              const scheduledMatch = generatedSchedule.find(
                (s) => s.matchId === match.id
              );
              tableData.push([
                scheduledMatch ? scheduledMatch.matchNumber : "-",
                getParticipantName(match, 0),
                getParticipantLigue(match, 0),
                getParticipantName(match, 1),
                getParticipantLigue(match, 1),
                scheduledMatch ? scheduledMatch.areaNumber : "-",
                scheduledMatch
                  ? formatTime(new Date(scheduledMatch.startTime))
                  : "-",
              ]);
            });

            // Ajouter une ligne vide pour séparer les poules
            tableData.push([{ content: "", colSpan: 7 }]);
          });
        });
      } else {
        // Vue par horaire
        [...Array(tournamentConfig.numAreas)].forEach((_, areaIndex) => {
          const areaNumber = areaIndex + 1;

          // En-tête de l'aire
          tableData.push([
            {
              content: `Aire ${areaNumber}`,
              colSpan: 7,
              styles: { fontStyle: "bold", fillColor: [220, 220, 220] },
            },
          ]);

          // En-tête de tableau
          tableData.push([
            "N°",
            "Horaire",
            "Groupe",
            "Poule",
            "Athlète A",
            "Athlète B",
            "Type",
          ]);

          // Trier les matchs par horaire
          const areaMatches = generatedSchedule
            .filter((scheduleItem) => scheduleItem.areaNumber === areaNumber)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

          areaMatches.forEach((scheduleItem) => {
            const match = generatedMatches.find(
              (m) => m.id === scheduleItem.matchId
            );

            if (!match && scheduleItem.type === "break") {
              tableData.push([
                {
                  content: `Pause (${
                    tournamentConfig.breakDuration
                  } min) - ${formatTime(
                    new Date(scheduleItem.startTime)
                  )} à ${formatTime(new Date(scheduleItem.endTime))}`,
                  colSpan: 7,
                  styles: { fillColor: [255, 240, 240] },
                },
              ]);
              return;
            }

            if (!match) return;

            const group = groups.find((g) => g.id === match.groupId);

            tableData.push([
              scheduleItem.matchNumber,
              formatTime(new Date(scheduleItem.startTime)),
              group
                ? `${group.gender === "male" ? "H" : "F"} ${
                    group.ageCategory.name
                  } ${group.weightCategory.name}`
                : "-",
              match.poolIndex + 1,
              getParticipantName(match, 0),
              getParticipantName(match, 1),
              "Combat",
            ]);
          });

          // Ajouter une ligne vide pour séparer les aires
          tableData.push([{ content: "", colSpan: 7 }]);
        });
      }

      // Ajouter la table au document - correction de l'appel à autoTable
      doc.autoTable({
        head: [], // Nous gérons les en-têtes manuellement dans notre tableau de données
        body: tableData,
        startY: 45,
        margin: { top: 45 },
        styles: { overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: 20 }, // N° combat
          5: { cellWidth: 20 }, // Aire
          6: { cellWidth: 30 }, // Horaire
        },
        didDrawPage: (data) => {
          // En-tête de page
          doc.setFontSize(10);
          doc.text(title, data.settings.margin.left, 10);

          // Pied de page
          doc.setFontSize(8);
          doc.text(
            `Généré le ${new Date().toLocaleString()}`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 10
          );
          doc.text(
            `Page ${
              doc.internal.getCurrentPageInfo().pageNumber
            }/${doc.internal.getNumberOfPages()}`,
            doc.internal.pageSize.width - 40,
            doc.internal.pageSize.height - 10
          );
        },
      });

      // Télécharger le fichier
      doc.save(
        `planning_combats_${
          competitionName ? competitionName.replace(/\s+/g, "_") : "competition"
        }_${formatDate(new Date()).replace(/\//g, "-")}.pdf`
      );

      setExportLoading({ ...exportLoading, pdf: false });
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      setError(`Erreur lors de la génération du PDF: ${error.message}`);
      setExportLoading({ ...exportLoading, pdf: false });
    }
  };

  // Génération du fichier CSV
  const handleGenerateCSV = () => {
    try {
      setExportLoading({ ...exportLoading, csv: true });

      // En-têtes CSV
      let csvContent =
        "Type,Numéro,Groupe,Poule,Aire,Horaire,Athlète A,Ligue A,Athlète B,Ligue B\n";

      // Tableau pour stocker toutes les lignes de données
      const csvData = [];

      // Préparation des données selon la vue actuelle
      if (viewMode === "byGroup") {
        // Organisation par groupe
        groups.forEach((group) => {
          const groupName = `${group.gender === "male" ? "Hommes" : "Femmes"} ${
            group.ageCategory.name
          } ${group.weightCategory.name}`;

          group.pools.forEach((pool, poolIndex) => {
            const poolMatches = generatedMatches.filter(
              (match) =>
                match.groupId === group.id && match.poolIndex === poolIndex
            );

            poolMatches.forEach((match) => {
              const scheduledMatch = generatedSchedule.find(
                (s) => s.matchId === match.id
              );

              if (scheduledMatch) {
                csvData.push([
                  "Combat",
                  scheduledMatch.matchNumber,
                  groupName,
                  poolIndex + 1,
                  scheduledMatch.areaNumber,
                  formatTime(new Date(scheduledMatch.startTime)),
                  getParticipantName(match, 0),
                  getParticipantLigue(match, 0),
                  getParticipantName(match, 1),
                  getParticipantLigue(match, 1),
                ]);
              }
            });
          });
        });
      } else {
        // Organisation par aire et par horaire
        [...Array(tournamentConfig.numAreas)].forEach((_, areaIndex) => {
          const areaNumber = areaIndex + 1;

          const areaMatches = generatedSchedule
            .filter((scheduleItem) => scheduleItem.areaNumber === areaNumber)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

          areaMatches.forEach((scheduleItem) => {
            if (scheduleItem.type === "break") {
              csvData.push([
                "Pause",
                "-",
                "-",
                "-",
                areaNumber,
                `${formatTime(new Date(scheduleItem.startTime))} - ${formatTime(
                  new Date(scheduleItem.endTime)
                )}`,
                "-",
                "-",
                "-",
                "-",
              ]);
              return;
            }

            const match = generatedMatches.find(
              (m) => m.id === scheduleItem.matchId
            );
            if (!match) return;

            const group = groups.find((g) => g.id === match.groupId);
            const groupName = group
              ? `${group.gender === "male" ? "H" : "F"} ${
                  group.ageCategory.name
                } ${group.weightCategory.name}`
              : "-";

            csvData.push([
              "Combat",
              scheduleItem.matchNumber,
              groupName,
              match.poolIndex + 1,
              areaNumber,
              formatTime(new Date(scheduleItem.startTime)),
              getParticipantName(match, 0),
              getParticipantLigue(match, 0),
              getParticipantName(match, 1),
              getParticipantLigue(match, 1),
            ]);
          });
        });
      }

      // Trier les données par numéro de match pour une meilleure organisation
      csvData.sort((a, b) => {
        if (a[0] === "Pause") return 1;
        if (b[0] === "Pause") return -1;
        return parseInt(a[1]) - parseInt(b[1]);
      });

      // Ajouter les données au contenu CSV
      csvData.forEach((row) => {
        // Échapper les virgules et les guillemets
        const escapedRow = row.map((cell) => {
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        });
        csvContent += escapedRow.join(",") + "\n";
      });

      // Créer un objet Blob pour le téléchargement
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      // Créer un lien de téléchargement
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `planning_combats_${
          competitionName ? competitionName.replace(/\s+/g, "_") : "competition"
        }_${formatDate(new Date()).replace(/\//g, "-")}.csv`
      );
      document.body.appendChild(link);

      // Simuler un clic sur le lien
      link.click();

      // Nettoyer
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportLoading({ ...exportLoading, csv: false });
    } catch (error) {
      console.error("Erreur lors de la génération du CSV:", error);
      setError(`Erreur lors de la génération du CSV: ${error.message}`);
      setExportLoading({ ...exportLoading, csv: false });
    }
  };

  return (
    <div className="match-schedule-container">
      <h2>Étape 4: Planning des combats</h2>

      {isLoading ? (
        <div className="loading">
          <p>
            {dataSource === "existing"
              ? "Chargement des matchs existants..."
              : "Génération du planning des combats en cours..."}
          </p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="schedule-stats">
            <h3>Résumé du planning</h3>
            <p>Nombre total de combats: {scheduleStats.totalMatches}</p>
            <p>Nombre d'aires de combat: {scheduleStats.totalAreas}</p>
            <p>
              Durée estimée: {formatDuration(scheduleStats.estimatedDuration)}
            </p>
            <p>
              Heure de fin estimée: {formatTime(scheduleStats.estimatedEndTime)}
            </p>
            {dataSource === "existing" && (
              <p className="info">
                Les matchs ont été chargés depuis la base de données.
              </p>
            )}

            <div className="export-buttons">
              <button
                className="export-btn pdf-btn"
                onClick={handleGeneratePDF}
                disabled={exportLoading.pdf || generatedMatches.length === 0}
              >
                {exportLoading.pdf ? "Génération..." : "Générer PDF"}
              </button>
              <button
                className="export-btn csv-btn"
                onClick={handleGenerateCSV}
                disabled={exportLoading.csv || generatedMatches.length === 0}
              >
                {exportLoading.csv ? "Génération..." : "Générer CSV"}
              </button>
            </div>
          </div>

          <div className="view-selector">
            <button
              className={`view-btn ${viewMode === "byGroup" ? "active" : ""}`}
              onClick={() => setViewMode("byGroup")}
            >
              Vue par groupe
            </button>
            <button
              className={`view-btn ${
                viewMode === "bySchedule" ? "active" : ""
              }`}
              onClick={() => setViewMode("bySchedule")}
            >
              Vue par horaire
            </button>
          </div>

          {viewMode === "byGroup" ? (
            <div className="groups-matches">
              <h3>Combats par groupe</h3>

              {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="group-matches">
                  <h4>
                    Groupe: {group.gender === "male" ? "Hommes" : "Femmes"}{" "}
                    {group.ageCategory.name} {group.weightCategory.name}
                  </h4>

                  {group.pools.map((pool, poolIndex) => (
                    <div key={poolIndex} className="pool-matches">
                      <h5>Poule {poolIndex + 1}</h5>

                      <table className="matches-table">
                        <thead>
                          <tr>
                            <th>N° Combat</th>
                            <th>Athlète A</th>
                            <th>Athlète B</th>
                            <th>Aire</th>
                            <th>Horaire prévu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedMatches
                            .filter(
                              (match) =>
                                match.groupId === group.id &&
                                match.poolIndex === poolIndex
                            )
                            .map((match, matchIndex) => {
                              // Trouver le combat dans le planning
                              const scheduledMatch = generatedSchedule.find(
                                (s) => s.matchId === match.id
                              );

                              return (
                                <tr key={matchIndex}>
                                  <td>
                                    {scheduledMatch
                                      ? scheduledMatch.matchNumber
                                      : "-"}
                                  </td>
                                  <td>{getParticipantName(match, 0)}</td>
                                  <td>{getParticipantName(match, 1)}</td>
                                  <td>
                                    {scheduledMatch
                                      ? scheduledMatch.areaNumber
                                      : "-"}
                                  </td>
                                  <td>
                                    {scheduledMatch
                                      ? formatTime(
                                          new Date(scheduledMatch.startTime)
                                        )
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            // Dans la vue par horaire
            <div className="schedule-view">
              <h3>Planning par aires de combat</h3>

              {[...Array(tournamentConfig.numAreas)].map((_, areaIndex) => {
                const areaNumber = areaIndex + 1;
                const areaMatches = generatedSchedule
                  .filter(
                    (scheduleItem) => scheduleItem.areaNumber === areaNumber
                  )
                  .sort(
                    (a, b) => new Date(a.startTime) - new Date(b.startTime)
                  );

                return (
                  <div key={areaIndex} className="area-schedule">
                    <h4>Aire {areaNumber}</h4>
                    <table className="matches-table">
                      <thead>
                        <tr>
                          <th>N° Combat</th> {/* Ajout de l'en-tête */}
                          <th>Horaire</th>
                          <th>Groupe</th>
                          <th>Poule</th>
                          <th>Athlète A</th>
                          <th>Athlète B</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaMatches.map((scheduleItem, scheduleIndex) => {
                          // Trouver le match correspondant
                          const match = generatedMatches.find(
                            (m) => m.id === scheduleItem.matchId
                          );

                          if (!match && scheduleItem.type === "break") {
                            return (
                              <tr
                                key={`break-${scheduleIndex}`}
                                className="break-row"
                              >
                                <td colSpan="7">
                                  Pause ({tournamentConfig.breakDuration} min) -
                                  {formatTime(new Date(scheduleItem.startTime))}{" "}
                                  à {formatTime(new Date(scheduleItem.endTime))}
                                </td>
                              </tr>
                            );
                          }

                          if (!match) return null;

                          // Trouver le groupe correspondant
                          const group = groups.find(
                            (g) => g.id === match.groupId
                          );

                          return (
                            <tr key={scheduleIndex}>
                              <td>{scheduleItem.matchNumber}</td>{" "}
                              {/* Afficher le numéro du combat */}
                              <td>
                                {formatTime(new Date(scheduleItem.startTime))}
                              </td>
                              <td>
                                {group
                                  ? `${group.gender === "male" ? "H" : "F"} ${
                                      group.ageCategory.name
                                    } ${group.weightCategory.name}`
                                  : "-"}
                              </td>
                              <td>{match.poolIndex + 1}</td>
                              <td>{getParticipantName(match, 0)}</td>
                              <td>{getParticipantName(match, 1)}</td>
                              <td>Combat</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
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
          disabled={isLoading || generatedMatches.length === 0}
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default MatchSchedule;
