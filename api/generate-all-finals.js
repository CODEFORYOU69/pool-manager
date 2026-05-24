// Script one-shot : génère les finales pour toutes les poules de "test coupe 2026".
// Appelle POST /pool/:id/generateFinals pour chaque poule éligible.
// Usage : node generate-all-finals.js [API_URL]

const API = process.argv[2] || "http://localhost:3001/api";
const COMPETITION_NAME = "test coupe 2026";

async function main() {
  const compsRes = await fetch(`${API}/competitions`);
  const comps = await compsRes.json();
  const comp = comps.find((c) => c.name === COMPETITION_NAME);
  if (!comp) {
    console.error(`❌ Compétition "${COMPETITION_NAME}" introuvable`);
    process.exit(1);
  }
  console.log(`✓ ${comp.name} (${comp.id})`);

  const groupsRes = await fetch(
    `${API}/competition/${comp.id}/groupsWithDetails`
  );
  const groups = await groupsRes.json();

  const pools = [];
  for (const g of groups) {
    for (const p of g.pools || []) {
      pools.push({
        id: p.id,
        category: `${g.gender} - ${g.ageCategoryName} - ${g.weightCategoryName}`,
        nbParticipants: p.poolParticipants?.length || 0,
      });
    }
  }
  console.log(`→ ${pools.length} poules trouvées`);

  let ok = 0;
  let skipped = 0;
  let fail = 0;
  for (const p of pools) {
    try {
      const res = await fetch(`${API}/pool/${p.id}/generateFinals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (!res.ok) {
        // Souvent : "X match(s) de poule non terminé(s)" ou similaire
        console.log(`⊘ ${p.category} (n=${p.nbParticipants}) — ${body.message || res.status}`);
        skipped++;
        continue;
      }
      const nbCreated = body.matches?.length || 0;
      if (nbCreated === 0) {
        console.log(`✓ ${p.category} (n=${p.nbParticipants}) — classement direct`);
      } else {
        console.log(
          `✓ ${p.category} (n=${p.nbParticipants}) — ${nbCreated} matchs finales`
        );
      }
      ok++;
    } catch (err) {
      console.error(`✗ ${p.category}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n✅ ${ok} poules traitées, ${skipped} skip, ${fail} erreurs`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
