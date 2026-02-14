import { v4 as uuidv4 } from "uuid";
import { KYORUGI_CATEGORIES } from "./categories";
import { getCurrentSeasonCategories } from "./csvParser";

/**
 * Crée des groupes à partir d'une liste de participants
 * @param {Array} participants - Liste des participants
 * @param {Object} config - Configuration du tournoi
 * @returns {Object} - Groupes créés et statistiques
 */
const createGroups = (participants, config) => {
  try {
    const groups = [];
    const stats = {
      totalPools: 0,
      unusedParticipants: 0,
    };

    // Valider les participants dès le début pour les utiliser partout dans la fonction
    const validParticipants = participants.filter((p) => p && p.id);

    // Stocker les informations de diagnostic pour les afficher à la fin
    const diagnosticInfo = {
      ageCategories: [],
      weightCategoriesMale: [],
      weightCategoriesFemale: [],
      uncategorizedParticipants: [],
      unusedParticipants: [],
      unusedByCategory: {},
      tempIds: validParticipants.filter((p) => p.id && p.id.startsWith("temp_"))
        .length,
    };

    // Collecter les informations sur les catégories configurées
    if (config.ageCategories) {
      diagnosticInfo.ageCategories = config.ageCategories.map(
        (cat) => `${cat.name} (${cat.min} - ${cat.max} ans)`
      );
    }

    if (config.weightCategories) {
      if (config.weightCategories.male) {
        diagnosticInfo.weightCategoriesMale = config.weightCategories.male.map(
          (cat) => `${cat.name} (max: ${cat.max} kg)`
        );
      }

      if (config.weightCategories.female) {
        diagnosticInfo.weightCategoriesFemale =
          config.weightCategories.female.map(
            (cat) => `${cat.name} (max: ${cat.max} kg)`
          );
      }
    }

    // Vérification des données d'entrée
    if (
      !participants ||
      !Array.isArray(participants) ||
      participants.length === 0
    ) {
      return { groups: [], stats };
    }

    if (!config) {
      return { groups: [], stats };
    }

    if (!config.ageCategories || !Array.isArray(config.ageCategories)) {
      return { groups: [], stats };
    }

    if (
      !config.weightCategories ||
      !config.weightCategories.male ||
      !config.weightCategories.female
    ) {
      return { groups: [], stats };
    }

    // Déterminer si nous avons des catégories prédéfinies dans les données JSON
    const predefinedCategories = new Map();
    const categoryCounts = {};

    // Première étape: compter les participants par catégorie prédéfinie
    participants.forEach((participant) => {
      if (participant.categorie) {
        if (!categoryCounts[participant.categorie]) {
          categoryCounts[participant.categorie] = 0;
        }
        categoryCounts[participant.categorie]++;
      }
    });

    // Si nous avons des catégories prédéfinies, les utiliser directement
    if (Object.keys(categoryCounts).length > 0) {
      // Créer un groupe pour chaque catégorie prédéfinie
      for (const categoryName in categoryCounts) {
        if (categoryCounts[categoryName] < 3) {
          continue;
        }

        // Extraire les informations de la catégorie (format: "gender-ageCat-weightCat")
        const parts = categoryName.split("-");
        if (parts.length < 3) {
          continue;
        }

        const gender = parts[0];
        const ageCatName = parts[1];
        const weightCatName = parts.slice(2).join("-"); // En cas de tiret dans le nom de la catégorie de poids

        // Trouver la catégorie d'âge correspondante
        const ageCategory = config.ageCategories.find(
          (cat) => cat.name === ageCatName
        );
        if (!ageCategory) {
          continue;
        }

        // Trouver la catégorie de poids correspondante
        const weightCategory = config.weightCategories[gender]?.find(
          (cat) => cat.name === weightCatName
        );
        if (!weightCategory) {
          continue;
        }

        // Filtrer les participants pour cette catégorie
        const categoryParticipants = participants.filter(
          (p) => p.categorie === categoryName
        );

        // Créer le groupe avec la taille de poule configurée
        try {
          const group = createGroupWithFixedPoolSize(
            gender,
            ageCategory,
            weightCategory,
            categoryParticipants,
            config.poolSize
          );

          if (group.pools.length > 0) {
            groups.push(group);
            stats.totalPools += group.pools.length;
          } else {
            stats.unusedParticipants += categoryParticipants.length;
          }
        } catch (error) {
          stats.unusedParticipants += categoryParticipants.length;
        }
      }

      if (groups.length > 0) {
        // Compter les participants qui ont été assignés à un groupe
        const usedParticipantIds = new Set();
        groups.forEach((group) => {
          group.pools.forEach((pool) => {
            pool.forEach((participantId) => {
              usedParticipantIds.add(participantId);
            });
          });
        });

        stats.unusedParticipants =
          participants.length - usedParticipantIds.size;

        // Collecter les informations sur les participants non utilisés
        const usedIds = new Set();
        groups.forEach((group) => {
          group.pools.forEach((pool) => {
            pool.forEach((id) => usedIds.add(id));
          });
        });

        const unusedParticipants = participants.filter(
          (p) => !usedIds.has(p.id)
        );

        // Regrouper par catégorie pour l'analyse
        const unusedByCategory = {};

        unusedParticipants.forEach((p) => {
          // Déterminer la catégorie théorique du participant
          let sexe = p.sexe;

          // Trouver la catégorie d'âge
          let ageCategory = null;
          if (config.ageCategories) {
            ageCategory = config.ageCategories.find(
              (cat) => p.age >= cat.min && p.age <= cat.max
            );
          }

          // Trouver la catégorie de poids
          let weightCategories = [];

          // Convertir les catégories de poids du format string vers le format objet
          const convertWeightCategories = (categoriesArray) => {
            if (!categoriesArray) return [];
            return categoriesArray.map((category) => {
              // Si category est déjà un objet avec une propriété 'name'
              if (typeof category === "object" && category.name) {
                return {
                  max: category.name.startsWith("+")
                    ? 999
                    : parseInt(category.name.replace(/[^0-9]/g, ""), 10),
                  name: category.name,
                };
              }

              // Sinon, c'est une chaîne (ancien format)
              const isPlus = category.startsWith("+");
              const weight = parseInt(category.replace(/[^0-9]/g, ""), 10);

              return {
                max: isPlus ? 999 : weight,
                name: category,
              };
            });
          };

          // Déterminer les catégories de poids selon l'âge du participant
          const ageCategoryName = ageCategory.name.toUpperCase();

          if (sexe === "male" && KYORUGI_CATEGORIES.MALE[ageCategoryName]) {
            weightCategories = convertWeightCategories(
              KYORUGI_CATEGORIES.MALE[ageCategoryName]
            );
            console.log(
              `🎯 ${p.prenom} ${
                p.nom
              } (${ageCategoryName} ${sexe}) → Catégories: ${weightCategories
                .map((c) => c.name)
                .join(", ")}`
            );
          } else if (
            sexe === "female" &&
            KYORUGI_CATEGORIES.FEMALE[ageCategoryName]
          ) {
            weightCategories = convertWeightCategories(
              KYORUGI_CATEGORIES.FEMALE[ageCategoryName]
            );
            console.log(
              `🎯 ${p.prenom} ${
                p.nom
              } (${ageCategoryName} ${sexe}) → Catégories: ${weightCategories
                .map((c) => c.name)
                .join(", ")}`
            );
          } else {
            // Fallback: utiliser les catégories de la configuration générale
            weightCategories = config.weightCategories[sexe] || [];
            console.log(
              `⚠️ ${p.prenom} ${p.nom} (${ageCategoryName} ${sexe}) → Fallback config générale`
            );
          }

          // CORRECTION: Trouver la catégorie de poids la plus appropriée
          // Au lieu de prendre la première catégorie où poids <= cat.max,
          // on trouve la catégorie avec le plus petit max qui soit >= au poids du participant
          const weightCategory = weightCategories
            .filter((cat) => p.poids <= cat.max) // Catégories possibles
            .sort((a, b) => a.max - b.max) // Trier par max croissant
            .find(() => true); // Prendre la première (plus petite max qui convient)

          let categoryKey = "Sans catégorie";

          if (ageCategory && weightCategories.length > 0) {
            categoryKey = `${sexe}-${ageCategory.name}-${weightCategories[0].name}`;
          }

          if (!unusedByCategory[categoryKey]) {
            unusedByCategory[categoryKey] = [];
          }

          unusedByCategory[categoryKey].push({
            id: p.id,
            nom: p.nom,
            prenom: p.prenom,
            sexe: p.sexe,
            age: p.age,
            poids: p.poids,
          });
        });

        // Stocker les informations diagnostiques pour l'affichage final
        diagnosticInfo.unusedParticipants = unusedParticipants;
        diagnosticInfo.unusedByCategory = unusedByCategory;

        return { groups, stats };
      }
    }

    // Si on arrive ici, c'est que les catégories prédéfinies n'ont pas fonctionné
    // On utilise la méthode standard de catégorisation

    // Catégoriser les participants
    const categories = categorizeParticipants(participants, config);

    // Créer un Set pour suivre les participants déjà utilisés
    const usedParticipantIds = new Set();

    // Liste des IDs de participants existants - utilisé pour la validation
    const existingParticipantIds = new Set(validParticipants.map((p) => p.id));

    // Vérifier combien de participants ont des IDs générés temporairement
    if (diagnosticInfo.tempIds > 0) {
    }

    for (const gender of ["male", "female"]) {
      const weightCategories = config.weightCategories[gender] || [];
      if (weightCategories.length === 0) {
      }

      for (const ageCategory of config.ageCategories) {
        for (const weightCategory of weightCategories) {
          const key = `${gender}-${ageCategory.name}-${weightCategory.name}`;
          let categoryParticipants = categories[key] || [];

          // Filtrer les participants déjà utilisés
          categoryParticipants = categoryParticipants.filter(
            (p) => !usedParticipantIds.has(p.id)
          );

          // Ne créer un groupe que s'il y a suffisamment de participants pour former au moins une poule minimale
          if (categoryParticipants.length >= 3) {
            try {
              // Forcer la taille des poules à respecter la configuration
              const group = createGroupWithFixedPoolSize(
                gender,
                ageCategory,
                weightCategory,
                categoryParticipants,
                config.poolSize
              );

              stats.totalPools += group.pools.length;

              // Vérifier que les poules ont été créées correctement
              if (group.pools.length === 0) {
                stats.unusedParticipants += categoryParticipants.length;
              } else {
                group.pools.forEach((pool) => {
                  pool.forEach((participantId) => {
                    usedParticipantIds.add(participantId);
                  });
                });

                groups.push(group);
              }
            } catch (error) {
              stats.unusedParticipants += categoryParticipants.length;
            }
          } else {
            // Pas assez de participants pour cette catégorie
            stats.unusedParticipants += categoryParticipants.length;
          }
        }
      }
    }

    // Compter le nombre total de participants non utilisés
    stats.unusedParticipants = participants.length - usedParticipantIds.size;

    return { groups, stats };
  } catch (error) {
    return { groups: [], stats: { totalPools: 0, unusedParticipants: 0 } };
  }
};

/**
 * Catégorise les participants selon le sexe, l'âge et le poids
 * @param {Array} participants - Liste des participants
 * @param {Object} config - Configuration du tournoi
 * @returns {Object} - Participants catégorisés
 */
const categorizeParticipants = (participants, config) => {
  const categories = {};
  const unknownGenderParticipants = [];

  // NOUVEAU: Logs de diagnostic pour comprendre les catégorisations
  console.log(
    `\n🔍 DÉBUT CATÉGORISATION - ${participants.length} participants`
  );
  console.log(
    `Configuration des catégories d'âge:`,
    config.ageCategories?.map((c) => `${c.name} (${c.min}-${c.max} ans)`)
  );
  console.log(
    `Configuration catégories poids MALE:`,
    config.weightCategories?.male?.map((c) => `${c.name} (max: ${c.max}kg)`)
  );
  console.log(
    `Configuration catégories poids FEMALE:`,
    config.weightCategories?.female?.map((c) => `${c.name} (max: ${c.max}kg)`)
  );

  // Premier passage pour collecter les participants avec sexe inconnu
  participants.forEach((participant) => {
    if (participant.sexe !== "male" && participant.sexe !== "female") {
      unknownGenderParticipants.push(participant);
    }
  });

  // Traitement des participants
  participants.forEach((participant) => {
    // Corriger le sexe si "unknown"
    let sexe = participant.sexe;

    if (sexe !== "male" && sexe !== "female") {
      // 1. Vérifier si la catégorie est indiquée dans le JSON
      if (participant.categorie && typeof participant.categorie === "string") {
        const lowerCategorie = participant.categorie.toLowerCase();
        if (
          lowerCategorie.startsWith("female-") ||
          lowerCategorie.startsWith("f-")
        ) {
          sexe = "female";
        } else if (
          lowerCategorie.startsWith("male-") ||
          lowerCategorie.startsWith("m-")
        ) {
          sexe = "male";
        }
      }

      // 2. Si toujours inconnu, tenter de déterminer par le nom
      if (sexe !== "male" && sexe !== "female") {
        // Cette méthode est approximative et devrait être améliorée
        const isFemaleByName =
          participant.prenom &&
          (participant.prenom.toLowerCase().endsWith("a") ||
            participant.prenom.toLowerCase().endsWith("e"));

        // 3. Sinon déterminer par le poids
        const isFemaleByWeight = participant.poids < 30; // Heuristique simple

        // Privilégier l'heuristique de nom, puis celle du poids
        sexe = isFemaleByName ? "female" : isFemaleByWeight ? "female" : "male";
      }

      // Mettre à jour le sexe du participant pour les étapes ultérieures
      participant.sexe = sexe;
    }

    // Déterminer la catégorie d'âge
    let ageCategory;

    // PRIORITÉ 1: Si le participant a une catégorie complète (ex: "male-Benjamin--24kg"), extraire l'âge de là
    if (participant.categorie && typeof participant.categorie === "string") {
      const parts = participant.categorie.split("-");
      if (parts.length >= 3) {
        const ageCatFromCategory = parts[1]; // Le deuxième élément est la catégorie d'âge
        ageCategory = config.ageCategories.find(
          (cat) => cat.name.toLowerCase() === ageCatFromCategory.toLowerCase()
        );

        if (ageCategory) {
          console.log(
            `🎯 PRIORITÉ CSV: ${participant.prenom} ${participant.nom} → Catégorie d'âge extraite de 'categorie': ${ageCategory.name}`
          );
        }
      }
    }

    // PRIORITÉ 2: Si le participant a une catégorie d'âge prédéfinie directement (par exemple "Benjamin")
    if (!ageCategory && participant.ageCategory) {
      ageCategory = config.ageCategories.find(
        (cat) =>
          cat.name.toLowerCase() === participant.ageCategory.toLowerCase()
      );

      if (ageCategory) {
        console.log(
          `🎯 PRIORITÉ AGECATEGORY: ${participant.prenom} ${participant.nom} → Catégorie d'âge directe: ${ageCategory.name}`
        );
      }
    }

    // PRIORITÉ 3: Si pas de catégorie trouvée et que le participant a une année de naissance
    if (!ageCategory && participant.birthYear) {
      const birthYear = participant.birthYear;

      // Obtenir les catégories d'âge pour la saison actuelle
      const categories = getCurrentSeasonCategories();

      // Déterminer la catégorie en fonction de l'année de naissance
      if (categories.benjamin.includes(birthYear)) {
        ageCategory = config.ageCategories.find(
          (cat) => cat.name.toLowerCase() === "benjamin"
        );
      } else if (categories.minime.includes(birthYear)) {
        ageCategory = config.ageCategories.find(
          (cat) => cat.name.toLowerCase() === "minime"
        );
      } else if (categories.cadet.includes(birthYear)) {
        ageCategory = config.ageCategories.find(
          (cat) => cat.name.toLowerCase() === "cadet"
        );
      } else if (categories.junior.includes(birthYear)) {
        ageCategory = config.ageCategories.find(
          (cat) => cat.name.toLowerCase() === "junior"
        );
      } else if (birthYear <= categories.seniorThreshold) {
        ageCategory = config.ageCategories.find(
          (cat) => cat.name.toLowerCase() === "senior"
        );
      }

      if (ageCategory) {
        console.log(
          `📅 CALCUL NAISSANCE: ${participant.prenom} ${participant.nom} → Catégorie d'âge calculée par année: ${ageCategory.name}`
        );
      }
    }

    // PRIORITÉ 4: Si toujours pas de catégorie, revenir à la méthode basée sur l'âge calculé
    if (!ageCategory) {
      ageCategory = config.ageCategories.find(
        (cat) => participant.age >= cat.min && participant.age <= cat.max
      );

      if (ageCategory) {
        console.log(
          `🔢 CALCUL ÂGE: ${participant.prenom} ${participant.nom} → Catégorie d'âge calculée par âge: ${ageCategory.name}`
        );
      }
    }

    if (!ageCategory) {
      return;
    }

    // Déterminer la catégorie de poids
    // CORRECTION: Utiliser les catégories de poids selon l'âge du participant
    let weightCategories = [];

    // Convertir les catégories de poids du format string vers le format objet
    const convertWeightCategories = (categoriesArray) => {
      if (!categoriesArray) return [];
      return categoriesArray.map((category) => {
        // Si category est déjà un objet avec une propriété 'name'
        if (typeof category === "object" && category.name) {
          return {
            max: category.name.startsWith("+")
              ? 999
              : parseInt(category.name.replace(/[^0-9]/g, ""), 10),
            name: category.name,
          };
        }

        // Sinon, c'est une chaîne (ancien format)
        const isPlus = category.startsWith("+");
        const weight = parseInt(category.replace(/[^0-9]/g, ""), 10);

        return {
          max: isPlus ? 999 : weight,
          name: category,
        };
      });
    };

    // Déterminer les catégories de poids selon l'âge du participant
    const ageCategoryName = ageCategory.name.toUpperCase();

    if (sexe === "male" && KYORUGI_CATEGORIES.MALE[ageCategoryName]) {
      weightCategories = convertWeightCategories(
        KYORUGI_CATEGORIES.MALE[ageCategoryName]
      );
      console.log(
        `🎯 ${participant.prenom} ${
          participant.nom
        } (${ageCategoryName} ${sexe}) → Catégories: ${weightCategories
          .map((c) => c.name)
          .join(", ")}`
      );
    } else if (
      sexe === "female" &&
      KYORUGI_CATEGORIES.FEMALE[ageCategoryName]
    ) {
      weightCategories = convertWeightCategories(
        KYORUGI_CATEGORIES.FEMALE[ageCategoryName]
      );
      console.log(
        `🎯 ${participant.prenom} ${
          participant.nom
        } (${ageCategoryName} ${sexe}) → Catégories: ${weightCategories
          .map((c) => c.name)
          .join(", ")}`
      );
    } else {
      // Fallback: utiliser les catégories de la configuration générale
      weightCategories = config.weightCategories[sexe] || [];
      console.log(
        `⚠️ ${participant.prenom} ${participant.nom} (${ageCategoryName} ${sexe}) → Fallback config générale`
      );
    }

    // CORRECTION: Trouver la catégorie de poids la plus appropriée
    // Au lieu de prendre la première catégorie où poids <= cat.max,
    // on trouve la catégorie avec le plus petit max qui soit >= au poids du participant
    const weightCategory = weightCategories
      .filter((cat) => participant.poids <= cat.max) // Catégories possibles
      .sort((a, b) => a.max - b.max) // Trier par max croissant
      .find(() => true); // Prendre la première (plus petite max qui convient)

    if (!weightCategory) {
      console.log(
        `❌ Aucune catégorie de poids trouvée pour ${participant.prenom} ${participant.nom} (${participant.poids}kg, ${sexe})`
      );
      console.log(
        `Catégories disponibles pour ${sexe}:`,
        weightCategories.map((c) => `${c.name} (max: ${c.max}kg)`)
      );
      return;
    }

    console.log(
      `✅ Participant ${participant.prenom} ${participant.nom} (${participant.poids}kg) → Catégorie: ${weightCategory.name} (max: ${weightCategory.max}kg)`
    );

    // Créer la clé de catégorie
    const key = `${sexe}-${ageCategory.name}-${weightCategory.name}`;

    // Ajouter le participant à sa catégorie
    if (!categories[key]) {
      categories[key] = [];
    }

    categories[key].push(participant);
  });

  // Collecter les participants non catégorisés
  const allCategorizedParticipantIds = new Set();

  for (const key in categories) {
    categories[key].forEach((p) => {
      if (p && p.id) {
        allCategorizedParticipantIds.add(p.id);
      }
    });
  }

  // Trouver les participants non catégorisés
  const diagnosticInfo = {
    categories: categories,
    uncategorizedParticipants: [],
  };

  diagnosticInfo.uncategorizedParticipants = participants
    .filter((p) => !allCategorizedParticipantIds.has(p.id))
    .map((p) => {
      const issues = [];

      // Vérifier l'âge
      if (config.ageCategories) {
        const matchingAgeCat = config.ageCategories.find(
          (cat) => p.age >= cat.min && p.age <= cat.max
        );
        if (!matchingAgeCat) {
          issues.push(`âge ${p.age} hors des catégories définies`);
        }
      } else {
        issues.push("pas de catégories d'âge définies");
      }

      // Vérifier le poids
      if (p.sexe === "male" || p.sexe === "female") {
        const weightCats = config.weightCategories[p.sexe] || [];
        const matchingWeightCat = weightCats.find((cat) => p.poids <= cat.max);
        if (!matchingWeightCat) {
          issues.push(
            `poids ${p.poids}kg hors des catégories définies pour ${p.sexe}`
          );
        }
      } else {
        issues.push(
          `genre "${p.sexe}" non reconnu (doit être "male" ou "female")`
        );
      }

      return {
        id: p.id,
        nom: p.nom,
        prenom: p.prenom,
        sexe: p.sexe,
        age: p.age,
        poids: p.poids,
        issues: issues,
      };
    });

  // NOUVEAU: Fonction utilitaire pour afficher un résumé des catégories
  const logCategorizationSummary = (categories) => {
    console.log(`\n📊 RÉSUMÉ CATÉGORISATION`);
    console.log(
      `Nombre de catégories créées: ${Object.keys(categories).length}`
    );

    Object.keys(categories).forEach((categoryKey) => {
      const participants = categories[categoryKey];
      console.log(
        `\n📂 Catégorie: ${categoryKey} (${participants.length} participants)`
      );

      // Afficher les détails des participants pour debug
      participants.forEach((p, index) => {
        console.log(
          `  ${index + 1}. ${p.prenom} ${p.nom} - ${p.age} ans, ${p.poids}kg, ${
            p.sexe
          }`
        );
      });

      // Statistiques de poids dans cette catégorie
      const poids = participants.map((p) => p.poids).sort((a, b) => a - b);
      console.log(
        `  💪 Poids: min=${poids[0]}kg, max=${poids[poids.length - 1]}kg`
      );
    });

    console.log(`📊 FIN RÉSUMÉ CATÉGORISATION\n`);
  };

  // Afficher le résumé avant de retourner
  logCategorizationSummary(categories);

  return categories;
};

/**
 * Crée un groupe avec des poules de taille fixe
 * @param {string} gender - Genre (male/female)
 * @param {Object} ageCategory - Catégorie d'âge
 * @param {Object} weightCategory - Catégorie de poids
 * @param {Array} participants - Liste des participants
 * @param {number} targetPoolSize - Taille cible des poules
 * @returns {Object} - Groupe créé avec ses poules
 */
const createGroupWithFixedPoolSize = (
  gender,
  ageCategory,
  weightCategory,
  participants,
  targetPoolSize
) => {
  try {
    // Création de l'objet groupe
    const group = {
      id: uuidv4(),
      gender,
      ageCategory: {
        ...ageCategory,
      },
      weightCategory: {
        ...weightCategory,
      },
      participants,
      pools: [],
    };

    // Valider les paramètres
    const validAgeCategory = {
      name: "Default",
      min: 0,
      max: 99,
      ...ageCategory,
    };
    const validWeightCategory = {
      name: "Default",
      max: 999,
      ...weightCategory,
    };

    // S'assurer que group.ageCategory et group.weightCategory sont définis
    group.ageCategory = validAgeCategory;
    group.weightCategory = validWeightCategory;
    group.pools = [];

    // Vérifier s'il y a des participants
    if (!participants || participants.length === 0) {
      return group;
    }

    // CORRECTION: S'assurer que tous les participants ont des IDs valides
    const validParticipants = participants.filter((p) => {
      if (!p) {
        return false;
      }

      // Vérifie si l'ID existe
      if (!p.id) {
        p.id = `temp_${p.nom}_${p.prenom}_${p.poids}_${Math.random()
          .toString(36)
          .substring(2, 10)}`;
        return true; // Maintenant on inclut ce participant avec l'ID temporaire
      }
      return true;
    });

    // Si pas assez de participants pour une poule valide (minimum 3)
    if (validParticipants.length < 3) {
      return group;
    }

    // Utiliser la nouvelle fonction createBalancedPool qui renvoie un tableau de poules
    const poolsArray = createBalancedPool(validParticipants, targetPoolSize);

    // CORRECTION: Maintenant poolsArray est toujours un tableau de tableaux
    // On peut l'assigner directement aux pools du groupe
    if (Array.isArray(poolsArray) && poolsArray.length > 0) {
      group.pools = poolsArray;
    }

    return group;
  } catch (error) {
    console.error("Erreur dans createGroupWithFixedPoolSize:", error);
    return {
      id: uuidv4(),
      gender: gender || "unknown",
      ageCategory: ageCategory || { name: "Default", min: 0, max: 99 },
      weightCategory: weightCategory || { name: "Default", max: 999 },
      participants: participants || [],
      pools: [],
    };
  }
};

/**
 * Crée une répartition équilibrée des participants en poules en évitant les athlètes de la même ligue
 * @param {Array} participants - Liste des participants disponibles
 * @param {number} targetPoolSize - Taille cible des poules
 * @returns {Array} - Poules créées (tableau de tableaux d'IDs de participants)
 */
const createBalancedPool = (participants, targetPoolSize) => {
  try {
    // Validation des paramètres
    if (!Array.isArray(participants)) {
      return [];
    }

    if (typeof targetPoolSize !== "number" || targetPoolSize <= 0) {
      targetPoolSize = Math.min(participants.length, 8);
    }

    // CORRECTION: Faire une copie de la liste des participants avec seulement ceux qui ont un ID valide
    const validParticipants = participants.filter((p) => p && p.id);

    // Si pas assez de participants, renvoyer une seule poule avec tous les participants
    if (validParticipants.length <= targetPoolSize) {
      return [validParticipants.map((p) => p.id)]; // Renvoyer un tableau contenant une poule
    }

    // Calculer le nombre de poules nécessaires
    const numPools = Math.ceil(validParticipants.length / targetPoolSize);

    // Initialiser les poules vides
    const pools = Array.from({ length: numPools }, () => []);

    // Regrouper les participants par ligue
    const participantsByLigue = {};
    validParticipants.forEach((participant) => {
      const ligue = participant.ligue || "Inconnue";
      if (!participantsByLigue[ligue]) {
        participantsByLigue[ligue] = [];
      }
      participantsByLigue[ligue].push(participant);
    });

    // Trier les ligues par nombre de participants (de la plus nombreuse à la moins nombreuse)
    const sortedLigues = Object.keys(participantsByLigue).sort(
      (a, b) => participantsByLigue[b].length - participantsByLigue[a].length
    );

    // Liste pour stocker les participants non encore placés
    let remainingParticipants = [];

    // Première phase: distribuer un participant de chaque ligue dans chaque poule
    sortedLigues.forEach((ligue) => {
      const ligueParticipants = [...participantsByLigue[ligue]]; // Copie pour ne pas modifier l'original

      // Distribuer un participant par poule
      pools.forEach((pool, poolIndex) => {
        if (ligueParticipants.length > 0 && pool.length < targetPoolSize) {
          const participant = ligueParticipants.shift(); // Retirer le premier participant
          pool.push(participant.id);
        }
      });

      // Ajouter les participants restants à la liste des restants
      remainingParticipants = remainingParticipants.concat(ligueParticipants);
    });

    // Deuxième phase: placer les participants restants dans les poules les plus appropriées
    remainingParticipants.forEach((participant) => {
      // Trouver la poule avec le moins de participants de cette ligue
      const ligue = participant.ligue || "Inconnue";

      let bestPoolIndex = 0;
      let minSameLigue = Infinity;
      let minPoolSize = Infinity;

      pools.forEach((pool, poolIndex) => {
        // Ne considérer que les poules qui ne sont pas pleines
        if (pool.length < targetPoolSize) {
          // Compter combien de participants de la même ligue sont déjà dans cette poule
          const sameLigueCount = pool.reduce((count, participantId) => {
            const poolParticipant = validParticipants.find(
              (p) => p.id === participantId
            );
            return poolParticipant &&
              (poolParticipant.ligue || "Inconnue") === ligue
              ? count + 1
              : count;
          }, 0);

          // Meilleure poule = moins de participants de même ligue, puis moins remplie
          if (
            sameLigueCount < minSameLigue ||
            (sameLigueCount === minSameLigue && pool.length < minPoolSize)
          ) {
            minSameLigue = sameLigueCount;
            minPoolSize = pool.length;
            bestPoolIndex = poolIndex;
          }
        }
      });

      // Si toutes les poules sont pleines, créer une nouvelle poule
      if (pools[bestPoolIndex].length >= targetPoolSize) {
        pools.push([participant.id]);
      } else {
        pools[bestPoolIndex].push(participant.id);
      }
    });

    // Équilibrer les poules si nécessaire
    const minParticipantsPerPool = 3; // Minimum pour qu'une poule soit valide

    // Fusionner les poules trop petites si nécessaire
    const validPools = pools.filter(
      (pool) => pool.length >= minParticipantsPerPool
    );
    const smallPools = pools.filter(
      (pool) => pool.length > 0 && pool.length < minParticipantsPerPool
    );

    // Si des poules sont trop petites, redistribuer leurs participants
    if (smallPools.length > 0) {
      // Aplatir les petites poules
      const participantsToRedistribute = [].concat(...smallPools);

      // MODIFICATION: Améliorer la redistribution pour équilibrer les tailles des poules
      participantsToRedistribute.forEach((participantId) => {
        const participant = validParticipants.find(
          (p) => p.id === participantId
        );
        if (!participant) return;

        const ligue = participant.ligue || "Inconnue";

        // Trouver la poule avec:
        // 1) Le moins de participants de la même ligue
        // 2) La plus petite taille actuelle
        let bestPoolIndex = 0;
        let minSameLigue = Infinity;
        let minPoolSize = Infinity;

        validPools.forEach((pool, poolIndex) => {
          // Compter les participants de la même ligue dans cette poule
          const sameLigueCount = pool.reduce((count, id) => {
            const poolParticipant = validParticipants.find((p) => p.id === id);
            return poolParticipant &&
              (poolParticipant.ligue || "Inconnue") === ligue
              ? count + 1
              : count;
          }, 0);

          // Priorité à l'équilibre des tailles de poules, puis à l'évitement des participants de même ligue
          if (
            pool.length < minPoolSize ||
            (pool.length === minPoolSize && sameLigueCount < minSameLigue)
          ) {
            minPoolSize = pool.length;
            minSameLigue = sameLigueCount;
            bestPoolIndex = poolIndex;
          }
        });

        validPools[bestPoolIndex].push(participantId);
      });
    }

    // CORRECTION: Renvoyer toutes les poules valides, pas juste la première
    return validPools.length > 0
      ? validPools // Renvoyer toutes les poules valides
      : [validParticipants.map((p) => p.id)]; // Renvoyer un tableau contenant une poule
  } catch (error) {
    console.error("Erreur dans createBalancedPool:", error);
    // Renvoyer un tableau contenant une poule avec tous les participants
    return [
      participants
        .slice(0, Math.min(targetPoolSize, participants.length))
        .map((p) => p.id),
    ];
  }
};

/**
 * Crée des groupes pour l'élimination directe (avec UNE poule par groupe)
 * @param {Array} participants - Liste des participants
 * @param {Object} config - Configuration du tournoi
 * @returns {Object} - Groupes créés avec une poule unique par groupe
 */
const createGroupsForElimination = (participants, config) => {
  try {
    const groups = [];
    const stats = {
      totalGroups: 0,
      totalPools: 0, // Comme pour les poules normales
      unusedParticipants: 0,
    };

    // Valider les participants (exactement comme dans createGroups)
    const validParticipants = participants.filter((p) => {
      if (!p) {
        return false;
      }

      // Générer un ID temporaire si nécessaire
      if (!p.id) {
        p.id = `temp_${p.nom}_${p.prenom}_${p.poids}_${Math.random()
          .toString(36)
          .substring(2, 10)}`;
      }
      return true;
    });

    if (validParticipants.length === 0 || !config) {
      return { groups: [], stats };
    }

    // Utiliser exactement la même logique de catégorisation que les poules
    const categories = categorizeParticipants(validParticipants, config);

    // Créer un Set pour suivre les participants déjà utilisés
    const usedParticipantIds = new Set();

    // Utiliser exactement la même boucle que dans createGroups
    for (const gender of ["male", "female"]) {
      const weightCategories = config.weightCategories[gender] || [];
      if (weightCategories.length === 0) {
        continue;
      }

      for (const ageCategory of config.ageCategories) {
        for (const weightCategory of weightCategories) {
          const key = `${gender}-${ageCategory.name}-${weightCategory.name}`;
          let categoryParticipants = categories[key] || [];

          // Filtrer les participants déjà utilisés
          categoryParticipants = categoryParticipants.filter(
            (p) => !usedParticipantIds.has(p.id)
          );

          // Minimum 2 participants pour un bracket d'élimination
          if (categoryParticipants.length >= 2) {
            try {
              // CORRECTION: Créer le groupe avec UNE seule poule contenant TOUS les participants
              // Exactement comme pour les poules normales, mais avec une seule poule
              const group = {
                id: uuidv4(),
                gender,
                ageCategory: {
                  ...ageCategory,
                },
                weightCategory: {
                  ...weightCategory,
                },
                participants: categoryParticipants,
                // NOUVELLE LOGIQUE: Créer UNE seule poule avec tous les participants
                pools: [categoryParticipants.map((p) => p.id)], // Une seule poule avec tous les IDs des participants
                type: "elimination", // Marquer comme groupe d'élimination
              };

              // Marquer les participants comme utilisés
              categoryParticipants.forEach((participant) => {
                usedParticipantIds.add(participant.id);
              });

              groups.push(group);
              stats.totalGroups++;
              stats.totalPools++; // Une poule par groupe
            } catch (error) {
              console.error(
                `Erreur lors de la création du groupe ${key}:`,
                error
              );
              stats.unusedParticipants += categoryParticipants.length;
            }
          } else {
            // Pas assez de participants pour cette catégorie
            stats.unusedParticipants += categoryParticipants.length;
          }
        }
      }
    }

    // Compter le nombre total de participants non utilisés
    stats.unusedParticipants =
      validParticipants.length - usedParticipantIds.size;

    console.log(
      `Groupes d'élimination créés: ${groups.length} groupes, ${stats.totalPools} poules (une par groupe), ${stats.unusedParticipants} participants non utilisés`
    );

    // Log pour vérifier le format des groupes créés
    if (groups.length > 0) {
      console.log("Format du premier groupe d'élimination:", {
        id: groups[0].id,
        gender: groups[0].gender,
        ageCategory: groups[0].ageCategory,
        weightCategory: groups[0].weightCategory,
        participantsCount: groups[0].participants.length,
        poolsCount: groups[0].pools.length,
        poolSize: groups[0].pools[0]?.length || 0,
        type: groups[0].type,
      });
    }

    return { groups, stats };
  } catch (error) {
    console.error(
      "Erreur lors de la création des groupes d'élimination:",
      error
    );
    return {
      groups: [],
      stats: {
        totalGroups: 0,
        totalPools: 0,
        unusedParticipants: participants.length,
      },
    };
  }
};

// Exporter la fonction nommée pour compatibilité rétroactive
export { categorizeParticipants, createGroups, createGroupsForElimination };

// Exporter comme export par défaut pour être compatible avec les imports existants
export default createGroups;
