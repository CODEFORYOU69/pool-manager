import { v4 as uuidv4 } from "uuid";

/**
 * Crée des groupes à partir d'une liste de participants
 * @param {Array} participants - Liste des participants
 * @param {Object} config - Configuration du tournoi
 * @returns {Object} - Groupes créés et statistiques
 */
const createGroups = (participants, config) => {
  try {
    console.log(
      "Début de la création des groupes avec",
      participants.length,
      "participants"
    );
    const groups = [];
    const stats = {
      totalPools: 0,
      unusedParticipants: 0,
    };

    // Valider les participants dès le début pour les utiliser partout dans la fonction
    const validParticipants = participants.filter((p) => p && p.id);
    console.log(
      `${validParticipants.length} participants valides sur ${participants.length} identifiés`
    );

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

    console.log(
      `${diagnosticInfo.tempIds} participants avec IDs temporaires identifiés`
    );

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
      console.error("Liste de participants invalide");
      return { groups: [], stats };
    }

    if (!config) {
      console.error("Configuration invalide");
      return { groups: [], stats };
    }

    if (!config.ageCategories || !Array.isArray(config.ageCategories)) {
      console.error("Catégories d'âge invalides");
      return { groups: [], stats };
    }

    if (
      !config.weightCategories ||
      !config.weightCategories.male ||
      !config.weightCategories.female
    ) {
      console.error("Catégories de poids invalides");
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

    console.log(
      "Catégories détectées dans les données:",
      Object.keys(categoryCounts)
    );
    console.log("Nombre de participants par catégorie:", categoryCounts);

    // Si nous avons des catégories prédéfinies, les utiliser directement
    if (Object.keys(categoryCounts).length > 0) {
      // Créer un groupe pour chaque catégorie prédéfinie
      for (const categoryName in categoryCounts) {
        if (categoryCounts[categoryName] < 3) {
          console.warn(
            `Pas assez de participants pour la catégorie ${categoryName}: ${categoryCounts[categoryName]} (min 3)`
          );
          continue;
        }

        // Extraire les informations de la catégorie (format: "gender-ageCat-weightCat")
        const parts = categoryName.split("-");
        if (parts.length < 3) {
          console.warn(`Format de catégorie invalide: ${categoryName}`);
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
          console.warn(`Catégorie d'âge non trouvée: ${ageCatName}`);
          continue;
        }

        // Trouver la catégorie de poids correspondante
        const weightCategory = config.weightCategories[gender]?.find(
          (cat) => cat.name === weightCatName
        );
        if (!weightCategory) {
          console.warn(
            `Catégorie de poids non trouvée: ${gender}-${weightCatName}`
          );
          continue;
        }

        // Filtrer les participants pour cette catégorie
        const categoryParticipants = participants.filter(
          (p) => p.categorie === categoryName
        );
        console.log(
          `Catégorie ${categoryName}: ${categoryParticipants.length} participants`
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
            console.log(
              `Groupe ${categoryName} créé avec ${group.pools.length} poules`
            );
          } else {
            console.warn(`Aucune poule créée pour le groupe ${categoryName}`);
            stats.unusedParticipants += categoryParticipants.length;
          }
        } catch (error) {
          console.error(
            `Erreur lors de la création du groupe ${categoryName}:`,
            error
          );
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

        console.log(
          "Création des groupes terminée avec les catégories prédéfinies:",
          {
            nombreGroupes: groups.length,
            nombrePoules: stats.totalPools,
            participantsUtilisés: usedParticipantIds.size,
            participantsNonUtilisés: stats.unusedParticipants,
          }
        );

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

        // Affichage final de toutes les informations de diagnostic
        console.log("\n\n");
        console.log(
          "==============================================================="
        );
        console.log(
          "=== DIAGNOSTIC DÉTAILLÉ DE CRÉATION DES GROUPES ET POULES ==="
        );
        console.log(
          "==============================================================="
        );

        // 1. Résumé des statistiques
        console.log("\n=== RÉSUMÉ ===");
        console.log(`Nombre total de participants: ${participants.length}`);
        console.log(`Nombre de groupes créés: ${groups.length}`);
        console.log(`Nombre total de poules: ${stats.totalPools}`);
        console.log(
          `Participants utilisés: ${
            participants.length - stats.unusedParticipants
          } (${(
            ((participants.length - stats.unusedParticipants) /
              participants.length) *
            100
          ).toFixed(1)}%)`
        );
        console.log(
          `Participants non utilisés: ${stats.unusedParticipants} (${(
            (stats.unusedParticipants / participants.length) *
            100
          ).toFixed(1)}%)`
        );

        // 2. Catégories configurées
        console.log("\n=== CATÉGORIES CONFIGURÉES ===");

        console.log("\nCatégories d'âge:");
        if (diagnosticInfo.ageCategories.length > 0) {
          diagnosticInfo.ageCategories.forEach((cat) => {
            console.log(`  - ${cat}`);
          });
        } else {
          console.log("  ERREUR: Aucune catégorie d'âge configurée");
        }

        console.log("\nCatégories de poids masculines:");
        if (diagnosticInfo.weightCategoriesMale.length > 0) {
          diagnosticInfo.weightCategoriesMale.forEach((cat) => {
            console.log(`  - ${cat}`);
          });
        } else {
          console.log(
            "  ERREUR: Aucune catégorie de poids masculine configurée"
          );
        }

        console.log("\nCatégories de poids féminines:");
        if (diagnosticInfo.weightCategoriesFemale.length > 0) {
          diagnosticInfo.weightCategoriesFemale.forEach((cat) => {
            console.log(`  - ${cat}`);
          });
        } else {
          console.log(
            "  ERREUR: Aucune catégorie de poids féminine configurée"
          );
        }

        // 3. Participants non utilisés
        console.log("\n=== PARTICIPANTS NON UTILISÉS ===");

        if (unusedParticipants.length === 0) {
          console.log(
            "Aucun participant non utilisé, tous ont été placés dans des poules!"
          );
        } else {
          console.log(
            `${unusedParticipants.length} participants n'ont pas été placés dans des poules:`
          );

          // Afficher par catégorie
          for (const category in unusedByCategory) {
            const participants = unusedByCategory[category];
            console.log(
              `\nCatégorie ${category}: ${participants.length} participants`
            );

            // Expliquer la raison probable
            if (participants.length < 3) {
              console.log(
                `  Raison probable: Pas assez de participants dans cette catégorie (minimum 3 requis)`
              );
            }

            // Lister les participants
            participants.forEach((p) => {
              console.log(
                `  - ${p.nom} ${p.prenom} (ID: ${p.id || "N/A"}, Age: ${
                  p.age
                }, Poids: ${p.poids}kg, Genre: ${p.sexe})`
              );
            });
          }

          // Suggestions de correction
          console.log("\nSuggestions pour résoudre ce problème:");
          console.log(
            "1. Vérifiez que vos catégories de poids correspondent exactement à celles dans votre fichier CSV/Excel"
          );
          console.log(
            "2. Pour les catégories ayant moins de 3 participants, considérez de les fusionner avec des catégories proches"
          );
          console.log(
            "3. Si nécessaire, modifiez le code pour permettre des poules plus petites dans certains cas spécifiques"
          );
        }

        console.log(
          "\n==============================================================="
        );
        console.log("=== FIN DU DIAGNOSTIC ===");
        console.log(
          "\n===============================================================\n" +
            "=== FIN DU DIAGNOSTIC ===\n" +
            "===============================================================\n"
        );

        // Préparer les résumés pour le rapport final
        let ageCategorieSummary = "Catégories d'âge:\n";
        diagnosticInfo.ageCategories.forEach((cat) => {
          ageCategorieSummary += `- ${cat}\n`;
        });

        let weightCategoriesSummary = "Catégories de poids (Hommes):\n";
        diagnosticInfo.weightCategoriesMale.forEach((cat) => {
          weightCategoriesSummary += `- ${cat}\n`;
        });

        weightCategoriesSummary += "\nCatégories de poids (Femmes):\n";
        diagnosticInfo.weightCategoriesFemale.forEach((cat) => {
          weightCategoriesSummary += `- ${cat}\n`;
        });

        let unusedParticipantsSummary = "";
        if (diagnosticInfo.unusedParticipants.length > 0) {
          unusedParticipantsSummary = "Participants non utilisés:\n";
          Object.entries(diagnosticInfo.unusedByCategory).forEach(
            ([category, count]) => {
              unusedParticipantsSummary += `- ${category}: ${count} participants (moins de 3 participants dans cette catégorie)\n`;
            }
          );
        }

        // Afficher le rapport de diagnostic une seule fois à la fin
        console.log(
          "\n===============================================================\n" +
            "===== RAPPORT DE DIAGNOSTIC DÉTAILLÉ =====\n" +
            `Groupes générés: ${groups.length}\n` +
            `Poules générées: ${stats.totalPools}\n` +
            `Participants utilisés: ${usedParticipantIds.size} sur ${validParticipants.length}\n` +
            `Participants non utilisés: ${stats.unusedParticipants}\n` +
            `Participants avec ID temporaire: ${diagnosticInfo.tempIds}\n` +
            "\n=== DÉTAILS DES CATÉGORIES ===\n" +
            ageCategorieSummary +
            "\n" +
            weightCategoriesSummary +
            "\n" +
            unusedParticipantsSummary +
            "\n" +
            "===============================================================\n" +
            "=== FIN DU DIAGNOSTIC ===\n" +
            "===============================================================\n"
        );

        return { groups, stats };
      }
    }

    // Si on arrive ici, c'est que les catégories prédéfinies n'ont pas fonctionné
    // On utilise la méthode standard de catégorisation
    console.log(
      "Aucune catégorie prédéfinie utilisable, utilisation de la méthode standard"
    );

    // Catégoriser les participants
    const categories = categorizeParticipants(participants, config);
    console.log("Catégories trouvées:", Object.keys(categories));

    // Créer un Set pour suivre les participants déjà utilisés
    const usedParticipantIds = new Set();

    // Liste des IDs de participants existants - utilisé pour la validation
    const existingParticipantIds = new Set(validParticipants.map((p) => p.id));

    // Journalisation pour le diagnostic
    console.log(
      `${existingParticipantIds.size} IDs de participants valides trouvés`
    );

    // Vérifier combien de participants ont des IDs générés temporairement
    if (diagnosticInfo.tempIds > 0) {
      console.log(
        `${diagnosticInfo.tempIds} participants utilisent des IDs temporaires générés automatiquement`
      );
    }

    for (const gender of ["male", "female"]) {
      const weightCategories = config.weightCategories[gender] || [];
      if (weightCategories.length === 0) {
        console.warn(
          `Aucune catégorie de poids définie pour le genre ${gender}`
        );
      }

      for (const ageCategory of config.ageCategories) {
        for (const weightCategory of weightCategories) {
          const key = `${gender}-${ageCategory.name}-${weightCategory.name}`;
          let categoryParticipants = categories[key] || [];

          // Filtrer les participants déjà utilisés
          categoryParticipants = categoryParticipants.filter(
            (p) => !usedParticipantIds.has(p.id)
          );

          console.log(
            `Catégorie ${key}: ${categoryParticipants.length} participants disponibles`
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
                console.warn(
                  `Aucune poule n'a pu être créée pour le groupe ${key}`
                );
                stats.unusedParticipants += categoryParticipants.length;
              } else {
                console.log(
                  `Groupe ${key} créé avec ${group.pools.length} poules`
                );

                // Marquer tous les participants du groupe comme utilisés
                group.pools.forEach((pool) => {
                  pool.forEach((participantId) => {
                    usedParticipantIds.add(participantId);
                  });
                });

                groups.push(group);
              }
            } catch (error) {
              console.error(
                `Erreur lors de la création du groupe ${key}:`,
                error
              );
              stats.unusedParticipants += categoryParticipants.length;
            }
          } else {
            // Pas assez de participants pour cette catégorie
            console.log(
              `Pas assez de participants pour ${key}: ${categoryParticipants.length} (min 3)`
            );
            stats.unusedParticipants += categoryParticipants.length;
          }
        }
      }
    }

    // Compter le nombre total de participants non utilisés
    stats.unusedParticipants = participants.length - usedParticipantIds.size;

    console.log("Création des groupes terminée:", {
      nombreGroupes: groups.length,
      nombrePoules: stats.totalPools,
      participantsUtilisés: usedParticipantIds.size,
      participantsNonUtilisés: stats.unusedParticipants,
    });

    // Collecter les informations sur les participants non utilisés
    const usedIds = new Set();
    groups.forEach((group) => {
      group.pools.forEach((pool) => {
        pool.forEach((id) => usedIds.add(id));
      });
    });

    const unusedParticipants = participants.filter((p) => !usedIds.has(p.id));

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

    // Affichage final de toutes les informations de diagnostic
    console.log("\n\n");
    console.log(
      "==============================================================="
    );
    console.log(
      "=== DIAGNOSTIC DÉTAILLÉ DE CRÉATION DES GROUPES ET POULES ==="
    );
    console.log(
      "==============================================================="
    );

    // 1. Résumé des statistiques
    console.log("\n=== RÉSUMÉ ===");
    console.log(`Nombre total de participants: ${participants.length}`);
    console.log(`Nombre de groupes créés: ${groups.length}`);
    console.log(`Nombre total de poules: ${stats.totalPools}`);
    console.log(
      `Participants utilisés: ${
        participants.length - stats.unusedParticipants
      } (${(
        ((participants.length - stats.unusedParticipants) /
          participants.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Participants non utilisés: ${stats.unusedParticipants} (${(
        (stats.unusedParticipants / participants.length) *
        100
      ).toFixed(1)}%)`
    );

    // 2. Catégories configurées
    console.log("\n=== CATÉGORIES CONFIGURÉES ===");

    console.log("\nCatégories d'âge:");
    if (diagnosticInfo.ageCategories.length > 0) {
      diagnosticInfo.ageCategories.forEach((cat) => {
        console.log(`  - ${cat}`);
      });
    } else {
      console.log("  ERREUR: Aucune catégorie d'âge configurée");
    }

    console.log("\nCatégories de poids masculines:");
    if (diagnosticInfo.weightCategoriesMale.length > 0) {
      diagnosticInfo.weightCategoriesMale.forEach((cat) => {
        console.log(`  - ${cat}`);
      });
    } else {
      console.log("  ERREUR: Aucune catégorie de poids masculine configurée");
    }

    console.log("\nCatégories de poids féminines:");
    if (diagnosticInfo.weightCategoriesFemale.length > 0) {
      diagnosticInfo.weightCategoriesFemale.forEach((cat) => {
        console.log(`  - ${cat}`);
      });
    } else {
      console.log("  ERREUR: Aucune catégorie de poids féminine configurée");
    }

    // 3. Participants non utilisés
    console.log("\n=== PARTICIPANTS NON UTILISÉS ===");

    if (unusedParticipants.length === 0) {
      console.log(
        "Aucun participant non utilisé, tous ont été placés dans des poules!"
      );
    } else {
      console.log(
        `${unusedParticipants.length} participants n'ont pas été placés dans des poules:`
      );

      // Afficher par catégorie
      for (const category in unusedByCategory) {
        const participants = unusedByCategory[category];
        console.log(
          `\nCatégorie ${category}: ${participants.length} participants`
        );

        // Expliquer la raison probable
        if (participants.length < 3) {
          console.log(
            `  Raison probable: Pas assez de participants dans cette catégorie (minimum 3 requis)`
          );
        }

        // Lister les participants
        participants.forEach((p) => {
          console.log(
            `  - ${p.nom} ${p.prenom} (ID: ${p.id || "N/A"}, Age: ${
              p.age
            }, Poids: ${p.poids}kg, Genre: ${p.sexe})`
          );
        });
      }

      // Suggestions de correction
      console.log("\nSuggestions pour résoudre ce problème:");
      console.log(
        "1. Vérifiez que vos catégories de poids correspondent exactement à celles dans votre fichier CSV/Excel"
      );
      console.log(
        "2. Pour les catégories ayant moins de 3 participants, considérez de les fusionner avec des catégories proches"
      );
      console.log(
        "3. Si nécessaire, modifiez le code pour permettre des poules plus petites dans certains cas spécifiques"
      );
    }

    console.log(
      "\n==============================================================="
    );
    console.log("=== FIN DU DIAGNOSTIC ===");
    console.log(
      "\n===============================================================\n" +
        "=== FIN DU DIAGNOSTIC ===\n" +
        "===============================================================\n"
    );

    // Préparer les résumés pour le rapport final
    let ageCategorieSummary = "Catégories d'âge:\n";
    diagnosticInfo.ageCategories.forEach((cat) => {
      ageCategorieSummary += `- ${cat}\n`;
    });

    let weightCategoriesSummary = "Catégories de poids (Hommes):\n";
    diagnosticInfo.weightCategoriesMale.forEach((cat) => {
      weightCategoriesSummary += `- ${cat}\n`;
    });

    weightCategoriesSummary += "\nCatégories de poids (Femmes):\n";
    diagnosticInfo.weightCategoriesFemale.forEach((cat) => {
      weightCategoriesSummary += `- ${cat}\n`;
    });

    let unusedParticipantsSummary = "";
    if (diagnosticInfo.unusedParticipants.length > 0) {
      unusedParticipantsSummary = "Participants non utilisés:\n";
      Object.entries(diagnosticInfo.unusedByCategory).forEach(
        ([category, count]) => {
          unusedParticipantsSummary += `- ${category}: ${count} participants (moins de 3 participants dans cette catégorie)\n`;
        }
      );
    }

    // Afficher le rapport de diagnostic une seule fois à la fin
    console.log(
      "\n===============================================================\n" +
        "===== RAPPORT DE DIAGNOSTIC DÉTAILLÉ =====\n" +
        `Groupes générés: ${groups.length}\n` +
        `Poules générées: ${stats.totalPools}\n` +
        `Participants utilisés: ${usedParticipantIds.size} sur ${validParticipants.length}\n` +
        `Participants non utilisés: ${stats.unusedParticipants}\n` +
        `Participants avec ID temporaire: ${diagnosticInfo.tempIds}\n` +
        "\n=== DÉTAILS DES CATÉGORIES ===\n" +
        ageCategorieSummary +
        "\n" +
        weightCategoriesSummary +
        "\n" +
        unusedParticipantsSummary +
        "\n" +
        "===============================================================\n" +
        "=== FIN DU DIAGNOSTIC ===\n" +
        "===============================================================\n"
    );

    return { groups, stats };
  } catch (error) {
    console.error("Erreur lors de la création des groupes:", error);
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

  console.log("Début de la catégorisation des participants...");
  console.log(`Nombre total de participants: ${participants.length}`);

  // Premier passage pour collecter les participants avec sexe inconnu
  participants.forEach((participant) => {
    if (participant.sexe !== "male" && participant.sexe !== "female") {
      unknownGenderParticipants.push(participant);
    }
  });

  if (unknownGenderParticipants.length > 0) {
    console.log(
      `Trouvé ${unknownGenderParticipants.length} participants avec genre inconnu`
    );
  }

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
          console.log(
            `Sexe de ${participant.nom} ${participant.prenom} corrigé à "female" basé sur sa catégorie: ${participant.categorie}`
          );
        } else if (
          lowerCategorie.startsWith("male-") ||
          lowerCategorie.startsWith("m-")
        ) {
          sexe = "male";
          console.log(
            `Sexe de ${participant.nom} ${participant.prenom} corrigé à "male" basé sur sa catégorie: ${participant.categorie}`
          );
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

        console.log(
          `Sexe de ${participant.nom} ${participant.prenom} défini par défaut à "${sexe}" basé sur son poids de ${participant.poids}kg et son prénom`
        );
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

      if (ageCategory) {
        console.log(
          `Catégorie d'âge trouvée par correspondance directe: ${participant.ageCategory} pour ${participant.nom} ${participant.prenom}`
        );
      }
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

      if (ageCategory) {
        console.log(
          `Catégorie d'âge trouvée par année de naissance ${birthYear} (saison ${categories.season.start}-${categories.season.end}): ${ageCategory.name} pour ${participant.nom} ${participant.prenom}`
        );
      }
    }

    // Si toujours pas de catégorie, revenir à la méthode basée sur l'âge calculé
    if (!ageCategory) {
      ageCategory = config.ageCategories.find(
        (cat) => participant.age >= cat.min && participant.age <= cat.max
      );

      if (ageCategory) {
        console.log(
          `Catégorie d'âge trouvée par âge calculé (${participant.age} ans): ${ageCategory.name} pour ${participant.nom} ${participant.prenom}`
        );
      }
    }

    if (!ageCategory) {
      console.warn(
        `Participant ${participant.nom} ${
          participant.prenom
        } n'a pas de catégorie d'âge valide: âge=${
          participant.age
        }, année de naissance=${participant.birthYear || "inconnue"}`
      );
      return;
    }

    // Déterminer la catégorie de poids
    const weightCategories = config.weightCategories[sexe] || [];
    const weightCategory = weightCategories.find(
      (cat) => participant.poids <= cat.max
    );

    if (!weightCategory) {
      console.warn(
        `Participant ${participant.nom} ${participant.prenom} n'a pas de catégorie de poids valide: ${participant.poids} kg`
      );
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

  // Afficher le résumé des catégories trouvées
  const categoriesFound = Object.keys(categories);
  console.log(
    `Catégories trouvées: ${
      categoriesFound.length > 0 ? categoriesFound.join(", ") : "[]"
    }`
  );

  for (const key in categories) {
    console.log(`Catégorie ${key}: ${categories[key].length} participants`);
  }

  // Au lieu d'afficher directement, retournons les informations de diagnostic avec les catégories
  const diagnosticInfo = {
    categories: categories,
    uncategorizedParticipants: [],
  };

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

  // Retourner uniquement les catégories pour la compatibilité avec le code existant
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
    console.log(
      "CreateGroupWithFixedPoolSize: targetPoolSize =",
      targetPoolSize,
      "type:",
      typeof targetPoolSize
    );

    // Validation des paramètres
    if (!Array.isArray(participants)) {
      console.error("Liste des participants invalide:", participants);
      participants = [];
    }

    // Valider et utiliser la taille de poule configurée
    let poolSize = targetPoolSize;
    if (typeof targetPoolSize !== "number" || targetPoolSize <= 0) {
      console.warn(
        "Taille cible de poule invalide, vérifiez la configuration de la compétition :",
        targetPoolSize
      );

      // Utiliser la valeur par défaut du schéma, qui est 4
      poolSize = 4;
      console.log("Utilisation de la taille de poule par défaut:", poolSize);
    } else {
      console.log("Utilisation de la taille de poule configurée:", poolSize);
    }

    // S'assurer que ageCategory a les propriétés min et max
    let validAgeCategory = ageCategory || { name: "Default" };
    if (!validAgeCategory.min || typeof validAgeCategory.min !== "number") {
      console.log(
        `La catégorie d'âge ${validAgeCategory.name} n'a pas de min valide, utilisation de 0 par défaut`
      );
      validAgeCategory = { ...validAgeCategory, min: 0 };
    }
    if (!validAgeCategory.max || typeof validAgeCategory.max !== "number") {
      console.log(
        `La catégorie d'âge ${validAgeCategory.name} n'a pas de max valide, utilisation de 99 par défaut`
      );
      validAgeCategory = { ...validAgeCategory, max: 99 };
    }

    // S'assurer que weightCategory a la propriété max
    let validWeightCategory = weightCategory || { name: "Default" };
    if (
      !validWeightCategory.max ||
      typeof validWeightCategory.max !== "number"
    ) {
      console.log(
        `La catégorie de poids ${validWeightCategory.name} n'a pas de max valide, utilisation de 999 par défaut`
      );
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
      console.warn(
        "Aucun participant dans le groupe, impossible de créer des poules"
      );
      return group;
    }

    // CORRECTION: S'assurer que tous les participants ont des IDs valides
    const validParticipants = participants.filter((p) => {
      if (!p) {
        console.error(`Participant invalide: null ou undefined`);
        return false;
      }

      // Vérifie si l'ID existe
      if (!p.id) {
        console.error(
          `Participant invalide ou sans ID:`,
          p
            ? `Nom=${p.nom || "N/A"} ${p.prenom || "N/A"}, Age=${
                p.age || "N/A"
              }, BirthYear=${p.birthYear || "N/A"}, Poids=${p.poids || "N/A"}`
            : "Participant null"
        );

        // NOUVEAU: Générer un ID temporaire pour ce participant
        // Cela assure que tous les participants seront inclus dans les poules
        p.id = `temp_${p.nom}_${p.prenom}_${p.poids}_${Math.random()
          .toString(36)
          .substring(2, 10)}`;
        console.log(`ID temporaire généré pour ${p.nom} ${p.prenom}: ${p.id}`);
        return true; // Maintenant on inclut ce participant avec l'ID temporaire
      }
      return true;
    });

    if (validParticipants.length < participants.length) {
      console.warn(
        `${
          participants.length - validParticipants.length
        } participants ignorés car ils n'ont pas d'ID valide`
      );
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

    console.log(
      `Pour ${participantsCopy.length} participants avec taille cible ${poolSize}:`
    );
    console.log(`- ${numFullPools} poules complètes`);
    console.log(`- ${remainingParticipants} participants restants`);

    // NOUVELLE LOGIQUE: Déterminer la meilleure répartition des participants
    let numPools;
    let participantsPerPool;

    if (remainingParticipants === 0) {
      // Cas idéal: tous les participants peuvent être répartis équitablement
      numPools = numFullPools;
      participantsPerPool = poolSize;
      console.log(
        `Répartition parfaite: ${numPools} poules de ${participantsPerPool} participants`
      );
    } else {
      // Cas avec reste: déterminer la meilleure stratégie de répartition
      if (remainingParticipants >= 3) {
        // Si le reste est suffisant pour former une poule valide (≥ 3)
        numPools = numFullPools + 1;
        participantsPerPool = poolSize; // Les poules régulières gardent leur taille
        console.log(
          `Répartition avec poule supplémentaire: ${numFullPools} poules de ${poolSize} + 1 poule de ${remainingParticipants}`
        );
      } else {
        // Si le reste est trop petit (1 ou 2 participants)
        // IMPORTANT: Toujours garantir un minimum de 3 participants par poule

        // Cas spécial: si on a suffisamment de participants pour redistribuer
        if (numFullPools > 0) {
          // Répartir les participants restants dans les poules existantes pour les équilibrer
          numPools = numFullPools;
          // La taille des poules sera calculée dynamiquement ci-dessous
          console.log(
            `Répartition avec ${remainingParticipants} participants redistribués dans ${numPools} poules`
          );
        } else if (participantsCopy.length >= 3) {
          // On a moins de 'poolSize' participants, mais au moins 3
          // Créer une seule poule avec tous les participants
          numPools = 1;
          participantsPerPool = participantsCopy.length;
          console.log(
            `Création d'une seule poule avec tous les ${participantsCopy.length} participants`
          );
        } else {
          // Cas d'erreur: moins de 3 participants au total
          // Ne devrait pas arriver car on vérifie auparavant qu'il y a au moins 3 participants
          console.warn(
            `Trop peu de participants (${participantsCopy.length}), impossible de créer une poule valide`
          );
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
            console.log(
              `Poule ${poolIndex + 1} créée avec ${pool.length} participants`
            );
          }
        } catch (error) {
          console.error(
            `Erreur lors de la création de la poule ${poolIndex + 1}:`,
            error
          );
        }
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
          console.log(`Dernière poule créée avec ${pool.length} participants`);
        }
      } catch (error) {
        console.error(
          "Erreur lors de la création de la dernière poule:",
          error
        );
      }
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
            console.log(
              `Poule ${poolIndex + 1} créée avec ${pool.length} participants`
            );
          }
        } catch (error) {
          console.error(
            `Erreur lors de la création de la poule ${poolIndex + 1}:`,
            error
          );
        }
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
            console.log(`Poule unique créée avec ${pool.length} participants`);
          }
        } catch (error) {
          console.error(
            "Erreur lors de la création de la poule unique:",
            error
          );
        }
      } else {
        // Calculer la meilleure distribution pour des poules de taille similaire
        // Mais avec au moins 3 participants chacune
        const baseSize = Math.floor(participantsCopy.length / numPools);

        // Si baseSize < 3, on doit réduire le nombre de poules
        if (baseSize < 3) {
          // Recalculer le nombre de poules pour garantir au moins 3 participants par poule
          const maxPools = Math.floor(participantsCopy.length / 3);
          console.log(
            `Ajustement: ${numPools} -> ${maxPools} poules pour garantir minimum 3 participants par poule`
          );
          numPools = maxPools;
        }

        const numPoolsWithExtra = participantsCopy.length % numPools;
        console.log(
          `Distribution: ${numPools} poules de base ${baseSize} participants + ${numPoolsWithExtra} poules avec +1 participant`
        );

        let startIndex = 0;
        for (let poolIndex = 0; poolIndex < numPools; poolIndex++) {
          // Déterminer la taille de cette poule (certaines auront un participant de plus)
          const thisPoolSize =
            baseSize + (poolIndex < numPoolsWithExtra ? 1 : 0);

          // Vérification de sécurité
          if (thisPoolSize < 3) {
            console.warn(
              `Avertissement: La poule ${
                poolIndex + 1
              } aurait ${thisPoolSize} participants, ce qui est inférieur au minimum de 3.`
            );
            // Dans ce cas, redistribuer autrement ou sauter la création
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
              console.log(
                `Poule ${poolIndex + 1} créée avec ${pool.length} participants`
              );
            }
          } catch (error) {
            console.error(
              `Erreur lors de la création de la poule ${poolIndex + 1}:`,
              error
            );
          }
        }

        // S'il reste des participants non assignés
        if (startIndex < participantsCopy.length) {
          const remainingUnassigned = participantsCopy.length - startIndex;
          console.log(
            `Il reste ${remainingUnassigned} participants non assignés`
          );

          // Les répartir dans les poules existantes
          if (group.pools.length > 0) {
            const remainingParticipantsList =
              participantsCopy.slice(startIndex);
            remainingParticipantsList.forEach((participant, index) => {
              const poolIndex = index % group.pools.length;
              // Ajouter à la poule correspondante
              if (participant && participant.id) {
                group.pools[poolIndex].push(participant.id);
                console.log(
                  `Participant ${participant.nom} ${
                    participant.prenom
                  } ajouté à la poule ${poolIndex + 1}`
                );
              }
            });
          }
        }
      }
    }

    return group;
  } catch (error) {
    console.error("Erreur lors de la création du groupe:", error);
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
      console.error("Liste des participants invalide:", participants);
      return [];
    }

    if (typeof poolSize !== "number" || poolSize <= 0) {
      console.error("Taille de poule invalide:", poolSize);
      return participants
        .slice(0, Math.min(participants.length, 8))
        .map((p) => p.id);
    }

    const pool = [];
    const liguesInPool = new Set();

    // Limiter la taille de la poule au nombre de participants disponibles
    const effectivePoolSize = Math.min(poolSize, participants.length);

    if (effectivePoolSize <= 0) {
      console.warn("Aucun participant disponible pour cette poule");
      return [];
    }

    // CORRECTION: Faire une copie de la liste des participants avec seulement ceux qui ont un ID valide
    const participantsCopy = [...participants].filter((p) => p && p.id);

    // IMPORTANT: Vérifier et journaliser les IDs des participants pour déboguer
    console.log(
      `Création d'une poule avec ${participantsCopy.length} participants valides sur ${participants.length} total`
    );
    participantsCopy.forEach((p, idx) => {
      console.log(
        `Participant #${idx + 1}: ID=${p.id}, Nom=${p.nom} ${p.prenom}, Ligue=${
          p.ligue || "Inconnue"
        }`
      );
    });

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
          console.log(
            `Ajout du participant ${selectedParticipant.prenom} ${selectedParticipant.nom} (ID: ${selectedParticipant.id}) à la poule`
          );
          liguesInPool.add(selectedParticipant.ligue || "Inconnue");
        } else {
          console.warn(
            `Participant sans ID valide ignoré: ${selectedParticipant.prenom} ${selectedParticipant.nom}`
          );
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
            console.log(
              `Ajout du participant ${selectedParticipant.prenom} ${selectedParticipant.nom} (ID: ${selectedParticipant.id}) à la poule (par défaut)`
            );
            liguesInPool.add(selectedParticipant.ligue || "Inconnue");
          } else {
            console.warn(
              `Participant sans ID valide ignoré: ${selectedParticipant.prenom} ${selectedParticipant.nom}`
            );
          }

          participantsCopy.splice(0, 1);
        } else {
          console.warn("Plus aucun participant disponible");
          break;
        }
      }
    }

    if (attempts >= maxAttempts) {
      console.warn(
        `Nombre maximum de tentatives atteint (${maxAttempts}) pour créer la poule`
      );
    }

    // Log final des IDs des participants dans la poule
    console.log(
      `Poule créée avec ${pool.length} participants: ${pool.join(", ")}`
    );

    return pool;
  } catch (error) {
    console.error("Erreur lors de la création d'une poule équilibrée:", error);
    return participants
      .slice(0, Math.min(poolSize, participants.length))
      .map((p) => p.id);
  }
};

// Exporter la fonction nommée pour compatibilité rétroactive
export { createGroups };

// Exporter comme export par défaut pour être compatible avec les imports existants
export default createGroups;
