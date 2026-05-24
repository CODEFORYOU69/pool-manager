// Supprime les matchs semi/final d'une compétition sur Neon
require("dotenv").config({ path: __dirname + "/.env" });
const { PrismaClient } = require(".prisma/client-neon");

const COMP = "a06d89fb-caaf-4658-8e1f-36f6603c57ba";
const neon = new PrismaClient({
  datasources: { db: { url: process.env.NEON_DATABASE_URL } },
});

(async () => {
  const before = await neon.match.groupBy({
    by: ["phase"],
    where: { group: { competitionId: COMP } },
    _count: true,
  });
  console.log("Avant:", before);

  const ids = await neon.match.findMany({
    where: {
      group: { competitionId: COMP },
      phase: { in: ["semi1", "semi2", "final"] },
    },
    select: { id: true },
  });
  const idList = ids.map((m) => m.id);

  await neon.round.deleteMany({ where: { matchId: { in: idList } } });
  await neon.matchParticipant.deleteMany({
    where: { matchId: { in: idList } },
  });
  await neon.match.deleteMany({ where: { id: { in: idList } } });
  await neon.pool.updateMany({
    where: {
      group: { competitionId: COMP },
      phase: { in: ["finals", "completed"] },
    },
    data: { phase: "pool" },
  });

  const after = await neon.match.groupBy({
    by: ["phase"],
    where: { group: { competitionId: COMP } },
    _count: true,
  });
  console.log("Après:", after);
  await neon.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
