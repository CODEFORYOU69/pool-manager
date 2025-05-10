// Script de migration pour convertir les valeurs 'winner' de 'A'/'B' vers l'ID du participant
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function migrateWinnerValues() {
  console.log("Début de la migration des valeurs de vainqueurs...");

  try {
    // 1. Récupérer tous les matchs terminés avec un vainqueur 'A' ou 'B'
    const matches = await prisma.match.findMany({
      where: {
        status: "completed",
        OR: [{ winner: "A" }, { winner: "B" }],
      },
      include: {
        matchParticipants: {
          include: {
            participant: true,
          },
        },
      },
    });

    console.log(`${matches.length} matchs à mettre à jour trouvés.`);

    let successCount = 0;
    let errorCount = 0;

    // 2. Pour chaque match, récupérer l'ID du participant correspondant
    for (const match of matches) {
      try {
        const winnerPosition = match.winner; // 'A' ou 'B'

        // Trouver le participant correspondant
        const winnerParticipant = match.matchParticipants.find(
          (p) => p.position === winnerPosition
        );

        if (!winnerParticipant) {
          console.error(
            `Match ${match.id} (combat #${match.matchNumber}): participant ${winnerPosition} non trouvé.`
          );
          errorCount++;
          continue;
        }

        const winnerId = winnerParticipant.participantId;
        console.log(
          `Match ${match.id} (combat #${match.matchNumber}): Mise à jour du vainqueur de "${winnerPosition}" vers ID="${winnerId}"`
        );

        // Mettre à jour le match avec l'ID du participant vainqueur
        await prisma.match.update({
          where: { id: match.id },
          data: { winner: winnerId },
        });

        successCount++;
      } catch (error) {
        console.error(
          `Erreur lors de la mise à jour du match ${match.id}:`,
          error
        );
        errorCount++;
      }
    }

    console.log(
      `Migration terminée: ${successCount} matchs mis à jour avec succès, ${errorCount} échecs.`
    );
  } catch (error) {
    console.error("Erreur lors de la migration:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
migrateWinnerValues()
  .then(() => console.log("Script de migration terminé."))
  .catch((e) => console.error("Erreur dans le script de migration:", e));
