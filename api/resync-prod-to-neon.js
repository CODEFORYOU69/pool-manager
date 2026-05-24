// Re-sync complet de la DB de production (Electron) vers Neon
// Usage : NEON_DATABASE_URL=... node api/resync-prod-to-neon.js
require("dotenv").config({ path: __dirname + "/.env" });
const path = require("path");
const os = require("os");
const { PrismaClient: LocalPrisma } = require("@prisma/client");
const { syncCompetitionToNeon } = require("./neonSync");

const PROD_DB = path.join(
  os.homedir(),
  "Library/Application Support/taekwondo-tournament-manager/taekwondo.db"
);

const local = new LocalPrisma({
  datasources: { db: { url: `file:${PROD_DB}` } },
});

(async () => {
  try {
    console.log(`Lecture DB prod: ${PROD_DB}`);
    const competitions = await local.competition.findMany({
      select: { id: true, name: true },
    });
    console.log(`${competitions.length} compétition(s) trouvée(s) en local`);

    for (const c of competitions) {
      console.log(`\n→ Sync "${c.name}" (${c.id})`);
      await syncCompetitionToNeon(local, c.id);
    }
    console.log("\n✓ Re-sync terminé");
  } catch (err) {
    console.error("Erreur:", err);
    process.exit(1);
  } finally {
    await local.$disconnect();
  }
})();
