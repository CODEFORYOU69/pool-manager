// Utilitaire pour gérer les phases de compétition
// Permet de répartir les groupes sur les aires par phase

/**
 * Fonction pour créer une structure de phases par défaut à partir des groupes disponibles
 * @param {Array} groups - Les groupes disponibles
 * @param {Object} config - Configuration du tournoi
 * @returns {Array} - Structure de phases
 */
export const createDefaultPhases = (groups, config) => {
  // Si pas de groupes ou config, retourner un tableau vide
  if (!groups || !Array.isArray(groups) || groups.length === 0 || !config) {
    return [];
  }

  // Récupérer le nombre d'aires
  const numAreas = config.numAreas || 1;

  // Ne prendre que le premier groupe pour la phase initiale
  const firstGroup = groups[0];

  // Créer une seule phase avec seulement le premier groupe
  return [
    {
      groups: [
        {
          groupId: firstGroup.id,
          gender: firstGroup.gender,
          ageCategory: firstGroup.ageCategory?.name || "",
          weightCategory: firstGroup.weightCategory?.name || "",
          // Par défaut, attribuer toutes les aires au groupe
          aires: Array.from({ length: numAreas }, (_, i) => i + 1),
        },
      ],
    },
  ];
};

/**
 * Répartit les poules et leurs matchs sur les aires selon les phases définies
 * @param {Array} allMatches - Tous les matchs générés
 * @param {Array} groups - Les groupes
 * @param {Array} phases - Les phases définies
 * @param {Object} config - Configuration du tournoi
 * @returns {Array} - Matchs avec leur numéro d'aire attribué
 */
export const assignAreasBasedOnPhases = (
  allMatches,
  groups,
  phases,
  config
) => {
  // Si pas de phases définies, retourner les matchs tels quels
  if (!phases || phases.length === 0) {
    return allMatches;
  }

  // Copier les matchs pour ne pas modifier l'original
  const updatedMatches = [...allMatches];

  console.log("Début de l'attribution des aires selon les phases:", phases);

  // Pour chaque phase
  phases.forEach((phase, phaseIndex) => {
    // Pour chaque groupe dans la phase
    phase.groups.forEach((phaseGroup) => {
      // Trouver le groupe correspondant
      const group = groups.find((g) => g.id === phaseGroup.groupId);
      if (!group) {
        console.warn(
          `Groupe ${phaseGroup.groupId} non trouvé lors de l'attribution des aires`
        );
        return;
      }

      // Si aucune aire n'est configurée pour ce groupe, passer au suivant
      if (!phaseGroup.aires || phaseGroup.aires.length === 0) {
        console.warn(
          `Aucune aire configurée pour le groupe ${
            phaseGroup.groupId
          } dans la phase ${phaseIndex + 1}`
        );
        return;
      }

      console.log(
        `Attribution des aires pour le groupe ${group.id} (${group.gender} ${
          group.ageCategory?.name
        } ${group.weightCategory?.name}) dans la phase ${phaseIndex + 1}`
      );
      console.log(`Aires configurées: ${phaseGroup.aires.join(", ")}`);

      // Récupérer les matchs de ce groupe
      const groupMatches = updatedMatches.filter(
        (match) => match.groupId === group.id
      );

      if (groupMatches.length === 0) {
        console.warn(
          `Aucun match trouvé pour le groupe ${group.id} dans la phase ${
            phaseIndex + 1
          }`
        );
        return;
      }

      console.log(
        `Nombre de matchs trouvés pour ce groupe: ${groupMatches.length}`
      );

      // NOUVELLE LOGIQUE: Récupérer les poules distinctes pour ce groupe
      const distinctPools = [];
      groupMatches.forEach((match) => {
        if (!distinctPools.includes(match.poolIndex)) {
          distinctPools.push(match.poolIndex);
        }
      });

      console.log(
        `Nombre de poules trouvées pour ce groupe: ${distinctPools.length}`
      );
      console.log(`Poules: ${distinctPools.join(", ")}`);

      // S'il y a plusieurs aires configurées et plusieurs poules, répartir les poules sur les aires
      if (phaseGroup.aires.length > 1 && distinctPools.length > 1) {
        console.log(
          `Répartition des ${distinctPools.length} poules sur les ${phaseGroup.aires.length} aires configurées`
        );

        // Répartir les poules sur les aires attribuées
        distinctPools.forEach((poolIndex, i) => {
          // Attribution cyclique des aires
          const aireIndex = i % phaseGroup.aires.length;
          const aire = phaseGroup.aires[aireIndex];

          console.log(`Attribution de la poule ${poolIndex} à l'aire ${aire}`);

          // Attribuer cette aire à tous les matchs de cette poule
          groupMatches
            .filter((match) => match.poolIndex === poolIndex)
            .forEach((match) => {
              match.areaNumber = aire;
              match.phase = phaseIndex + 1;
              console.log(`Match ${match.id} assigné à l'aire ${aire}`);
            });
        });
      } else {
        // S'il n'y a qu'une aire configurée ou une seule poule, utiliser la première aire
        const aire = phaseGroup.aires[0];

        console.log(
          `Utilisation de l'aire ${aire} pour tous les matchs du groupe ${group.id}`
        );

        // Attribuer cette aire à tous les matchs du groupe
        groupMatches.forEach((match) => {
          match.areaNumber = aire;
          match.phase = phaseIndex + 1;
        });
      }

      console.log(
        `Attribution terminée pour le groupe ${group.id}, ${groupMatches.length} matchs assignés`
      );
    });
  });

  console.log("Attribution des aires terminée");

  return updatedMatches;
};

/**
 * Trouve les groupes correspondant à une catégorie (sexe, âge, poids)
 * @param {Array} groups - Tous les groupes
 * @param {Object} criteria - Critères de recherche
 * @returns {Array} - Groupes correspondants
 */
export const findGroupsByCriteria = (groups, criteria) => {
  return groups.filter((group) => {
    if (criteria.gender && group.gender !== criteria.gender) return false;

    if (
      criteria.ageCategory &&
      group.ageCategory &&
      group.ageCategory.name !== criteria.ageCategory
    )
      return false;

    if (
      criteria.weightCategory &&
      group.weightCategory &&
      group.weightCategory.name !== criteria.weightCategory
    )
      return false;

    return true;
  });
};

/**
 * Vérifie si les phases sont valides (pas de conflit d'aires, etc.)
 * @param {Array} phases - Les phases à vérifier
 * @param {Number} totalAreas - Nombre total d'aires disponibles
 * @returns {Object} - Résultat de la validation
 */
export const validatePhases = (phases, totalAreas) => {
  if (!phases || !Array.isArray(phases)) {
    return { valid: false, errors: ["Phases invalides"] };
  }

  const errors = [];

  phases.forEach((phase, phaseIndex) => {
    if (!phase.groups || !Array.isArray(phase.groups)) {
      errors.push(`Phase ${phaseIndex + 1}: Groupes invalides`);
      return;
    }

    // Vérifier si les aires attribuées sont valides
    phase.groups.forEach((group, groupIndex) => {
      if (!group.aires || !Array.isArray(group.aires)) {
        errors.push(
          `Phase ${phaseIndex + 1}, Groupe ${groupIndex + 1}: Aires invalides`
        );
        return;
      }

      // Vérifier si les aires sont dans les limites
      const invalidAreas = group.aires.filter(
        (aire) => aire < 1 || aire > totalAreas
      );
      if (invalidAreas.length > 0) {
        errors.push(
          `Phase ${phaseIndex + 1}, Groupe ${
            groupIndex + 1
          }: Aires hors limites: ${invalidAreas.join(", ")}`
        );
      }

      // Vérifier les conflits d'aires au sein d'une même phase
      const otherGroups = phase.groups.filter((g, i) => i !== groupIndex);
      otherGroups.forEach((otherGroup) => {
        const commonAreas = group.aires.filter((aire) =>
          otherGroup.aires.includes(aire)
        );
        if (commonAreas.length > 0) {
          errors.push(
            `Phase ${phaseIndex + 1}: Conflit d'aires ${commonAreas.join(
              ", "
            )} entre groupes`
          );
        }
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Exporter les fonctions
export default {
  createDefaultPhases,
  assignAreasBasedOnPhases,
  findGroupsByCriteria,
  validatePhases,
};
