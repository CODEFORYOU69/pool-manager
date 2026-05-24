// Script one-shot via HTTP : remplit aléatoirement les matchs de "test coupe 2026"
// Best-of-3 rounds, 2 rounds gagnants. Utilise l'API running pour éviter le lock SQLite.
// Usage : node fill-matches-http.js [API_URL]

const API = process.argv[2] || "http://localhost:3001/api";
const COMPETITION_NAME = "test coupe 2026";

// Distribution gaussienne tronquée centrée sur 8, écart-type 4, range 0-22
function gaussianScore() {
  // Box-Muller
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let s = Math.round(8 + z * 4);
  if (s < 0) s = 0;
  if (s > 22) s = 22;
  return s;
}

function generateRound() {
  let scoreA = gaussianScore();
  let scoreB = gaussianScore();
  // Pas d'égalité (golden point sinon)
  while (scoreA === scoreB) {
    if (Math.random() < 0.5) scoreA = gaussianScore();
    else scoreB = gaussianScore();
  }
  return { scoreA, scoreB, winnerPosition: scoreA > scoreB ? "A" : "B" };
}

function generateMatchRounds() {
  let winsA = 0;
  let winsB = 0;
  const rounds = [];
  let n = 1;
  while (winsA < 2 && winsB < 2 && n <= 3) {
    const r = generateRound();
    if (r.winnerPosition === "A") winsA++;
    else winsB++;
    rounds.push({
      roundNumber: n,
      scoreA: r.scoreA,
      scoreB: r.scoreB,
      winnerPosition: r.winnerPosition,
      penaltyA: 0,
      penaltyB: 0,
    });
    n++;
  }
  return rounds;
}

async function main() {
  console.log(`API: ${API}`);
  const compsRes = await fetch(`${API}/competitions`);
  if (!compsRes.ok) throw new Error(`competitions: ${compsRes.status}`);
  const comps = await compsRes.json();
  const comp = comps.find((c) => c.name === COMPETITION_NAME);
  if (!comp) {
    console.error(`❌ Compétition "${COMPETITION_NAME}" introuvable`);
    process.exit(1);
  }
  console.log(`✓ ${comp.name} (${comp.id})`);

  const matchesRes = await fetch(`${API}/competition/${comp.id}/matchesWithDetails`);
  if (!matchesRes.ok) throw new Error(`matches: ${matchesRes.status}`);
  const matches = await matchesRes.json();
  console.log(`→ ${matches.length} matchs au total`);

  // On retraite TOUS les matchs avec 2 participants (overwrite des résultats existants)
  const pending = matches.filter((m) => m.matchParticipants?.length === 2);
  console.log(`→ ${pending.length} matchs à (re)remplir`);

  let ok = 0;
  let fail = 0;
  for (const match of pending) {
    const rounds = generateMatchRounds();
    try {
      const res = await fetch(`${API}/match/${match.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rounds }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 100)}`);
      }
      ok++;
      if (ok % 20 === 0) console.log(`  ... ${ok}/${pending.length}`);
    } catch (err) {
      fail++;
      console.error(`✗ match ${match.matchNumber}: ${err.message}`);
    }
  }

  console.log(`\n✅ ${ok} remplis, ${fail} échecs`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
