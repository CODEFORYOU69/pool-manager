// Supprime sur Neon les matchs qui n'existent plus en local
// Usage : NEON_DATABASE_URL=... node api/cleanup-orphan-matches-neon.js
require("dotenv").config({ path: __dirname + "/.env" });
const { PrismaClient: LocalPrisma } = require("@prisma/client");
const { PrismaClient: NeonPrisma } = require(".prisma/client-neon");

const local = new LocalPrisma();
const neon = new NeonPrisma({
  datasources: { db: { url: process.env.NEON_DATABASE_URL } },
});

(async () => {
  try {
    const localIds = new Set(
      (await local.match.findMany({ select: { id: true } })).map((m) => m.id)
    );
    const neonMatches = await neon.match.findMany({
      select: { id: true, matchNumber: true },
    });

    const orphans = neonMatches.filter((m) => !localIds.has(m.id));
    console.log(
      `Local: ${localIds.size} matchs / Neon: ${neonMatches.length} / orphelins: ${orphans.length}`
    );
    if (orphans.length === 0) {
      console.log("Rien à nettoyer.");
      return;
    }

    console.log(
      "Matchs orphelins (présents sur Neon, absents en local):",
      orphans.map((m) => `#${m.matchNumber} (${m.id})`).join(", ")
    );

    const orphanIds = orphans.map((m) => m.id);
    await neon.round.deleteMany({ where: { matchId: { in: orphanIds } } });
    await neon.matchParticipant.deleteMany({
      where: { matchId: { in: orphanIds } },
    });
    const result = await neon.match.deleteMany({
      where: { id: { in: orphanIds } },
    });
    console.log(`✓ ${result.count} matchs supprimés sur Neon`);
  } catch (err) {
    console.error("Erreur:", err);
    process.exit(1);
  } finally {
    await local.$disconnect();
    await neon.$disconnect();
  }
})();
