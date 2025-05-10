const { Client } = require("pg");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, "config.env") });

// Afficher les variables d'environnement chargées
console.log("Variables d'environnement chargées:");
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("REMOTE_DATABASE_URL:", process.env.REMOTE_DATABASE_URL);
console.log("SYNC_INTERVAL:", process.env.SYNC_INTERVAL);

// Configuration des connexions aux bases de données
const localDbConfig = {
  connectionString: process.env.DATABASE_URL,
};

const remoteDbConfig = {
  connectionString: process.env.REMOTE_DATABASE_URL,
};

// Clients pour les connexions aux bases de données
const localDb = new Client(localDbConfig);
const remoteDb = new Client(remoteDbConfig);

// Intervalle de synchronisation (en secondes)
const syncInterval = process.env.SYNC_INTERVAL || 5;

// Tables à synchroniser - Ordonner correctement pour respecter les contraintes de clé étrangère
const TABLES_TO_SYNC = [
  "Competition", // Table principale
  "Area", // Référencée par Match
  "Group", // Référencée par Match
  "Pool", // Référencée par Match
  "Participant", // Référencée par MatchParticipant
  "Match", // Dépend des tables ci-dessus, référencée par Round et MatchParticipant
  "MatchParticipant", // Dépend de Match et Participant
  "Round", // Dépend de Match
];

// Fonction pour initialiser les connexions aux bases de données
async function initializeConnections() {
  try {
    console.log("Connexion à la base de données locale...");
    await localDb.connect();
    console.log("Connexion à la base de données locale établie.");

    console.log("Connexion à la base de données distante...");
    await remoteDb.connect();
    console.log("Connexion à la base de données distante établie.");

    return true;
  } catch (error) {
    console.error("Erreur lors de la connexion aux bases de données:", error);
    return false;
  }
}

// Fonction pour récupérer les événements non traités
async function fetchUnprocessedEvents(limit = 100) {
  try {
    const result = await localDb.query(
      `
      SELECT * FROM sync_events 
      WHERE processed = FALSE 
      ORDER BY created_at ASC
      LIMIT $1
    `,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des événements non traités:",
      error
    );
    return [];
  }
}

// Fonction pour marquer un événement comme traité
async function markEventAsProcessed(eventId) {
  try {
    await localDb.query(
      "UPDATE sync_events SET processed = TRUE WHERE id = $1",
      [eventId]
    );
    return true;
  } catch (error) {
    console.error(
      `Erreur lors du marquage de l'événement ${eventId} comme traité:`,
      error
    );
    return false;
  }
}

// Fonction pour traiter un événement spécifique
async function processEvent(event) {
  console.log(
    `Traitement de l'événement ${event.id} - ${event.operation} sur ${event.table_name} (ID: ${event.record_id})`
  );

  try {
    const { table_name, record_id, operation, data } = event;

    // Traiter selon le type d'opération
    if (operation === "DELETE") {
      // Supprimer l'enregistrement de la base de données distante
      await remoteDb.query(`DELETE FROM "${table_name}" WHERE id = $1`, [
        record_id,
      ]);
      console.log(
        `Enregistrement ${record_id} supprimé de la table ${table_name}`
      );
    } else if (operation === "INSERT" || operation === "UPDATE") {
      // Convertir les données JSON en paramètres et valeurs pour la requête

      // Correction du problème de casse - Normaliser les clés
      const normalizedData = {};
      for (const key in data) {
        if (key.toLowerCase() === "areaid") {
          normalizedData["areaId"] = data[key];
        } else if (key.toLowerCase() === "poolid") {
          normalizedData["poolId"] = data[key];
        } else if (key.toLowerCase() === "groupid") {
          normalizedData["groupId"] = data[key];
        } else if (key.toLowerCase() === "matchid") {
          normalizedData["matchId"] = data[key];
        } else if (key.toLowerCase() === "participantid") {
          normalizedData["participantId"] = data[key];
        } else if (key.toLowerCase() === "poolindex") {
          normalizedData["poolIndex"] = data[key];
        } else if (key.toLowerCase() === "pointmatch") {
          normalizedData["pointMatch"] = data[key];
        } else if (key.toLowerCase() === "matchnumber") {
          normalizedData["matchNumber"] = data[key];
        } else {
          normalizedData[key] = data[key];
        }
      }

      const columns = Object.keys(normalizedData).filter((key) => key !== "id");
      const values = columns.map((col) => normalizedData[col]);

      // Ajouter l'ID comme premier paramètre
      values.unshift(normalizedData.id);

      // Construire la requête d'upsert avec des noms de colonnes entre guillemets
      const placeholders = columns.map((_, idx) => `$${idx + 2}`).join(", ");
      const updatePlaceholders = columns
        .map((col, idx) => `"${col}" = $${idx + 2}`)
        .join(", ");

      const upsertQuery = `
        INSERT INTO "${table_name}" (id, "${columns.join('", "')}")
        VALUES ($1, ${placeholders})
        ON CONFLICT (id) 
        DO UPDATE SET ${updatePlaceholders}
      `;

      await remoteDb.query(upsertQuery, values);
      console.log(
        `Enregistrement ${record_id} ${
          operation === "INSERT" ? "inséré dans" : "mis à jour dans"
        } la table ${table_name}`
      );
    }

    // Marquer l'événement comme traité
    await markEventAsProcessed(event.id);
    return true;
  } catch (error) {
    console.error(
      `Erreur lors du traitement de l'événement ${event.id}:`,
      error
    );
    return false;
  }
}

// Fonction principale de synchronisation
async function synchronize() {
  console.log("Début du cycle de synchronisation...");

  // Récupérer les événements non traités
  const events = await fetchUnprocessedEvents();
  console.log(`${events.length} événements à traiter`);

  // Traiter chaque événement
  for (const event of events) {
    if (TABLES_TO_SYNC.includes(event.table_name)) {
      await processEvent(event);
    } else {
      console.log(
        `Table ${event.table_name} ignorée, non incluse dans les tables à synchroniser`
      );
      await markEventAsProcessed(event.id);
    }
  }

  console.log("Fin du cycle de synchronisation");
}

// Fonction pour fermer proprement les connexions
async function cleanup() {
  console.log("Fermeture des connexions aux bases de données...");
  try {
    await localDb.end();
    await remoteDb.end();
    console.log("Connexions fermées avec succès.");
  } catch (error) {
    console.error("Erreur lors de la fermeture des connexions:", error);
  }
}

// Fonction pour vérifier si une table existe dans la base distante
async function ensureTableExists(tableName) {
  try {
    console.log(
      `Vérification de l'existence de la table "${tableName}" dans la base distante...`
    );

    // Vérifier si la table existe déjà
    const checkResult = await remoteDb.query(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `,
      [tableName]
    );

    const tableExists = checkResult.rows[0].exists;

    if (tableExists) {
      console.log(`La table "${tableName}" existe déjà dans la base distante.`);
      return true;
    }

    // Obtenir la structure de la table depuis la base locale
    console.log(
      `La table "${tableName}" n'existe pas dans la base distante. Récupération de sa structure...`
    );

    const schemaResult = await localDb.query(
      `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `,
      [tableName]
    );

    if (schemaResult.rows.length === 0) {
      console.error(
        `Impossible de récupérer la structure de la table "${tableName}" depuis la base locale.`
      );
      return false;
    }

    // Construire la requête CREATE TABLE
    let createTableQuery = `CREATE TABLE "${tableName}" (\n`;

    const columns = schemaResult.rows.map((col) => {
      const nullable = col.is_nullable === "YES" ? "" : " NOT NULL";
      const defaultValue = col.column_default
        ? ` DEFAULT ${col.column_default}`
        : "";
      return `  "${col.column_name}" ${col.data_type}${nullable}${defaultValue}`;
    });

    // Ajouter la contrainte de clé primaire pour "id"
    createTableQuery += columns.join(",\n") + ',\n  PRIMARY KEY ("id")\n);';

    // Créer la table
    console.log(`Création de la table "${tableName}" dans la base distante...`);
    await remoteDb.query(createTableQuery);

    console.log(
      `Table "${tableName}" créée avec succès dans la base distante.`
    );
    return true;
  } catch (error) {
    console.error(
      `Erreur lors de la vérification/création de la table "${tableName}":`,
      error
    );
    return false;
  }
}

// Fonction pour synchroniser une table entière
async function syncTable(tableName) {
  console.log(`Synchronisation de la table ${tableName}...`);

  try {
    // Vérifier si la table existe dans la base distante
    const tableExists = await ensureTableExists(tableName);
    if (!tableExists) {
      console.error(
        `Impossible de continuer la synchronisation de la table ${tableName}.`
      );
      return;
    }

    // 1. Récupérer toutes les données de la table locale
    const result = await localDb.query(`SELECT * FROM "${tableName}"`);
    const rows = result.rows;

    console.log(
      `${rows.length} enregistrements trouvés dans la table ${tableName}.`
    );

    if (rows.length === 0) {
      console.log(`Aucune donnée à synchroniser pour la table ${tableName}.`);
      return;
    }

    // 2. Pour chaque enregistrement, effectuer un UPSERT dans la base distante
    for (const row of rows) {
      // Normalisation des clés pour gérer les problèmes de casse
      const normalizedData = {};
      for (const key in row) {
        if (key.toLowerCase() === "areaid") {
          normalizedData["areaId"] = row[key];
        } else if (key.toLowerCase() === "poolid") {
          normalizedData["poolId"] = row[key];
        } else if (key.toLowerCase() === "groupid") {
          normalizedData["groupId"] = row[key];
        } else if (key.toLowerCase() === "matchid") {
          normalizedData["matchId"] = row[key];
        } else if (key.toLowerCase() === "participantid") {
          normalizedData["participantId"] = row[key];
        } else if (key.toLowerCase() === "poolindex") {
          normalizedData["poolIndex"] = row[key];
        } else if (key.toLowerCase() === "pointmatch") {
          normalizedData["pointMatch"] = row[key];
        } else if (key.toLowerCase() === "matchnumber") {
          normalizedData["matchNumber"] = row[key];
        } else {
          normalizedData[key] = row[key];
        }
      }

      const columns = Object.keys(normalizedData).filter((key) => key !== "id");
      const values = columns.map((col) => normalizedData[col]);

      // Ajouter l'ID comme premier paramètre
      values.unshift(normalizedData.id);

      // Construire la requête d'upsert avec des noms de colonnes entre guillemets
      const placeholders = columns.map((_, idx) => `$${idx + 2}`).join(", ");
      const updatePlaceholders = columns
        .map((col, idx) => `"${col}" = $${idx + 2}`)
        .join(", ");

      const upsertQuery = `
        INSERT INTO "${tableName}" (id, "${columns.join('", "')}")
        VALUES ($1, ${placeholders})
        ON CONFLICT (id) 
        DO UPDATE SET ${updatePlaceholders}
      `;

      await remoteDb.query(upsertQuery, values);
      console.log(
        `Enregistrement ${normalizedData.id} synchronisé dans la table ${tableName}`
      );
    }

    console.log(
      `Synchronisation de la table ${tableName} terminée avec succès.`
    );
  } catch (error) {
    console.error(
      `Erreur lors de la synchronisation de la table ${tableName}:`,
      error
    );
  }
}

// Fonction pour exécuter une synchronisation manuelle de toutes les tables
async function manualSyncAllTables() {
  console.log(
    "Démarrage de la synchronisation manuelle de toutes les tables..."
  );

  // Synchroniser chaque table dans l'ordre spécifié
  for (const tableName of TABLES_TO_SYNC) {
    await syncTable(tableName);
  }

  console.log("Synchronisation manuelle de toutes les tables terminée.");
}

// Fonction de démarrage
async function start() {
  console.log("Démarrage du service de synchronisation CDC...");

  // Initialiser les connexions aux bases de données
  const connectionsOk = await initializeConnections();
  if (!connectionsOk) {
    console.error(
      "Impossible d'établir les connexions aux bases de données. Arrêt du service."
    );
    process.exit(1);
  }

  // Lancer une synchronisation manuelle initiale de toutes les tables
  console.log("Lancement d'une synchronisation initiale complète...");
  await manualSyncAllTables();

  // Planifier la tâche de synchronisation des changements
  cron.schedule(`*/${syncInterval} * * * * *`, synchronize);
  console.log(
    `Service de synchronisation démarré. Synchronisation toutes les ${syncInterval} secondes.`
  );
}

// Gestion des signaux pour une fermeture propre
process.on("SIGINT", async () => {
  console.log("Signal d'interruption reçu. Arrêt du service...");
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Signal de terminaison reçu. Arrêt du service...");
  await cleanup();
  process.exit(0);
});

// Démarrer le service
start().catch((error) => {
  console.error("Erreur lors du démarrage du service:", error);
  process.exit(1);
});
