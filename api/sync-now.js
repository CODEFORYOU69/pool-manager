require("dotenv").config({ path: __dirname + "/.env" });
const { PrismaClient } = require("@prisma/client");
const { syncCompetitionToNeon } = require("./neonSync");

const prisma = new PrismaClient();

(async () => {
  console.log("NEON_DATABASE_URL:", process.env.NEON_DATABASE_URL ? "SET" : "NOT SET");
  const comps = await prisma.competition.findMany({ select: { id: true, name: true } });
  console.log("Competitions locales:", comps.map((c) => c.name));
  for (const c of comps) {
    console.log("Sync:", c.name, "...");
    await syncCompetitionToNeon(prisma, c.id);
  }
  console.log("Done!");
  await prisma.$disconnect();
})();
