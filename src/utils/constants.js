// Constants pour l'application de gestion de tournois de taekwondo

/**
 * Seuils de puissance et tailles de plastrons par catégorie selon les règles FFTDA 2024/2025
 *
 * Structure:
 * - Clé principale: catégorie d'âge (benjamins, minimes, cadets, etc.)
 * - Sous-clé: genre (male/female)
 * - Valeurs: tableau d'objets avec:
 *   - min/max: plage de poids en kg
 *   - threshold: seuil de puissance
 *   - pss: taille du plastron (Body PSS)
 *   - hitLevel: niveau de frappe
 */
export const POWER_THRESHOLDS = {
  // BENJAMINS
  benjamins: {
    male: [
      { min: -21, max: -21, threshold: "-21 Kg", pss: "# 0", hitLevel: 7 },
      { min: -24, max: -24, threshold: "-24 Kg", pss: "# 0", hitLevel: 7 },
      { min: -27, max: -27, threshold: "-27 Kg", pss: "# 0", hitLevel: 8 },
      { min: -30, max: -30, threshold: "-30 Kg", pss: "# 0", hitLevel: 8 },
      { min: -33, max: -33, threshold: "-33 Kg", pss: "# 0", hitLevel: 9 },
      { min: -37, max: -37, threshold: "-37 Kg", pss: "# 1", hitLevel: 9 },
      { min: -41, max: -41, threshold: "-41 Kg", pss: "# 1", hitLevel: 10 },
      { min: -45, max: -45, threshold: "-45 Kg", pss: "# 1", hitLevel: 11 },
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 1", hitLevel: 12 },
      { min: 49, max: 1000, threshold: "+49 Kg", pss: "# 2", hitLevel: 13 },
    ],
    female: [
      { min: -17, max: -17, threshold: "-17 Kg", pss: "# 0", hitLevel: 6 },
      { min: -20, max: -20, threshold: "-20 Kg", pss: "# 0", hitLevel: 6 },
      { min: -23, max: -23, threshold: "-23 Kg", pss: "# 0", hitLevel: 7 },
      { min: -26, max: -26, threshold: "-26 Kg", pss: "# 0", hitLevel: 7 },
      { min: -29, max: -29, threshold: "-29 Kg", pss: "# 0", hitLevel: 8 },
      { min: -33, max: -33, threshold: "-33 Kg", pss: "# 0", hitLevel: 8 },
      { min: -37, max: -37, threshold: "-37 Kg", pss: "# 1", hitLevel: 9 },
      { min: -41, max: -41, threshold: "-41 Kg", pss: "# 1", hitLevel: 10 },
      { min: -44, max: -44, threshold: "-44 Kg", pss: "# 1", hitLevel: 11 },
      { min: 44, max: 1000, threshold: "+44 Kg", pss: "# 2", hitLevel: 12 },
    ],
  },
  // MINIMES
  minimes: {
    male: [
      { min: -27, max: -27, threshold: "-27 Kg", pss: "# 0", hitLevel: 9 },
      { min: -30, max: -30, threshold: "-30 Kg", pss: "# 0", hitLevel: 10 },
      { min: -33, max: -33, threshold: "-33 Kg", pss: "# 0", hitLevel: 11 },
      { min: -37, max: -37, threshold: "-37 Kg", pss: "# 1", hitLevel: 12 },
      { min: -41, max: -41, threshold: "-41 Kg", pss: "# 1", hitLevel: 13 },
      { min: -45, max: -45, threshold: "-45 Kg", pss: "# 1", hitLevel: 14 },
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 2", hitLevel: 15 },
      { min: -53, max: -53, threshold: "-53 Kg", pss: "# 2", hitLevel: 16 },
      { min: -57, max: -57, threshold: "-57 Kg", pss: "# 3", hitLevel: 17 },
      { min: 57, max: 1000, threshold: "+57 Kg", pss: "# 3", hitLevel: 18 },
    ],
    female: [
      { min: -23, max: -23, threshold: "-23 Kg", pss: "# 0", hitLevel: 7 },
      { min: -26, max: -26, threshold: "-26 Kg", pss: "# 0", hitLevel: 8 },
      { min: -29, max: -29, threshold: "-29 Kg", pss: "# 0", hitLevel: 8 },
      { min: -33, max: -33, threshold: "-33 Kg", pss: "# 0", hitLevel: 9 },
      { min: -37, max: -37, threshold: "-37 Kg", pss: "# 1", hitLevel: 10 },
      { min: -41, max: -41, threshold: "-41 Kg", pss: "# 1", hitLevel: 11 },
      { min: -44, max: -44, threshold: "-44 Kg", pss: "# 1", hitLevel: 12 },
      { min: -47, max: -47, threshold: "-47 Kg", pss: "# 2", hitLevel: 13 },
      { min: -51, max: -51, threshold: "-51 Kg", pss: "# 3", hitLevel: 14 },
      { min: 51, max: 1000, threshold: "+51 Kg", pss: "# 3", hitLevel: 15 },
    ],
  },
  // CADETS
  cadets: {
    male: [
      { min: -33, max: -33, threshold: "-33 Kg", pss: "# 0", hitLevel: 10 },
      { min: -37, max: -37, threshold: "-37 Kg", pss: "# 0", hitLevel: 11 },
      { min: -41, max: -41, threshold: "-41 Kg", pss: "# 1", hitLevel: 13 },
      { min: -45, max: -45, threshold: "-45 Kg", pss: "# 1", hitLevel: 14 },
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 1", hitLevel: 15 },
      { min: -53, max: -53, threshold: "-53 Kg", pss: "# 2", hitLevel: 16 },
      { min: -57, max: -57, threshold: "-57 Kg", pss: "# 2", hitLevel: 17 },
      { min: -61, max: -61, threshold: "-61 Kg", pss: "# 2", hitLevel: 18 },
      { min: -65, max: -65, threshold: "-65 Kg", pss: "# 3", hitLevel: 19 },
      { min: 65, max: 1000, threshold: "+65 Kg", pss: "# 3", hitLevel: 20 },
    ],
    female: [
      { min: -29, max: -29, threshold: "-29 Kg", pss: "# 0", hitLevel: 10 },
      { min: -33, max: -33, threshold: "-33 Kg", pss: "# 0", hitLevel: 11 },
      { min: -37, max: -37, threshold: "-37 Kg", pss: "# 1", hitLevel: 13 },
      { min: -41, max: -41, threshold: "-41 Kg", pss: "# 1", hitLevel: 14 },
      { min: -44, max: -44, threshold: "-44 Kg", pss: "# 1", hitLevel: 15 },
      { min: -47, max: -47, threshold: "-47 Kg", pss: "# 2", hitLevel: 16 },
      { min: -51, max: -51, threshold: "-51 Kg", pss: "# 2", hitLevel: 17 },
      { min: -55, max: -55, threshold: "-55 Kg", pss: "# 2", hitLevel: 18 },
      { min: -59, max: -59, threshold: "-59 Kg", pss: "# 3", hitLevel: 19 },
      { min: 59, max: 1000, threshold: "+59 Kg", pss: "# 3", hitLevel: 20 },
    ],
  },
  // JUNIORS
  juniors: {
    male: [
      { min: -45, max: -45, threshold: "-45 Kg", pss: "# 1", hitLevel: 17 },
      { min: -48, max: -48, threshold: "-48 Kg", pss: "# 2", hitLevel: 18 },
      { min: -51, max: -51, threshold: "-51 Kg", pss: "# 2", hitLevel: 19 },
      { min: -55, max: -55, threshold: "-55 Kg", pss: "# 2", hitLevel: 20 },
      { min: -59, max: -59, threshold: "-59 Kg", pss: "# 3", hitLevel: 21 },
      { min: -63, max: -63, threshold: "-63 Kg", pss: "# 3", hitLevel: 22 },
      { min: -68, max: -68, threshold: "-68 Kg", pss: "# 3", hitLevel: 23 },
      { min: -73, max: -73, threshold: "-73 Kg", pss: "# 4", hitLevel: 24 },
      { min: -78, max: -78, threshold: "-78 Kg", pss: "# 4", hitLevel: 25 },
      { min: 78, max: 1000, threshold: "+78 Kg", pss: "# 4", hitLevel: 26 },
    ],
    female: [
      { min: -42, max: -42, threshold: "-42 Kg", pss: "# 1", hitLevel: 14 },
      { min: -44, max: -44, threshold: "-44 Kg", pss: "# 1", hitLevel: 15 },
      { min: -46, max: -46, threshold: "-46 Kg", pss: "# 1", hitLevel: 16 },
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 2", hitLevel: 17 },
      { min: -52, max: -52, threshold: "-52 Kg", pss: "# 2", hitLevel: 18 },
      { min: -55, max: -55, threshold: "-55 Kg", pss: "# 2", hitLevel: 19 },
      { min: -59, max: -59, threshold: "-59 Kg", pss: "# 3", hitLevel: 20 },
      { min: -63, max: -63, threshold: "-63 Kg", pss: "# 3", hitLevel: 21 },
      { min: -68, max: -68, threshold: "-68 Kg", pss: "# 3", hitLevel: 22 },
      { min: 68, max: 1000, threshold: "+68 Kg", pss: "# 4", hitLevel: 23 },
    ],
  },
  // SENIORS
  seniors: {
    male: [
      { min: -54, max: -54, threshold: "-54 Kg", pss: "# 2", hitLevel: 21 },
      { min: -58, max: -58, threshold: "-58 Kg", pss: "# 2", hitLevel: 22 },
      { min: -63, max: -63, threshold: "-63 Kg", pss: "# 3", hitLevel: 23 },
      { min: -68, max: -68, threshold: "-68 Kg", pss: "# 3", hitLevel: 24 },
      { min: -74, max: -74, threshold: "-74 Kg", pss: "# 3", hitLevel: 25 },
      { min: -80, max: -80, threshold: "-80 Kg", pss: "# 4", hitLevel: 26 },
      { min: -87, max: -87, threshold: "-87 Kg", pss: "# 4", hitLevel: 27 },
      { min: 87, max: 1000, threshold: "+87 Kg", pss: "# 4/5", hitLevel: 28 },
    ],
    female: [
      { min: -46, max: -46, threshold: "-46 Kg", pss: "# 2", hitLevel: 17 },
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 2", hitLevel: 18 },
      { min: -53, max: -53, threshold: "-53 Kg", pss: "# 2", hitLevel: 19 },
      { min: -57, max: -57, threshold: "-57 Kg", pss: "# 2", hitLevel: 20 },
      { min: -62, max: -62, threshold: "-62 Kg", pss: "# 3", hitLevel: 21 },
      { min: -67, max: -67, threshold: "-67 Kg", pss: "# 3", hitLevel: 22 },
      { min: -73, max: -73, threshold: "-73 Kg", pss: "# 4", hitLevel: 23 },
      { min: 73, max: 1000, threshold: "+73 Kg", pss: "# 4", hitLevel: 24 },
    ],
  },
  // ESPOIRS
  espoirs: {
    male: [
      { min: -54, max: -54, threshold: "-54 Kg", pss: "# 2", hitLevel: 20 },
      { min: -58, max: -58, threshold: "-58 Kg", pss: "# 2", hitLevel: 21 },
      { min: -63, max: -63, threshold: "-63 Kg", pss: "# 3", hitLevel: 22 },
      { min: -68, max: -68, threshold: "-68 Kg", pss: "# 3", hitLevel: 23 },
      { min: -74, max: -74, threshold: "-74 Kg", pss: "# 3", hitLevel: 24 },
      { min: -80, max: -80, threshold: "-80 Kg", pss: "# 4", hitLevel: 25 },
      { min: -87, max: -87, threshold: "-87 Kg", pss: "# 4", hitLevel: 26 },
      { min: 87, max: 1000, threshold: "+87 Kg", pss: "# 4/5", hitLevel: 27 },
    ],
    female: [
      { min: -46, max: -46, threshold: "-46 Kg", pss: "# 2", hitLevel: 16 },
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 2", hitLevel: 17 },
      { min: -53, max: -53, threshold: "-53 Kg", pss: "# 2", hitLevel: 18 },
      { min: -57, max: -57, threshold: "-57 Kg", pss: "# 3", hitLevel: 19 },
      { min: -62, max: -62, threshold: "-62 Kg", pss: "# 3", hitLevel: 20 },
      { min: -67, max: -67, threshold: "-67 Kg", pss: "# 4", hitLevel: 21 },
      { min: -73, max: -73, threshold: "-73 Kg", pss: "# 4", hitLevel: 22 },
      { min: 73, max: 1000, threshold: "+73 Kg", pss: "# 4", hitLevel: 23 },
    ],
  },
  // MASTER
  master: {
    male: [
      { min: -58, max: -58, threshold: "-58 Kg", pss: "# 2", hitLevel: 19 },
      { min: -68, max: -68, threshold: "-68 Kg", pss: "# 3", hitLevel: 20 },
      { min: -80, max: -80, threshold: "-80 Kg", pss: "# 4", hitLevel: 21 },
      { min: 80, max: 1000, threshold: "+80 Kg", pss: "# 4", hitLevel: 22 },
    ],
    female: [
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 2", hitLevel: 17 },
      { min: -57, max: -57, threshold: "-57 Kg", pss: "# 2", hitLevel: 18 },
      { min: -67, max: -67, threshold: "-67 Kg", pss: "# 3", hitLevel: 19 },
      { min: 67, max: 1000, threshold: "+67 Kg", pss: "# 3", hitLevel: 20 },
    ],
  },
  // OLYMPIC
  olympic: {
    male: [
      { min: -58, max: -58, threshold: "-58 Kg", pss: "# 3", hitLevel: 22 },
      { min: -68, max: -68, threshold: "-68 Kg", pss: "# 3", hitLevel: 24 },
      { min: -80, max: -80, threshold: "-80 Kg", pss: "# 4", hitLevel: 26 },
      { min: 80, max: 1000, threshold: "+80 Kg", pss: "# 5", hitLevel: 28 },
    ],
    female: [
      { min: -49, max: -49, threshold: "-49 Kg", pss: "# 2", hitLevel: 18 },
      { min: -57, max: -57, threshold: "-57 Kg", pss: "# 2", hitLevel: 20 },
      { min: -67, max: -67, threshold: "-67 Kg", pss: "# 3", hitLevel: 22 },
      { min: 67, max: 1000, threshold: "+67 Kg", pss: "# 3", hitLevel: 24 },
    ],
  },
};

// Fonction pour normaliser un nom de catégorie (pour la comparaison)
function normalizeString(str) {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

// Fonction pour trouver le seuil de puissance d'une catégorie
export const findPowerThreshold = (ageCategory, gender, weightCategory) => {
  try {
    console.log("findPowerThreshold appelée avec:", {
      ageCategory,
      gender,
      weightCategory,
    });

    if (!ageCategory || !gender || !weightCategory) {
      console.log("Paramètres manquants pour findPowerThreshold");
      return null;
    }

    // Normaliser la catégorie d'âge pour la recherche
    const normalizedAgeCategory = normalizeString(ageCategory);

    // Trouver dans quelle catégorie d'âge nous sommes
    let ageCatKey = null;
    for (const key in POWER_THRESHOLDS) {
      if (normalizeString(key) === normalizedAgeCategory) {
        ageCatKey = key;
        break;
      }
    }

    if (!ageCatKey) {
      console.log("Catégorie d'âge non trouvée:", ageCategory);
      return null;
    }

    console.log("Clé de catégorie d'âge trouvée:", ageCatKey);

    // Déterminer le genre (male ou female)
    const normalizedGender = normalizeString(gender);
    const genderKey = normalizedGender.includes("f") ? "female" : "male";

    // Obtenir les données de seuil pour cette catégorie d'âge
    const thresholdData = POWER_THRESHOLDS[ageCatKey];
    if (!thresholdData) {
      console.log(
        "Pas de données de seuil pour cette catégorie d'âge:",
        ageCatKey
      );
      return null;
    }

    // Obtenir les catégories de poids pour ce genre
    const weightCategories = thresholdData[genderKey];
    if (!weightCategories) {
      console.log("Pas de catégories de poids pour ce genre:", genderKey);
      return null;
    }

    // Normaliser la catégorie de poids recherchée
    let weightName;
    if (typeof weightCategory === "string") {
      weightName = weightCategory;
    } else if (typeof weightCategory === "object") {
      if (weightCategory.name) {
        weightName = weightCategory.name;
      } else if (weightCategory.weightCategoryName) {
        weightName = weightCategory.weightCategoryName;
      }
    }

    if (!weightName) {
      console.log(
        "Nom de catégorie de poids non trouvé dans l'objet:",
        weightCategory
      );
      return null;
    }

    const normalizedWeightCategory = normalizeString(weightName);
    console.log("Catégorie de poids normalisée:", normalizedWeightCategory);

    // Chercher la correspondance dans les catégories de poids
    for (const weightRange in weightCategories) {
      const normalizedWeightRange = normalizeString(weightRange);
      if (normalizedWeightRange === normalizedWeightCategory) {
        const result = {
          pss: weightCategories[weightRange].pss,
          hitLevel: weightCategories[weightRange].hitLevel,
        };
        console.log("Seuil trouvé:", result);
        return result;
      }
    }

    console.log(
      "Aucune correspondance exacte trouvée pour la catégorie de poids:",
      weightName
    );

    // Si pas de correspondance exacte, essayer de faire correspondre le format numérique
    // Par exemple, "-58kg" avec "-58 kg"
    for (const weightRange in weightCategories) {
      // Extraire uniquement les chiffres et le signe + ou -
      const currentPattern = weightRange.replace(/[^0-9+-]/g, "");
      const searchPattern = normalizedWeightCategory.replace(/[^0-9+-]/g, "");

      if (currentPattern === searchPattern) {
        const result = {
          pss: weightCategories[weightRange].pss,
          hitLevel: weightCategories[weightRange].hitLevel,
        };
        console.log("Seuil trouvé par correspondance numérique:", result);
        return result;
      }
    }

    console.log(
      "Aucune correspondance trouvée pour la catégorie de poids:",
      weightName
    );
    return null;
  } catch (error) {
    console.error("Erreur lors de la recherche du seuil de puissance:", error);
    return null;
  }
};
