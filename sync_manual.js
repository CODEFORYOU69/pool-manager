const { Client } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

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

// Tables à synchroniser
const TABLES_TO_SYNC = [
  "Competition",
  "Area",
  "Participant",
  "Match",
  "MatchParticipant",
  "Round",
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

// Fonction pour convertir les clés en cas de problème de casse
function normalizeKeys(obj) {
  const result = {};
  for (const key in obj) {
    // Utiliser la clé originale mais s'assurer que les valeurs sont correctement définies
    if (key === "areaId" || key === "areaid") {
      // S'assurer que la clé areaId est correctement définie
      result["areaId"] = obj[key];
    } else if (key === "poolId" || key === "poolid") {
      result["poolId"] = obj[key];
    } else if (key === "groupId" || key === "groupid") {
      result["groupId"] = obj[key];
    } else if (key === "matchId" || key === "matchid") {
      result["matchId"] = obj[key];
    } else if (key === "participantId" || key === "participantid") {
      result["participantId"] = obj[key];
    } else if (key === "matchNumber" || key === "matchnumber") {
      result["matchNumber"] = obj[key];
    } else if (key === "poolIndex" || key === "poolindex") {
      result["poolIndex"] = obj[key];
    } else if (key === "pointMatch" || key === "pointmatch") {
      result["pointMatch"] = obj[key];
    } else if (key === "startTime" || key === "starttime") {
      result["startTime"] = obj[key];
    } else if (key === "endTime" || key === "endtime") {
      result["endTime"] = obj[key];
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

// Fonction pour synchroniser une table entière
async function syncTable(tableName) {
  console.log(`Synchronisation de la table ${tableName}...`);

  try {
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
      const normalizedRow = normalizeKeys(row);

      const columns = Object.keys(normalizedRow);
      const values = columns.map((col) => normalizedRow[col]);

      // Construire la requête d'UPSERT
      const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
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
        `Enregistrement ${normalizedRow.id} traité dans la table ${tableName}`
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

// Fonction principale de synchronisation
async function manualSync() {
  // Initialiser les connexions
  const connectionsOk = await initializeConnections();
  if (!connectionsOk) {
    console.error(
      "Impossible d'établir les connexions aux bases de données. Abandon."
    );
    process.exit(1);
  }

  // Synchroniser chaque table dans l'ordre spécifié
  for (const tableName of TABLES_TO_SYNC) {
    await syncTable(tableName);
  }

  console.log("Synchronisation manuelle terminée.");

  // Fermer les connexions
  await localDb.end();
  await remoteDb.end();
}

// Exécuter la synchronisation manuelle
manualSync().catch((error) => {
  console.error("Erreur lors de la synchronisation manuelle:", error);
  process.exit(1);
});
