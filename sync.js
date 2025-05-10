// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, "config.env") });

// Afficher les variables d'environnement chargées
console.log("Variables d'environnement chargées:");
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("REMOTE_DATABASE_URL:", process.env.REMOTE_DATABASE_URL);
console.log("SYNC_INTERVAL:", process.env.SYNC_INTERVAL);

// Configuration des connexions aux bases de données

// Fonction pour vérifier si la table sync_events existe dans la base de données locale
async function ensureSyncTable() {
  try {
    // Vérifier si la table sync_events existe
    const result = await localDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sync_events'
      );
    `);

    const tableExists = result.rows[0].exists;

    if (!tableExists) {
      console.log(
        "La table sync_events n'existe pas. Veuillez exécuter le script db/sync-triggers.sql manuellement."
      );
      return false;
    }

    console.log("Table sync_events trouvée. Prêt pour la synchronisation.");
    return true;
  } catch (error) {
    console.error(
      "Erreur lors de la vérification de la table sync_events:",
      error
    );
    return false;
  }
}
