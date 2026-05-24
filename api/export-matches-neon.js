// Exporte tous les matchs de Neon en CSV (un combat par ligne, rounds aplatis)
// Usage : node api/export-matches-neon.js
require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require(".prisma/client-neon");

const neon = new PrismaClient({
  datasources: { db: { url: process.env.NEON_DATABASE_URL } },
});

const csvEscape = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

(async () => {
  try {
    const matches = await neon.match.findMany({
      include: {
        rounds: { orderBy: { roundNumber: "asc" } },
        matchParticipants: { include: { participant: true } },
        area: true,
        group: true,
      },
      orderBy: { matchNumber: "asc" },
    });
    console.log(`${matches.length} matchs récupérés depuis Neon`);

    const fmtParticipant = (mp) => {
      if (!mp) return { name: "", club: "" };
      const p = mp.participant || {};
      return {
        name: `${p.prenom || ""} ${p.nom || ""}`.trim(),
        club: p.club || "",
      };
    };
    const fmtWinnerName = (match) => {
      if (!match.winner) return "";
      const mp = match.matchParticipants.find(
        (x) => x.participantId === match.winner
      );
      if (mp) {
        const f = fmtParticipant(mp);
        return `${f.name} (${mp.position})`;
      }
      return match.winner;
    };
    const roundWinnerLabel = (round, A, B) => {
      if (!round.winner) return "";
      if (round.winnerPosition === "A") return A.name || "A";
      if (round.winnerPosition === "B") return B.name || "B";
      return round.winner;
    };

    const headers = [
      "matchNumber",
      "status",
      "phase",
      "tour",
      "poolIndex",
      "area",
      "category",
      "fighterA",
      "clubA",
      "fighterB",
      "clubB",
      "winner",
      "startTime",
      "endTime",
      "R1_scoreA",
      "R1_scoreB",
      "R1_gamjeonA",
      "R1_gamjeonB",
      "R1_winner",
      "R2_scoreA",
      "R2_scoreB",
      "R2_gamjeonA",
      "R2_gamjeonB",
      "R2_winner",
      "R3_scoreA",
      "R3_scoreB",
      "R3_gamjeonA",
      "R3_gamjeonB",
      "R3_winner",
      "matchId",
    ];

    const rows = [headers.join(",")];
    for (const m of matches) {
      const mpA = m.matchParticipants.find((x) => x.position === "A");
      const mpB = m.matchParticipants.find((x) => x.position === "B");
      const A = fmtParticipant(mpA);
      const B = fmtParticipant(mpB);
      const r = [null, null, null];
      m.rounds.forEach((rd) => {
        if (rd.roundNumber >= 1 && rd.roundNumber <= 3)
          r[rd.roundNumber - 1] = rd;
      });

      const category = m.group
        ? [
            m.group.gender,
            m.group.ageCategoryName,
            m.group.weightCategoryName,
          ]
            .filter(Boolean)
            .join(" / ")
        : "";

      const row = [
        m.matchNumber,
        m.status,
        m.phase || "",
        m.tour || "",
        m.poolIndex ?? "",
        m.area?.areaNumber ?? "",
        category,
        A.name,
        A.club,
        B.name,
        B.club,
        fmtWinnerName(m),
        m.startTime ? new Date(m.startTime).toISOString() : "",
        m.endTime ? new Date(m.endTime).toISOString() : "",
        ...r.flatMap((rd) =>
          rd
            ? [
                rd.scoreA ?? 0,
                rd.scoreB ?? 0,
                rd.penaltyA ?? 0,
                rd.penaltyB ?? 0,
                roundWinnerLabel(rd, A, B),
              ]
            : ["", "", "", "", ""]
        ),
        m.id,
      ];
      rows.push(row.map(csvEscape).join(","));
    }

    const csvOut = path.join(__dirname, "export-matches-neon.csv");
    fs.writeFileSync(csvOut, rows.join("\n") + "\n", "utf8");
    console.log(`✓ CSV  : ${csvOut}`);

    // JSON structuré : un objet par combat avec rounds détaillés
    const jsonData = matches.map((m) => {
      const mpA = m.matchParticipants.find((x) => x.position === "A");
      const mpB = m.matchParticipants.find((x) => x.position === "B");
      const A = fmtParticipant(mpA);
      const B = fmtParticipant(mpB);
      return {
        matchNumber: m.matchNumber,
        matchId: m.id,
        status: m.status,
        phase: m.phase,
        tour: m.tour,
        poolIndex: m.poolIndex,
        area: m.area?.areaNumber ?? null,
        category: m.group
          ? {
              gender: m.group.gender || null,
              age: m.group.ageCategoryName || null,
              weight: m.group.weightCategoryName || null,
            }
          : null,
        fighterA: { ...A, participantId: mpA?.participantId || null },
        fighterB: { ...B, participantId: mpB?.participantId || null },
        winner: m.winner
          ? {
              participantId: m.winner,
              name: fmtWinnerName(m),
            }
          : null,
        startTime: m.startTime,
        endTime: m.endTime,
        rounds: m.rounds.map((rd) => ({
          roundNumber: rd.roundNumber,
          scoreA: rd.scoreA ?? 0,
          scoreB: rd.scoreB ?? 0,
          gamjeonA: rd.penaltyA ?? 0,
          gamjeonB: rd.penaltyB ?? 0,
          winner: roundWinnerLabel(rd, A, B) || null,
          winnerPosition: rd.winnerPosition || null,
        })),
      };
    });
    const jsonOut = path.join(__dirname, "export-matches-neon.json");
    fs.writeFileSync(jsonOut, JSON.stringify(jsonData, null, 2), "utf8");
    console.log(`✓ JSON : ${jsonOut}`);
    console.log(`  ${matches.length} combats exportés`);
  } catch (err) {
    console.error("Erreur:", err);
    process.exit(1);
  } finally {
    await neon.$disconnect();
  }
})();
