/**
 * Utilitaires pour la génération des matchs de finales
 * à partir du classement de poule.
 */

/**
 * Génère les matchs de finales à partir du classement de poule.
 *
 * Semi 1 : Rank 1 vs Rank 4
 * Semi 2 : Rank 2 vs Rank 3
 * Final  : placeholder (gagnants des semis)
 *
 * Pas de petite finale : le 3e est le perdant de la demi qui a affronté le champion,
 * le 3e ex-aequo est le perdant de la demi qui a affronté le 2e.
 *
 * @param {Array} standings - Classement trié (top 4 minimum)
 * @returns {Array<{phase: string, fighterA: object|null, fighterB: object|null}>}
 */
export const generateFinalsMatches = (standings) => {
  const matches = [];

  if (standings.length < 2) {
    throw new Error("Il faut au moins 2 combattants pour générer les finales");
  }

  if (standings.length >= 4) {
    // Demi-finale 1: 1er vs 4e
    matches.push({
      phase: "semi1",
      label: "Demi-finale 1",
      fighterA: standings[0],
      fighterB: standings[3],
    });

    // Demi-finale 2: 2e vs 3e
    matches.push({
      phase: "semi2",
      label: "Demi-finale 2",
      fighterA: standings[1],
      fighterB: standings[2],
    });

    // Finale (placeholder)
    matches.push({
      phase: "final",
      label: "Finale",
      fighterA: null, // Gagnant semi1
      fighterB: null, // Gagnant semi2
    });
  } else {
    // Moins de 4 combattants: juste une finale entre les 2 premiers
    matches.push({
      phase: "final",
      label: "Finale",
      fighterA: standings[0],
      fighterB: standings[1],
    });
  }

  return matches;
};

/**
 * Labels lisibles pour les phases de match.
 */
export const PHASE_LABELS = {
  pool: "Poule",
  semi1: "Demi-finale 1",
  semi2: "Demi-finale 2",
  final: "Finale",
};

/**
 * Retourne le label lisible d'une phase.
 * @param {string} phase
 * @returns {string}
 */
export const getPhaseLabel = (phase) => PHASE_LABELS[phase] || phase;
