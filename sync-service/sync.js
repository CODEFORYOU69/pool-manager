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

    // Vérification préalable: pour les opérations INSERT/UPDATE, s'assurer que les tables de référence sont synchronisées
    if (operation === "INSERT" || operation === "UPDATE") {
      // Vérification pour Participant (doit avoir la Competition correspondante)
      if (table_name === "Participant" && data.competitionId) {
        const competitionExists = await checkReferenceExists(
          "Competition",
          data.competitionId,
          remoteDb
        );
        if (!competitionExists) {
          console.warn(
            `Impossible de synchroniser Participant: Competition ${data.competitionId} inexistante dans la base distante`
          );

          // Ajouter un délai avant de réessayer
          await markEventAsProcessed(event.id);
          console.log(
            `Événement ${event.id} marqué comme traité mais sera retentée ultérieurement`
          );

          // Forcer la synchronisation de la Competition
          await syncSpecificEntity("Competition", data.competitionId);
          return false;
        }
      }

      // Vérification pour Match
      if (table_name === "Match") {
        if (data.areaId) {
          const areaExists = await checkReferenceExists(
            "Area",
            data.areaId,
            remoteDb
          );
          if (!areaExists) {
            console.warn(
              `Impossible de synchroniser Match: Area ${data.areaId} inexistante dans la base distante`
            );
            await markEventAsProcessed(event.id);
            await syncSpecificEntity("Area", data.areaId);
            return false;
          }
        }
        if (data.groupId) {
          const groupExists = await checkReferenceExists(
            "Group",
            data.groupId,
            remoteDb
          );
          if (!groupExists) {
            console.warn(
              `Impossible de synchroniser Match: Group ${data.groupId} inexistante dans la base distante`
            );
            await markEventAsProcessed(event.id);
            await syncSpecificEntity("Group", data.groupId);
            return false;
          }
        }
        if (data.poolId) {
          const poolExists = await checkReferenceExists(
            "Pool",
            data.poolId,
            remoteDb
          );
          if (!poolExists) {
            console.warn(
              `Impossible de synchroniser Match: Pool ${data.poolId} inexistante dans la base distante`
            );
            await markEventAsProcessed(event.id);
            await syncSpecificEntity("Pool", data.poolId);
            return false;
          }
        }
      }
    }

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

  // Vérifier si la base distante contient déjà des données
  const remoteDataCheck = await checkRemoteDataExists();

  // Si la base distante est vide ou contient très peu de données, effectuer une synchronisation initiale complète
  if (!remoteDataCheck.hasData) {
    console.log(
      "Base de données distante vide ou presque vide. Exécution d'une synchronisation initiale complète..."
    );
    await performFullInitialSync();
  } else {
    console.log(
      "Base de données distante contient déjà des données. Passage en mode synchronisation incrémentale."
    );
  }

  // Planifier la tâche de synchronisation des changements
  cron.schedule(`*/${syncInterval} * * * * *`, synchronize);
  console.log(
    `Service de synchronisation démarré. Synchronisation toutes les ${syncInterval} secondes.`
  );
}

// Fonction pour vérifier si la base distante contient déjà des données
async function checkRemoteDataExists() {
  try {
    // Vérifier le nombre d'enregistrements dans les tables principales
    const competitionCount = await getTableCount("Competition", remoteDb);
    const participantCount = await getTableCount("Participant", remoteDb);
    const matchCount = await getTableCount("Match", remoteDb);

    console.log(
      `Données dans la base distante: ${competitionCount} compétitions, ${participantCount} participants, ${matchCount} matchs`
    );

    // Considérer la base comme non vide si elle contient au moins une compétition et quelques participants
    const hasData = competitionCount > 0 && participantCount > 10;

    return {
      hasData,
      counts: {
        competition: competitionCount,
        participant: participantCount,
        match: matchCount,
      },
    };
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des données distantes:",
      error
    );
    return { hasData: false, counts: {} };
  }
}

// Fonction pour compter les enregistrements dans une table
async function getTableCount(tableName, db) {
  try {
    const result = await db.query(`SELECT COUNT(*) FROM "${tableName}"`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error(
      `Erreur lors du comptage des enregistrements dans ${tableName}:`,
      error
    );
    return 0;
  }
}

// Fonction pour effectuer une synchronisation initiale complète
async function performFullInitialSync() {
  console.log("Démarrage de la synchronisation initiale complète...");

  // Synchroniser les tables dans l'ordre défini par TABLES_TO_SYNC
  for (const tableName of TABLES_TO_SYNC) {
    console.log(`Synchronisation de la table ${tableName}...`);

    try {
      // Récupérer tous les enregistrements de la table
      const result = await localDb.query(`SELECT * FROM "${tableName}"`);
      const records = result.rows;

      console.log(
        `${records.length} enregistrements trouvés dans ${tableName}`
      );

      // S'il n'y a pas d'enregistrements, passer à la table suivante
      if (records.length === 0) {
        console.log(`Aucun enregistrement à synchroniser pour ${tableName}`);
        continue;
      }

      // Synchroniser chaque enregistrement
      for (const record of records) {
        // Normaliser les clés
        const normalizedData = {};
        for (const key in record) {
          if (key.toLowerCase() === "areaid") {
            normalizedData["areaId"] = record[key];
          } else if (key.toLowerCase() === "poolid") {
            normalizedData["poolId"] = record[key];
          } else if (key.toLowerCase() === "groupid") {
            normalizedData["groupId"] = record[key];
          } else if (key.toLowerCase() === "matchid") {
            normalizedData["matchId"] = record[key];
          } else if (key.toLowerCase() === "participantid") {
            normalizedData["participantId"] = record[key];
          } else if (key.toLowerCase() === "poolindex") {
            normalizedData["poolIndex"] = record[key];
          } else if (key.toLowerCase() === "pointmatch") {
            normalizedData["pointMatch"] = record[key];
          } else if (key.toLowerCase() === "matchnumber") {
            normalizedData["matchNumber"] = record[key];
          } else if (key.toLowerCase() === "starttime") {
            normalizedData["startTime"] = record[key];
          } else if (key.toLowerCase() === "endtime") {
            normalizedData["endTime"] = record[key];
          } else {
            normalizedData[key] = record[key];
          }
        }

        // Pour certaines tables, vérifier que les références existent déjà
        if (tableName === "Participant") {
          // Vérifier que la compétition existe
          const competitionExists = await checkReferenceExists(
            "Competition",
            normalizedData.competitionId,
            remoteDb
          );
          if (!competitionExists) {
            console.warn(
              `Impossible de synchroniser Participant ${normalizedData.id}: Competition ${normalizedData.competitionId} inexistante dans la base distante`
            );
            continue;
          }
        }

        // Construire la requête d'upsert
        const columns = Object.keys(normalizedData);
        const values = columns.map((col) => normalizedData[col]);
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

        try {
          await remoteDb.query(upsertQuery, values);
          console.log(
            `Enregistrement ${normalizedData.id} synchronisé dans ${tableName}`
          );
        } catch (error) {
          console.error(
            `Erreur lors de la synchronisation de l'enregistrement ${normalizedData.id} dans ${tableName}:`,
            error
          );
          // Continuer avec l'enregistrement suivant
        }
      }

      console.log(`Synchronisation de la table ${tableName} terminée`);
    } catch (error) {
      console.error(
        `Erreur lors de la synchronisation de la table ${tableName}:`,
        error
      );
      // Continuer avec la table suivante
    }
  }

  console.log("Synchronisation initiale complète terminée.");
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

// Fonction pour vérifier si une entité référencée existe dans la base distante
async function checkReferenceExists(tableName, id, db) {
  try {
    const result = await db.query(
      `SELECT EXISTS(SELECT 1 FROM "${tableName}" WHERE id = $1)`,
      [id]
    );
    return result.rows[0].exists;
  } catch (error) {
    console.error(
      `Erreur lors de la vérification de l'existence de ${tableName} ${id}:`,
      error
    );
    return false;
  }
}

// Fonction pour synchroniser une entité spécifique immédiatement
async function syncSpecificEntity(tableName, id) {
  try {
    console.log(`Synchronisation forcée de ${tableName} avec ID ${id}`);

    // Récupérer l'entité depuis la base locale
    const result = await localDb.query(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      console.warn(
        `Entité ${tableName} avec ID ${id} introuvable dans la base locale`
      );
      return false;
    }

    const data = result.rows[0];

    // Normalisation des clés
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
      } else if (key.toLowerCase() === "starttime") {
        normalizedData["startTime"] = data[key];
      } else if (key.toLowerCase() === "endtime") {
        normalizedData["endTime"] = data[key];
      } else {
        normalizedData[key] = data[key];
      }
    }

    // Construire la requête d'upsert
    const columns = Object.keys(normalizedData);
    const values = columns.map((col) => normalizedData[col]);
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
    console.log(`Entité ${tableName} avec ID ${id} synchronisée avec succès`);
    return true;
  } catch (error) {
    console.error(
      `Erreur lors de la synchronisation forcée de ${tableName} ${id}:`,
      error
    );
    return false;
  }
}
