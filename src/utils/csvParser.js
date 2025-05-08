import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";

/**
 * Calcule les années de naissance correspondant à chaque catégorie pour la saison sportive actuelle
 * @returns {Object} Un objet contenant les années pour chaque catégorie
 */
export const getCurrentSeasonCategories = () => {
  // Déterminer la saison sportive actuelle (commence le 1er septembre)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() retourne 0-11

  // Si nous sommes avant septembre, nous sommes encore dans la saison de l'année précédente
  // Exemple: en mai 2024, nous sommes dans la saison 2023-2024
  // Si nous sommes en septembre ou après, nous sommes dans la nouvelle saison
  // Exemple: en octobre 2024, nous sommes dans la saison 2024-2025
  const seasonStartYear = currentMonth < 9 ? currentYear - 1 : currentYear;

  // Calculer les décalages par rapport à l'année de référence
  // Pour la saison 2024-2025, les années de référence sont:
  // Benjamin: 2016-2017
  // Minime: 2014-2015
  // Cadet: 2011-2012-2013
  // Junior: 2008-2009-2010
  // Senior: <= 2007

  // Calculer le décalage par rapport à la saison 2024-2025 (année de référence)
  const yearOffset = seasonStartYear - 2024;

  // Appliquer le décalage aux années de référence
  return {
    season: {
      start: seasonStartYear,
      end: seasonStartYear + 1,
    },
    benjamin: [2016 + yearOffset, 2017 + yearOffset],
    minime: [2014 + yearOffset, 2015 + yearOffset],
    cadet: [2011 + yearOffset, 2012 + yearOffset, 2013 + yearOffset],
    junior: [2008 + yearOffset, 2009 + yearOffset, 2010 + yearOffset],
    seniorThreshold: 2007 + yearOffset,
  };
};

/**
 * Parse un fichier CSV et retourne les participants formatés
 * @param {string} csvContent - Contenu du fichier CSV
 * @returns {Object} - Objet contenant les données et les erreurs éventuelles
 */
export const parseCSV = (csvContent) => {
  // Utiliser PapaParse pour analyser le contenu CSV
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => normalizeHeader(header),
  });

  // Vérifier les erreurs de parsing
  if (parseResult.errors.length > 0) {
    return parseResult;
  }

  // Extraire l'année de naissance à partir d'une date
  const getBirthYear = (birthdate) => {
    if (!birthdate) return null;

    // Si le format est YYYY
    if (/^\d{4}$/.test(birthdate)) {
      return parseInt(birthdate);
    }

    // Si le format est DD/MM/YYYY ou similaire
    const parts = birthdate.split(/[\/\-\.]/);
    const yearPart = parts.reduce((max, part) => {
      const num = parseInt(part);
      return num > 1900 && num < 2100 ? num : max;
    }, 0);

    return yearPart > 0 ? yearPart : null;
  };

  // Calculer l'âge à partir de la date de naissance
  const calculateAge = (birthdate) => {
    if (!birthdate) return 0;

    // Format de date attendu: DD/MM/YYYY ou YYYY
    // Si le format est YYYY, on utilise directement cette valeur
    if (/^\d{4}$/.test(birthdate)) {
      const birthYear = parseInt(birthdate);
      const currentYear = new Date().getFullYear();
      return currentYear - birthYear;
    }

    // Si le format est DD/MM/YYYY ou similaire
    const parts = birthdate.split(/[\/\-\.]/); // Accepte /, - ou . comme séparateur
    if (parts.length < 3) return 0;

    // Déterminer quelle partie est l'année (généralement la plus grande)
    let yearPart = parts.reduce((max, part) => {
      const num = parseInt(part);
      return num > max ? num : max;
    }, 0);

    // Si nous avons trouvé une année valide (supérieure à 1900)
    if (yearPart > 1900) {
      const currentYear = new Date().getFullYear();
      return currentYear - yearPart;
    }

    return 0;
  };

  // Déterminer la catégorie d'âge en fonction de l'année de naissance
  const determineAgeCategory = (birthdate) => {
    if (!birthdate) return "Inconnue";

    // Extraire l'année de naissance
    let birthYear = 0;

    // Si le format est YYYY
    if (/^\d{4}$/.test(birthdate)) {
      birthYear = parseInt(birthdate);
    }
    // Si le format est DD/MM/YYYY ou similaire
    else {
      const parts = birthdate.split(/[\/\-\.]/);
      birthYear = parts.reduce((max, part) => {
        const num = parseInt(part);
        return num > 1900 && num < 2100 ? num : max;
      }, 0);
    }

    if (birthYear === 0) return "Inconnue";

    // Obtenir les catégories d'âge pour la saison actuelle
    const categories = getCurrentSeasonCategories();

    console.log(
      `Saison sportive actuelle: ${categories.season.start}-${categories.season.end}`
    );
    console.log(`Années Benjamin: ${categories.benjamin.join("-")}`);
    console.log(`Années Minime: ${categories.minime.join("-")}`);
    console.log(`Années Cadet: ${categories.cadet.join("-")}`);
    console.log(`Années Junior: ${categories.junior.join("-")}`);
    console.log(`Années Senior: <= ${categories.seniorThreshold}`);

    // Déterminer la catégorie en fonction de l'année de naissance
    if (categories.benjamin.includes(birthYear)) return "Benjamin";
    if (categories.minime.includes(birthYear)) return "Minime";
    if (categories.cadet.includes(birthYear)) return "Cadet";
    if (categories.junior.includes(birthYear)) return "Junior";
    if (birthYear <= categories.seniorThreshold) return "Senior";

    return "Inconnue";
  };

  // Extraire le poids à partir de la chaîne "weights"
  const extractWeight = (weights) => {
    if (!weights) return 0;

    // Format attendu: "X - Y" ou "X - 999"
    const parts = weights.split("-");
    if (parts.length !== 2) return 0;

    // Prendre la valeur moyenne entre min et max (ou juste min si max est 999)
    const min = parseFloat(parts[0].trim());
    const max = parseFloat(parts[1].trim());

    if (max >= 900) {
      // Valeur arbitraire pour détecter les catégories "+"
      return min + 5; // Ajouter une marge raisonnable
    }

    return (min + max) / 2;
  };

  // Valider et formater les données
  const formattedData = parseResult.data.map((row) => {
    // Normaliser le sexe (M/F, Homme/Femme, etc.)
    let gender = row.gender ? row.gender.toLowerCase().trim() : "";

    // Amélioration de la détection du genre
    if (
      gender === "m" ||
      gender === "h" ||
      gender === "homme" ||
      gender === "male" ||
      gender === "masculin"
    ) {
      gender = "male";
      console.log(
        `Genre normalisé: "${row.gender}" -> "male" pour ${row.firstname} ${row.lastname}`
      );
    } else if (
      gender === "f" ||
      gender === "femme" ||
      gender === "female" ||
      gender === "féminin" ||
      gender === "feminin"
    ) {
      gender = "female";
      console.log(
        `Genre normalisé: "${row.gender}" -> "female" pour ${row.firstname} ${row.lastname}`
      );
    } else {
      // Si le genre n'est pas reconnu, essayer de déterminer à partir d'autres indices
      // Par exemple, si la catégorie est fournie (female-Minime, male-Cadet, etc.)
      if (row.category && typeof row.category === "string") {
        const lowerCategory = row.category.toLowerCase();
        if (
          lowerCategory.startsWith("f-") ||
          lowerCategory.startsWith("female-") ||
          lowerCategory.startsWith("f_") ||
          lowerCategory.startsWith("fém-")
        ) {
          gender = "female";
          console.log(
            `Genre déterminé par catégorie: "${row.category}" -> "female" pour ${row.firstname} ${row.lastname}`
          );
        } else if (
          lowerCategory.startsWith("m-") ||
          lowerCategory.startsWith("male-") ||
          lowerCategory.startsWith("m_") ||
          lowerCategory.startsWith("masc-")
        ) {
          gender = "male";
          console.log(
            `Genre déterminé par catégorie: "${row.category}" -> "male" pour ${row.firstname} ${row.lastname}`
          );
        } else {
          gender = "unknown";
          console.warn(
            `Genre non reconnu: "${row.gender}" pour ${row.firstname} ${row.lastname}`
          );
        }
      } else {
        gender = "unknown";
        console.warn(
          `Genre non reconnu: "${row.gender}" pour ${row.firstname} ${row.lastname}`
        );
      }
    }

    // Calculer l'âge à partir de la date de naissance
    const age = calculateAge(row.birthdate);

    // Déterminer la catégorie d'âge
    const ageCategory = determineAgeCategory(row.birthdate);

    // Extraire le poids
    const poids = extractWeight(row.weights);

    // Ajouter un ID unique pour chaque participant
    return {
      id: uuidv4(),
      nom: row.lastname || "",
      prenom: row.firstname || "",
      sexe: gender,
      age: age,
      ageCategory: ageCategory,
      birthYear: getBirthYear(row.birthdate),
      poids: poids,
      ligue: row.team || "",
      // Ajouter la catégorie si elle existe
      ...(row.category && { categorie: row.category }),
    };
  });

  // Trouver les indices des participants qui pourraient avoir des données incorrectes
  const invalidIndices = formattedData
    .map((participant, index) => {
      if (
        !participant.nom ||
        !participant.prenom ||
        (participant.sexe !== "male" && participant.sexe !== "female") ||
        isNaN(participant.age) ||
        isNaN(participant.poids) ||
        !participant.ligue
      ) {
        return index;
      }
      return -1;
    })
    .filter((index) => index !== -1);

  // Si des données sont invalides, les signaler comme erreurs
  if (invalidIndices.length > 0) {
    for (const index of invalidIndices) {
      parseResult.errors.push({
        type: "InvalidData",
        message: `Données invalides à la ligne ${index + 2}`,
        row: index,
      });
    }
    return parseResult;
  }

  return {
    data: formattedData,
    errors: parseResult.errors,
  };
};

/**
 * Normalise les en-têtes du CSV pour les rendre cohérents
 * @param {string} header - En-tête original
 * @returns {string} - En-tête normalisé
 */
const normalizeHeader = (header) => {
  const headerMap = {
    // Variations possibles pour le nom
    nom: "nom",
    name: "nom",
    lastname: "lastname",
    last_name: "lastname",
    family_name: "lastname",
    nom_famille: "lastname",

    // Variations possibles pour le prénom
    prenom: "prenom",
    prénom: "prenom",
    firstname: "firstname",
    first_name: "firstname",
    given_name: "firstname",

    // Variations possibles pour le sexe
    sexe: "gender",
    sex: "gender",
    genre: "gender",
    gender: "gender",

    // Variations possibles pour la date de naissance
    birthdate: "birthdate",
    date_naissance: "birthdate",
    birth_date: "birthdate",
    date_de_naissance: "birthdate",
    dob: "birthdate",

    // Variations possibles pour les poids
    poids: "weights",
    weight: "weights",
    weights: "weights",
    masse: "weights",
    categorie_poids: "weights",

    // Variations possibles pour la ligue/club
    ligue: "team",
    league: "team",
    club: "team",
    team: "team",
    équipe: "team",
    equipe: "team",
  };

  const normalizedHeader = header.toLowerCase().trim();
  return headerMap[normalizedHeader] || normalizedHeader;
};
