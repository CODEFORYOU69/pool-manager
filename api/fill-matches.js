// Script one-shot : remplit aléatoirement les matchs de "test coupe 2026"
// Best-of-3 rounds, 2 rounds gagnants pour gagner le match.
// Usage : cd api && node fill-matches.js

require("dotenv").config({ path: __dirname + "/.env" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COMPETITION_NAME = "test coupe 2026";

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Génère un round avec scores réalistes (0-15 par combattant, distincts)
function generateRound() {
  let scoreA = randInt(0, 15);
  let scoreB = randInt(0, 15);
  // Pas d'égalité (golden point sinon)
  if (scoreA === scoreB) {
    if (Math.random() < 0.5) scoreA++;
    else scoreB++;
  }
  return { scoreA, scoreB };
}

async function fillMatch(match) {
  const pA = match.matchParticipants.find((mp) => mp.position === "A");
  const pB = match.matchParticipants.find((mp) => mp.position === "B");
  if (!pA || !pB) return { skipped: true, reason: "participants manquants" };

  // Supprimer les rounds existants pour idempotence
  await prisma.round.deleteMany({ where: { matchId: match.id } });

  let winsA = 0;
  let winsB = 0;
  const rounds = [];
  let roundNum = 1;

  while (winsA < 2 && winsB < 2 && roundNum <= 3) {
    const { scoreA, scoreB } = generateRound();
    const winnerPos = scoreA > scoreB ? "A" : "B";
    if (winnerPos === "A") winsA++;
    else winsB++;
    rounds.push({
      matchId: match.id,
      roundNumber: roundNum,
      scoreA,
      scoreB,
      winnerPosition: winnerPos,
      winner: winnerPos === "A" ? pA.participantId : pB.participantId,
      penaltyA: 0,
      penaltyB: 0,
    });
    roundNum++;
  }

  await prisma.round.createMany({ data: rounds });

  const winnerParticipantId =
    winsA >= 2 ? pA.participantId : pB.participantId;

  await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "completed",
      winner: winnerParticipantId,
      endTime: new Date(),
    },
  });

  return { rounds: rounds.length, winnerPos: winsA >= 2 ? "A" : "B" };
}

async function main() {
  const competition = await prisma.competition.findFirst({
    where: { name: COMPETITION_NAME },
    include: {
      groups: {
        include: {
          pools: {
            include: {
              matches: {
                include: { matchParticipants: true },
              },
            },
          },
        },
      },
    },
  });

  if (!competition) {
    console.error(`❌ Compétition "${COMPETITION_NAME}" introuvable`);
    process.exit(1);
  }

  console.log(`✓ Compétition trouvée : ${competition.name} (${competition.id})`);

  let totalMatches = 0;
  let filled = 0;
  let skipped = 0;

  for (const group of competition.groups) {
    for (const pool of group.pools) {
      for (const match of pool.matches) {
        totalMatches++;
        try {
          const res = await fillMatch(match);
          if (res.skipped) {
            skipped++;
            console.log(`  ⊘ match ${match.matchNumber} skip (${res.reason})`);
          } else {
            filled++;
            if (filled % 20 === 0) {
              console.log(`  ... ${filled} matchs remplis`);
            }
          }
        } catch (err) {
          console.error(`  ✗ match ${match.matchNumber} erreur:`, err.message);
        }
      }
    }
  }

  console.log(
    `\n✅ Terminé : ${filled}/${totalMatches} matchs remplis, ${skipped} skip`
  );

  // Trigger sync Neon si configuré
  try {
    const { triggerSync } = require("./neonSync");
    triggerSync(prisma, competition.id);
    console.log("→ Sync Neon déclenchée (en arrière-plan)");
    // Petit délai pour laisser la sync background se lancer
    await new Promise((r) => setTimeout(r, 3000));
  } catch (e) {
    console.warn("Sync Neon non lancée:", e.message);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
