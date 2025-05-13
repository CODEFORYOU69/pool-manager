import { v4 as uuidv4 } from "uuid";

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
          let weightCategory = null;
          if (sexe === "male" || sexe === "female") {
            const weightCats = config.weightCategories[sexe] || [];
            weightCategory = weightCats.find((cat) => p.poids <= cat.max);
          }

          let categoryKey = "Sans catégorie";

          if (ageCategory && weightCategory) {
            categoryKey = `${sexe}-${ageCategory.name}-${weightCategory.name}`;
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

    // Si le participant a une catégorie d'âge prédéfinie (par exemple "Benjamin")
    if (participant.ageCategory) {
      ageCategory = config.ageCategories.find(
        (cat) =>
          cat.name.toLowerCase() === participant.ageCategory.toLowerCase()
      );
    }

    // Si pas de catégorie trouvée et que le participant a une année de naissance
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
    }

    // Si toujours pas de catégorie, revenir à la méthode basée sur l'âge calculé
    if (!ageCategory) {
      ageCategory = config.ageCategories.find(
        (cat) => participant.age >= cat.min && participant.age <= cat.max
      );
    }

    if (!ageCategory) {
      return;
    }

    // Déterminer la catégorie de poids
    const weightCategories = config.weightCategories[sexe] || [];
    const weightCategory = weightCategories.find(
      (cat) => participant.poids <= cat.max
    );

    if (!weightCategory) {
      return;
    }

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

  return categories;
};

/**
 * Crée un groupe avec des poules de taille fixe selon la configuration
 * @param {string} gender - Genre ('male' ou 'female')
 * @param {Object} ageCategory - Catégorie d'âge
 * @param {Object} weightCategory - Catégorie de poids
 * @param {Array} participants - Participants du groupe
 * @param {number} targetPoolSize - Taille cible des poules selon configuration
 * @returns {Object} - Groupe créé
 */
const createGroupWithFixedPoolSize = (
  gender,
  ageCategory,
  weightCategory,
  participants,
  targetPoolSize
) => {
  try {
    // Validation des paramètres
    if (!Array.isArray(participants)) {
      participants = [];
    }

    // Valider et utiliser la taille de poule configurée
    let poolSize = targetPoolSize;
    if (typeof targetPoolSize !== "number" || targetPoolSize <= 0) {
      poolSize = 4;
    }

    // S'assurer que ageCategory a les propriétés min et max
    let validAgeCategory = ageCategory || { name: "Default" };
    if (!validAgeCategory.min || typeof validAgeCategory.min !== "number") {
      validAgeCategory = { ...validAgeCategory, min: 0 };
    }
    if (!validAgeCategory.max || typeof validAgeCategory.max !== "number") {
      validAgeCategory = { ...validAgeCategory, max: 99 };
    }

    // S'assurer que weightCategory a la propriété max
    let validWeightCategory = weightCategory || { name: "Default" };
    if (
      !validWeightCategory.max ||
      typeof validWeightCategory.max !== "number"
    ) {
      validWeightCategory = { ...validWeightCategory, max: 999 };
    }

    const group = {
      id: uuidv4(),
      gender: gender || "unknown",
      ageCategory: validAgeCategory,
      weightCategory: validWeightCategory,
      participants,
      pools: [],
    };

    // Vérifier s'il y a des participants
    if (participants.length === 0) {
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

    if (validParticipants.length < participants.length) {
    }

    // CORRECTION: Copier uniquement les participants valides
    const participantsCopy = [...validParticipants];

    // Vérifier que tous les participants ont une ligue
    for (let i = 0; i < participantsCopy.length; i++) {
      if (!participantsCopy[i].ligue) {
        participantsCopy[i].ligue = "Inconnue";
      }
    }

    // Trier les participants par ligue pour faciliter la répartition
    participantsCopy.sort((a, b) => {
      if (!a.ligue && !b.ligue) return 0;
      if (!a.ligue) return 1;
      if (!b.ligue) return -1;
      return a.ligue.localeCompare(b.ligue);
    });

    // MODIFICATION IMPORTANTE: Diviser les participants en poules de taille fixe
    // Calculer combien de poules complètes peuvent être formées
    const numFullPools = Math.floor(participantsCopy.length / poolSize);
    const remainingParticipants = participantsCopy.length % poolSize;

    let numPools;
    let participantsPerPool;

    if (remainingParticipants === 0) {
      // Cas idéal: tous les participants peuvent être répartis équitablement
      numPools = numFullPools;
      participantsPerPool = poolSize;
    } else {
      // Cas avec reste: déterminer la meilleure stratégie de répartition
      if (remainingParticipants >= 3) {
        // Si le reste est suffisant pour former une poule valide (≥ 3)
        numPools = numFullPools + 1;
        participantsPerPool = poolSize; // Les poules régulières gardent leur taille
      } else {
        // Si le reste est trop petit (1 ou 2 participants)
        // IMPORTANT: Toujours garantir un minimum de 3 participants par poule

        // Cas spécial: si on a suffisamment de participants pour redistribuer
        if (numFullPools > 0) {
          // Répartir les participants restants dans les poules existantes pour les équilibrer
          numPools = numFullPools;
        } else if (participantsCopy.length >= 3) {
          // On a moins de 'poolSize' participants, mais au moins 3
          // Créer une seule poule avec tous les participants
          numPools = 1;
          participantsPerPool = participantsCopy.length;
        } else {
          // Cas d'erreur: moins de 3 participants au total
          // Ne devrait pas arriver car on vérifie auparavant qu'il y a au moins 3 participants
          numPools = 0;
          participantsPerPool = 0;
        }
      }
    }

    // Créer les poules selon la stratégie déterminée
    if (remainingParticipants >= 3 && remainingParticipants < poolSize) {
      // Cas spécial: poules régulières + une poule plus petite mais viable
      for (let poolIndex = 0; poolIndex < numFullPools; poolIndex++) {
        const startIndex = poolIndex * poolSize;
        const poolParticipants = participantsCopy.slice(
          startIndex,
          startIndex + poolSize
        );

        try {
          const pool = createBalancedPool(poolParticipants, poolSize);
          if (pool && pool.length > 0) {
            group.pools.push(pool);
          }
        } catch (error) {}
      }

      // Créer la dernière poule avec les participants restants
      const remainingParticipantsList = participantsCopy.slice(
        numFullPools * poolSize
      );
      try {
        const pool = createBalancedPool(
          remainingParticipantsList,
          remainingParticipants
        );
        if (pool && pool.length > 0) {
          group.pools.push(pool);
        }
      } catch (error) {}
    } else if (remainingParticipants === 0) {
      // Cas simple: poules de taille égale
      for (let poolIndex = 0; poolIndex < numPools; poolIndex++) {
        const startIndex = poolIndex * participantsPerPool;
        const endIndex = Math.min(
          startIndex + participantsPerPool,
          participantsCopy.length
        );
        const poolParticipants = participantsCopy.slice(startIndex, endIndex);

        try {
          const pool = createBalancedPool(
            poolParticipants,
            poolParticipants.length
          );
          if (pool && pool.length > 0) {
            group.pools.push(pool);
          }
        } catch (error) {}
      }
    } else {
      // Cas avec redistribution: poules de tailles légèrement différentes
      // Mais toujours avec au moins 3 participants par poule

      if (numPools === 1) {
        // Cas d'une seule poule avec tous les participants
        try {
          const pool = createBalancedPool(
            participantsCopy,
            participantsCopy.length
          );
          if (pool && pool.length > 0) {
            group.pools.push(pool);
          }
        } catch (error) {}
      } else {
        // Calculer la meilleure distribution pour des poules de taille similaire
        // Mais avec au moins 3 participants chacune
        const baseSize = Math.floor(participantsCopy.length / numPools);

        // Si baseSize < 3, on doit réduire le nombre de poules
        if (baseSize < 3) {
          // Recalculer le nombre de poules pour garantir au moins 3 participants par poule
          const maxPools = Math.floor(participantsCopy.length / 3);
          numPools = maxPools;
        }

        const numPoolsWithExtra = participantsCopy.length % numPools;

        let startIndex = 0;
        for (let poolIndex = 0; poolIndex < numPools; poolIndex++) {
          // Déterminer la taille de cette poule (certaines auront un participant de plus)
          const thisPoolSize =
            baseSize + (poolIndex < numPoolsWithExtra ? 1 : 0);

          // Vérification de sécurité
          if (thisPoolSize < 3) {
            continue;
          }

          const poolParticipants = participantsCopy.slice(
            startIndex,
            startIndex + thisPoolSize
          );
          startIndex += thisPoolSize;

          try {
            const pool = createBalancedPool(poolParticipants, thisPoolSize);
            if (pool && pool.length > 0) {
              group.pools.push(pool);
            }
          } catch (error) {}
        }

        // S'il reste des participants non assignés
        if (startIndex < participantsCopy.length) {
          const remainingUnassigned = participantsCopy.length - startIndex;

          // Les répartir dans les poules existantes
          if (group.pools.length > 0) {
            const remainingParticipantsList =
              participantsCopy.slice(startIndex);
            remainingParticipantsList.forEach((participant, index) => {
              const poolIndex = index % group.pools.length;
              // Ajouter à la poule correspondante
              if (participant && participant.id) {
                group.pools[poolIndex].push(participant.id);
              }
            });
          }
        }
      }
    }

    return group;
  } catch (error) {
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
 * Crée une poule équilibrée en évitant les athlètes de la même ligue
 * @param {Array} participants - Liste des participants disponibles
 * @param {number} poolSize - Taille de la poule
 * @returns {Array} - Poule créée (liste d'IDs de participants)
 */
const createBalancedPool = (participants, poolSize) => {
  try {
    // Validation des paramètres
    if (!Array.isArray(participants)) {
      return [];
    }

    if (typeof poolSize !== "number" || poolSize <= 0) {
      return participants
        .slice(0, Math.min(participants.length, 8))
        .map((p) => p.id);
    }

    const pool = [];
    const liguesInPool = new Set();

    // Limiter la taille de la poule au nombre de participants disponibles
    const effectivePoolSize = Math.min(poolSize, participants.length);

    if (effectivePoolSize <= 0) {
      return [];
    }

    // CORRECTION: Faire une copie de la liste des participants avec seulement ceux qui ont un ID valide
    const participantsCopy = [...participants].filter((p) => p && p.id);

    // Essayer d'éviter les athlètes de la même ligue
    let attempts = 0;
    const maxAttempts = 100; // Limite pour éviter une boucle infinie

    while (
      pool.length < effectivePoolSize &&
      participantsCopy.length > 0 &&
      attempts < maxAttempts
    ) {
      attempts++;

      // Parcourir les participants pour trouver le meilleur candidat
      let bestCandidateIndex = -1;
      let bestCandidateScore = -1;

      for (let i = 0; i < participantsCopy.length; i++) {
        const participant = participantsCopy[i];

        // Si la poule est vide, prendre n'importe quel participant
        if (pool.length === 0) {
          bestCandidateIndex = 0;
          break;
        }

        // Calculer un score pour ce candidat (plus élevé = meilleur)
        let score = 0;

        const participantLigue = participant.ligue || "Inconnue";

        // Bonus si la ligue n'est pas déjà dans la poule
        if (!liguesInPool.has(participantLigue)) {
          score += 10;
        } else {
          // Si la ligue est déjà présente, calculer combien de fois
          const ligueCount = pool.reduce((count, id) => {
            const poolParticipant = participants.find((p) => p && p.id === id);
            return poolParticipant && poolParticipant.ligue === participantLigue
              ? count + 1
              : count;
          }, 0);

          // Pénalité proportionnelle au nombre d'athlètes de cette ligue déjà dans la poule
          score -= ligueCount * 5;
        }

        // Mettre à jour le meilleur candidat si nécessaire
        if (score > bestCandidateScore) {
          bestCandidateScore = score;
          bestCandidateIndex = i;
        }
      }

      // Si on a trouvé un candidat
      if (
        bestCandidateIndex >= 0 &&
        bestCandidateIndex < participantsCopy.length
      ) {
        const selectedParticipant = participantsCopy[bestCandidateIndex];

        // Vérifier que l'ID du participant est valide
        if (selectedParticipant.id) {
          pool.push(selectedParticipant.id);
          liguesInPool.add(selectedParticipant.ligue || "Inconnue");
        }

        // Supprimer le participant de la liste
        participantsCopy.splice(bestCandidateIndex, 1);
      } else {
        // Si on n'a pas trouvé de candidat, prendre le premier disponible
        if (participantsCopy.length > 0) {
          const selectedParticipant = participantsCopy[0];

          // Vérifier que l'ID du participant est valide
          if (selectedParticipant.id) {
            pool.push(selectedParticipant.id);
            liguesInPool.add(selectedParticipant.ligue || "Inconnue");
          }

          participantsCopy.splice(0, 1);
        } else {
          break;
        }
      }
    }

    if (attempts >= maxAttempts) {
    }

    return pool;
  } catch (error) {
    return participants
      .slice(0, Math.min(poolSize, participants.length))
      .map((p) => p.id);
  }
};

// Exporter la fonction nommée pour compatibilité rétroactive
export { createGroups };

// Exporter comme export par défaut pour être compatible avec les imports existants
export default createGroups;
