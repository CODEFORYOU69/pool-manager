/**
 * Utilitaire d'export CSV au format Daedo scoring.
 * Extrait la logique d'export de ScoreInput.js pour la réutiliser dans PoolSchedule.js.
 */
import { API_URL } from "../services/dbService";
import { findPssInfo } from "./categories";
import { findPowerThreshold } from "./constants";

/**
 * En-têtes CSV standard pour le format Daedo.
 */
const CSV_HEADERS = [
  "MatchId", "Mat", "Number", "Phase", "Status",
  "HomeName", "HomeCountry", "HomeOrgId", "HomeCompetitorType", "HomeCompetitorId",
  "AwayName", "AwayCountry", "AwayOrgId", "AwayCompetitorType", "AwayCompetitorId",
  "Rules", "Rounds", "MaxDifference", "MaxPenalties",
  "TimingRound", "TimingRest", "TimingInjury",
  "ThresholdBody", "ThresholdHead",
  "GoldenPointEnabled", "GoldenPointTime",
  "HomeOrg", "AwayOrg",
  "Discipline", "Division", "Gender", "WeightCategory",
  "Role", "EventID", "VideoReplayHome", "VideoReplayAway",
];

/**
 * Récupère le nom du participant depuis un match.
 */
const getParticipantName = (match, position) => {
  if (match.participants && match.participants.length >= 2) {
    const idx = position === "A" ? 0 : 1;
    const p = match.participants[idx];
    if (p) return `${p.prenom || ""} ${p.nom || ""}`.trim();
  }
  if (match.matchParticipants) {
    const mp = match.matchParticipants.find((m) => m.position === position);
    if (mp && mp.participant) return `${mp.participant.prenom || ""} ${mp.participant.nom || ""}`.trim();
  }
  return "";
};

/**
 * Récupère le seuil PSS pour un match.
 */
const getPssThreshold = (ageCategory, gender, weightCategory) => {
  try {
    if (ageCategory && gender && weightCategory) {
      const pssInfo = findPssInfo(ageCategory, gender, weightCategory);
      if (pssInfo && pssInfo.hitLevel) return pssInfo.hitLevel.toString();

      const powerThreshold = findPowerThreshold(ageCategory, gender, weightCategory);
      if (powerThreshold && powerThreshold.hitLevel) return powerThreshold.hitLevel.toString();
    }
  } catch (error) {
    console.error("Erreur lors de la recherche du seuil PSS:", error);
  }
  return "11";
};

/**
 * Exporte des matchs au format CSV Daedo.
 *
 * @param {Array} matches - Liste des matchs à exporter
 * @param {string} competitionId - ID de la compétition
 * @param {Array} groups - Groupes disponibles (optionnel)
 * @param {string} filename - Nom du fichier CSV
 */
export const exportMatchesToDaedoCsv = async (matches, competitionId, groups = [], filename = "matches_export.csv") => {
  try {
    // Récupérer les données de compétition
    let roundDuration = "120";
    let breakDuration = "60";

    try {
      const response = await fetch(`${API_URL}/competition/${competitionId}`);
      if (response.ok) {
        const data = await response.json();
        roundDuration = String(data.roundDuration || 120);
        breakDuration = String(data.breakDuration || 60);
      }
    } catch (e) {
      console.warn("Impossible de récupérer les données de compétition pour l'export");
    }

    const rows = [];
    let indexEventId = 100;
    let homeOrgId = 200;
    let awayOrgId = 300;

    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];

      const participantA = match.participants?.[0] || {};
      const participantB = match.participants?.[1] || {};

      // Récupérer les informations du groupe
      let ageCategory = "Senior";
      let weightCategory = "";
      let gender = "Male";

      const groupInfo = groups.find((g) => g.id === match.groupId);
      if (groupInfo) {
        ageCategory = groupInfo.ageCategoryName || ageCategory;
        weightCategory = groupInfo.weightCategoryName || "";
        gender = groupInfo.gender === "female" ? "Female" : "Male";
      } else if (match.groupId) {
        try {
          const resp = await fetch(`${API_URL}/group/${match.groupId}`);
          if (resp.ok) {
            const gData = await resp.json();
            ageCategory = gData.ageCategoryName || ageCategory;
            weightCategory = gData.weightCategoryName || "";
            gender = gData.gender === "female" ? "Female" : "Male";
          }
        } catch (e) { /* ignore */ }
      }

      const homeOrg = participantA.ligue || participantA.club || "";
      const awayOrg = participantB.ligue || participantB.club || "";

      const homeCompetitorId = (participantA.id || "").replace(/[^0-9]/g, "").substring(0, 4);
      const awayCompetitorId = (participantB.id || "").replace(/[^0-9]/g, "").substring(0, 4);

      const thresholdBody = getPssThreshold(ageCategory, gender, weightCategory);
      const formattedId = String(index + 1).padStart(3, "0");
      const mat = match.area?.areaNumber || match.areaNumber || "1";
      const formattedWeightCategory = weightCategory ? `-${weightCategory}`.replace(/--/g, "-") : "";

      indexEventId++;
      homeOrgId++;
      awayOrgId++;

      // Déterminer la phase Daedo selon le type de match
      let daedoPhase = "R16";
      const matchPhase = match.phase || "";
      if (matchPhase === "semi1" || matchPhase === "semi2") {
        daedoPhase = "SF";
      } else if (matchPhase === "final") {
        daedoPhase = "F";
      } else if (matchPhase === "bronze") {
        daedoPhase = "BR";
      }

      const row = [
        formattedId, mat, match.matchNumber || match.number || index + 1,
        daedoPhase, "SCHEDULED",
        getParticipantName(match, "A"), "FRA", homeOrgId, "A", homeCompetitorId,
        getParticipantName(match, "B"), "FRA", awayOrgId, "A", awayCompetitorId,
        "BESTOF3", "3", "12", "5",
        roundDuration, breakDuration, "60",
        thresholdBody, "0",
        "False", "60",
        homeOrg, awayOrg,
        "Taekwondo Kyorugi", ageCategory, gender, formattedWeightCategory,
        "ATHLETE", indexEventId, "1", "1",
      ];

      rows.push(row.join(","));
    }

    // Créer et télécharger le fichier CSV
    const csvString = [CSV_HEADERS.join(","), ...rows].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Erreur lors de la création du CSV:", error);
    alert("Une erreur est survenue lors de l'exportation CSV");
  }
};
