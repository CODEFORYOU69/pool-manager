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

async function synchronizeAreas() {
  try {
    console.log("Connexion aux bases de données...");
    await localDb.connect();
    await remoteDb.connect();
    console.log("Connecté aux deux bases de données.");

    // 1. Récupérer toutes les aires de la base locale
    console.log("Récupération des aires depuis la base locale...");
    const result = await localDb.query('SELECT * FROM "Area"');
    const areas = result.rows;
    console.log(`${areas.length} aires trouvées dans la base locale.`);

    // 2. Supprimer toutes les aires dans la base distante
    console.log("Suppression des aires existantes dans la base distante...");
    await remoteDb.query('TRUNCATE TABLE "Area" CASCADE');

    // 3. Insérer toutes les aires dans la base distante
    console.log("Insertion des aires dans la base distante...");
    for (const area of areas) {
      const columns = Object.keys(area);
      const values = Object.values(area);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

      const query = `
        INSERT INTO "Area" ("${columns.join('", "')}") 
        VALUES (${placeholders})
      `;

      await remoteDb.query(query, values);
      console.log(`Aire avec ID ${area.id} synchronisée.`);
    }

    // 4. Vérification
    const verifyResult = await remoteDb.query('SELECT COUNT(*) FROM "Area"');
    console.log(
      `Nombre d'aires dans la base distante après synchronisation: ${verifyResult.rows[0].count}`
    );

    console.log("Synchronisation des aires terminée avec succès!");
  } catch (error) {
    console.error("Erreur lors de la synchronisation des aires:", error);
  } finally {
    // Fermeture des connexions
    await localDb.end();
    await remoteDb.end();
    console.log("Connexions aux bases de données fermées.");
  }
}

// Exécuter la synchronisation
synchronizeAreas().then(() => {
  console.log("Script terminé.");
});
