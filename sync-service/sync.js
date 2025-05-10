const { Client } = require("pg");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, "config.env") });

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

// Tables à synchroniser
const TABLES_TO_SYNC = ["Match", "Round", "MatchParticipant", "Participant"];

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

// Fonction pour créer la table sync_events dans la base de données locale si elle n'existe pas
async function ensureSyncTable() {
  try {
    // Lire le script SQL
    const sqlScript = fs.readFileSync(
      path.resolve(__dirname, "../db/sync-triggers.sql"),
      "utf8"
    );

    // Exécuter le script
    await localDb.query(sqlScript);
    console.log("Table sync_events et triggers créés/mis à jour avec succès.");
    return true;
  } catch (error) {
    console.error("Erreur lors de la création de la table sync_events:", error);
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
      const columns = Object.keys(data).filter((key) => key !== "id");
      const values = columns.map((col) => data[col]);

      // Ajouter l'ID comme premier paramètre
      values.unshift(data.id);

      // Construire la requête d'upsert
      const placeholders = columns.map((_, idx) => `$${idx + 2}`).join(", ");
      const updatePlaceholders = columns
        .map((col, idx) => `${col} = $${idx + 2}`)
        .join(", ");

      const upsertQuery = `
        INSERT INTO "${table_name}" (id, ${columns.join(", ")})
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

  // S'assurer que la table de synchronisation existe
  const syncTableOk = await ensureSyncTable();
  if (!syncTableOk) {
    console.error(
      "Impossible de créer la table de synchronisation. Arrêt du service."
    );
    await cleanup();
    process.exit(1);
  }

  // Planifier la tâche de synchronisation
  cron.schedule(`*/${syncInterval} * * * * *`, synchronize);
  console.log(
    `Service de synchronisation démarré. Synchronisation toutes les ${syncInterval} secondes.`
  );

  // Exécuter une première synchronisation immédiatement
  await synchronize();
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
