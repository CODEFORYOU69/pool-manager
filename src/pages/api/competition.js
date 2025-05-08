import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Méthode non autorisée" });
  }

  try {
    const competitionData = req.body;
    console.log("Données reçues:", competitionData);

    const result = competitionData.id
      ? await prisma.competition.update({
          where: { id: competitionData.id },
          data: {
            name: competitionData.name,
            date: new Date(competitionData.date || Date.now()),
            startTime: new Date(competitionData.startTime || Date.now()),
            roundDuration: competitionData.roundDuration || 120,
            breakDuration: competitionData.breakDuration || 300,
            breakFrequency: competitionData.breakFrequency || 10,
            poolSize: competitionData.poolSize,
            updatedAt: new Date(),
          },
        })
      : await prisma.competition.create({
          data: {
            name: competitionData.name || "Compétition de Taekwondo",
            date: new Date(competitionData.date || Date.now()),
            startTime: new Date(competitionData.startTime || Date.now()),
            roundDuration: competitionData.roundDuration || 120,
            breakDuration: competitionData.breakDuration || 300,
            breakFrequency: competitionData.breakFrequency || 10,
            poolSize: competitionData.poolSize || 4,
          },
        });

    console.log("Résultat de la sauvegarde:", result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Erreur serveur:", error);
    res.status(500).json({
      error: "Erreur lors de la sauvegarde de la compétition",
      details: error.message,
    });
  }
}
