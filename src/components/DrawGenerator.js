const handleSaveGroups = async () => {
  if (!groups || groups.length === 0) {
    console.error("Aucun groupe à sauvegarder");
    return;
  }

  try {
    setIsSaving(true);
    const result = await saveGroupsAndPools(competitionId, groups);
    console.log("Résultat de saveGroupsAndPools:", result);

    if (result && result.success) {
      let allMatches = [];

      // Préparation des matchs par poule
      const matchesByPool = [];

      // Pour chaque groupe
      groups.forEach((group) => {
        // Pour chaque poule dans le groupe
        if (group.pools && Array.isArray(group.pools)) {
          group.pools.forEach((pool, poolIndex) => {
            if (pool && Array.isArray(pool) && pool.length > 0) {
              // Générer les matchs pour cette poule
              const poolId = group.poolIds ? group.poolIds[poolIndex] : null;

              if (!poolId) {
                console.warn(
                  `Pas d'ID de poule trouvé pour la poule ${poolIndex} du groupe ${group.gender}-${group.ageCategory}-${group.weightCategory}`
                );
                return;
              }

              const poolMatches = generatePoolMatches(pool, poolId);

              if (poolMatches && poolMatches.length > 0) {
                matchesByPool.push({
                  poolId: poolId,
                  matches: poolMatches,
                });

                // Ajouter à la liste globale
                allMatches = [...allMatches, ...poolMatches];
              }
            }
          });
        }
      });

      console.log("Matchs générés par poule:", matchesByPool);

      // Sauvegarder les matchs
      if (matchesByPool.length > 0) {
        const matchResult = await saveGeneratedMatches(
          competitionId,
          matchesByPool
        );
        console.log("Résultat de saveGeneratedMatches:", matchResult);

        if (matchResult && matchResult.success) {
          setMessage({
            type: "success",
            content: "Groupes, poules et matchs sauvegardés avec succès",
          });
        } else {
          setMessage({
            type: "warning",
            content: `Groupes et poules sauvegardés, mais des erreurs sont survenues lors de la sauvegarde des matchs: ${
              matchResult.errors
                ? matchResult.errors.join(", ")
                : "Erreur inconnue"
            }`,
          });
        }
      } else {
        setMessage({
          type: "success",
          content:
            "Groupes et poules sauvegardés avec succès. Aucun match généré.",
        });
      }
    } else {
      setMessage({
        type: "error",
        content: `Erreur lors de la sauvegarde des groupes et poules: ${
          result.errors ? result.errors.join(", ") : "Erreur inconnue"
        }`,
      });
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    setMessage({
      type: "error",
      content: `Erreur lors de la sauvegarde: ${error.message}`,
    });
  } finally {
    setIsSaving(false);
  }
};

// Fonction pour générer les matchs d'une poule
const generatePoolMatches = (pool, poolId) => {
  if (!pool || pool.length < 2 || !poolId) {
    console.warn(
      "Impossible de générer des matchs: données de poule insuffisantes"
    );
    return [];
  }

  const matches = [];
  let matchNumber = 1;

  // Pour chaque paire possible de participants
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      // Vérifier que les deux participants ont des ID valides
      if (pool[i] && pool[j]) {
        matches.push({
          number: matchNumber,
          poolId: poolId,
          participants: [
            { id: pool[i], position: "A" },
            { id: pool[j], position: "B" },
          ],
        });
        matchNumber++;
      }
    }
  }

  return matches;
};
