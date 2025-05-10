const { Client } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, "config.env") });

// Tables à synchroniser - Ordonner correctement pour respecter les contraintes de clé étrangère
const TABLES_TO_SYNC = [
  "Competition", // Table principale - DOIT être en premier
  "Area", // Référencée par Match
  "Group", // Référencée par Match et ParticipantGroup
  "Pool", // Référencée par Match et PoolParticipant
  "Participant", // Référencée par MatchParticipant, ParticipantGroup, PoolParticipant
  "ParticipantGroup", // Relation entre Participant et Group
  "PoolParticipant", // Relation entre Participant et Pool
  "Match", // Dépend des tables ci-dessus, référencée par Round et MatchParticipant
  "MatchParticipant", // Dépend de Match et Participant
  "Round", // Dépend de Match
];

async function resetAndSync() {
  console.log(
    "Démarrage de la réinitialisation et synchronisation complète..."
  );

  // Créer un client pour la base de données locale
  const localDb = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  // Créer un client pour la base de données distante
  const remoteDb = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL,
  });

  try {
    // Connexion aux bases de données
    console.log("Connexion à la base de données locale...");
    await localDb.connect();
    console.log("Connexion à la base de données locale établie.");

    console.log("Connexion à la base de données distante...");
    await remoteDb.connect();
    console.log("Connexion à la base de données distante établie.");

    // Étape 1: Supprimer les tables dans la base distante
    console.log("Suppression des tables dans la base distante...");
    try {
      // Utiliser CASCADE pour ignorer les contraintes de clé étrangère
      for (const tableName of [...TABLES_TO_SYNC].reverse()) {
        try {
          console.log(`Suppression de la table ${tableName}...`);
          await remoteDb.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          console.log(`Table ${tableName} supprimée.`);
        } catch (error) {
          console.error(
            `Erreur lors de la suppression de la table ${tableName}:`,
            error.message
          );
          // Continuer avec les autres tables
        }
      }
    } catch (error) {
      console.error("Erreur lors de la suppression des tables:", error.message);
    }

    // Étape 2: Synchroniser chaque table dans l'ordre
    for (const tableName of TABLES_TO_SYNC) {
      console.log(`Synchronisation de la table ${tableName}...`);

      try {
        // Créer la table si elle n'existe pas
        console.log(`Récupération de la structure de la table ${tableName}...`);
        const schemaResult = await localDb.query(
          `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `,
          [tableName]
        );

        if (schemaResult.rows.length > 0) {
          // Construire la requête CREATE TABLE
          let createTableQuery = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;

          const columns = schemaResult.rows.map((col) => {
            const nullable = col.is_nullable === "YES" ? "" : " NOT NULL";
            const defaultValue = col.column_default
              ? ` DEFAULT ${col.column_default}`
              : "";
            return `  "${col.column_name}" ${col.data_type}${nullable}${defaultValue}`;
          });

          // Ajouter la contrainte de clé primaire pour "id"
          createTableQuery +=
            columns.join(",\n") + ',\n  PRIMARY KEY ("id")\n);';

          // Créer la table
          console.log(
            `Création de la table ${tableName} dans la base distante...`
          );
          await remoteDb.query(createTableQuery);
          console.log(`Table ${tableName} créée avec succès.`);

          // Récupérer les données de la table locale
          const dataResult = await localDb.query(
            `SELECT * FROM "${tableName}"`
          );
          console.log(
            `${dataResult.rows.length} enregistrements trouvés dans la table ${tableName}.`
          );

          // Insérer les données dans la table distante
          for (const row of dataResult.rows) {
            // Normaliser les clés pour gérer les problèmes de casse
            const normalizedData = {};
            for (const key in row) {
              normalizedData[key] = row[key];
            }

            const columns = Object.keys(normalizedData);
            const values = columns.map((col) => normalizedData[col]);
            const placeholders = columns
              .map((_, idx) => `$${idx + 1}`)
              .join(", ");
            const updatePlaceholders = columns
              .map((col, idx) => `"${col}" = $${idx + 1}`)
              .join(", ");

            const upsertQuery = `
              INSERT INTO "${tableName}" ("${columns.join('", "')}")
              VALUES (${placeholders})
              ON CONFLICT (id) 
              DO UPDATE SET ${updatePlaceholders}
            `;

            await remoteDb.query(upsertQuery, values);
            console.log(
              `Enregistrement ${normalizedData.id} synchronisé dans la table ${tableName}.`
            );
          }

          console.log(
            `Synchronisation de la table ${tableName} terminée avec succès.`
          );
        } else {
          console.error(
            `Impossible de récupérer la structure de la table ${tableName}.`
          );
        }
      } catch (error) {
        console.error(
          `Erreur lors de la synchronisation de la table ${tableName}:`,
          error
        );
      }
    }

    console.log(
      "Réinitialisation et synchronisation complètes terminées avec succès !"
    );
  } catch (error) {
    console.error(
      "Erreur lors de la réinitialisation et synchronisation:",
      error
    );
  } finally {
    // Fermer les connexions
    console.log("Fermeture des connexions aux bases de données...");
    try {
      await localDb.end();
      await remoteDb.end();
      console.log("Connexions fermées avec succès.");
    } catch (error) {
      console.error("Erreur lors de la fermeture des connexions:", error);
    }
  }
}

// Exécuter la fonction principale
resetAndSync()
  .catch((error) => {
    console.error("Erreur non gérée:", error);
    process.exit(1);
  })
  .finally(() => {
    console.log("Fin du programme.");
  });
