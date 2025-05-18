const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Route pour initialiser/sauvegarder une compétition
app.post("/api/competition", async (req, res) => {
  try {
    const competitionData = req.body;
    console.log(
      "Données reçues pour création de compétition:",
      competitionData
    );
    console.log(
      "poolSize reçu:",
      competitionData.poolSize,
      "type:",
      typeof competitionData.poolSize
    );
    console.log(
      "numAreas reçu:",
      competitionData.numAreas,
      "type:",
      typeof competitionData.numAreas
    );

    // Créer la compétition
    const result = await prisma.competition.create({
      data: {
        name: competitionData.name,
        date: new Date(competitionData.date),
        startTime: new Date(competitionData.startTime),
        roundDuration: competitionData.roundDuration,
        breakDuration: competitionData.breakDuration,
        breakFrequency: competitionData.breakFrequency,
        poolSize: competitionData.poolSize || 4, // Valeur par défaut 4 si non spécifiée
      },
    });

    // Créer les aires de combat si numAreas est spécifié
    if (competitionData.numAreas && competitionData.numAreas > 0) {
      console.log(`Création de ${competitionData.numAreas} aires de combat`);

      const areasToCreate = [];
      for (let i = 1; i <= competitionData.numAreas; i++) {
        areasToCreate.push({
          areaNumber: i,
          competitionId: result.id,
        });
      }

      await prisma.area.createMany({
        data: areasToCreate,
      });

      console.log(`${areasToCreate.length} aires de combat créées`);
    }

    console.log("Compétition créée:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la création de la compétition:", error);
    res.status(500).json({
      error: "Erreur lors de la création de la compétition",
      details: error.message,
    });
  }
});

// Route pour mettre à jour une compétition existante
app.put("/api/competition/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const competitionData = req.body;
    console.log(
      `Données reçues pour mise à jour de la compétition ${id}:`,
      competitionData
    );
    console.log(
      "poolSize reçu:",
      competitionData.poolSize,
      "type:",
      typeof competitionData.poolSize
    );
    console.log(
      "numAreas reçu:",
      competitionData.numAreas,
      "type:",
      typeof competitionData.numAreas
    );

    // Vérifier que la compétition existe
    const existingCompetition = await prisma.competition.findUnique({
      where: { id },
      include: {
        areas: true,
      },
    });

    if (!existingCompetition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Mettre à jour la compétition
    const result = await prisma.competition.update({
      where: { id },
      data: {
        name: competitionData.name,
        date: competitionData.date
          ? new Date(competitionData.date)
          : existingCompetition.date,
        startTime: competitionData.startTime
          ? new Date(competitionData.startTime)
          : existingCompetition.startTime,
        roundDuration:
          competitionData.roundDuration || existingCompetition.roundDuration,
        breakDuration:
          competitionData.breakDuration || existingCompetition.breakDuration,
        breakFrequency:
          competitionData.breakFrequency || existingCompetition.breakFrequency,
        poolSize: competitionData.poolSize || existingCompetition.poolSize,
      },
    });

    // Mettre à jour les aires si numAreas est spécifié et différent du nombre actuel
    if (
      competitionData.numAreas &&
      competitionData.numAreas > 0 &&
      competitionData.numAreas !== existingCompetition.areas.length
    ) {
      console.log(
        `Mise à jour du nombre d'aires : ${existingCompetition.areas.length} -> ${competitionData.numAreas}`
      );

      // Supprimer toutes les aires existantes
      await prisma.area.deleteMany({
        where: { competitionId: id },
      });

      // Créer le nouveau nombre d'aires
      const areasToCreate = [];
      for (let i = 1; i <= competitionData.numAreas; i++) {
        areasToCreate.push({
          areaNumber: i,
          competitionId: id,
        });
      }

      await prisma.area.createMany({
        data: areasToCreate,
      });

      console.log(`${areasToCreate.length} nouvelles aires de combat créées`);
    }

    console.log("Compétition mise à jour:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la compétition:", error);
    res.status(500).json({
      error: "Erreur lors de la mise à jour de la compétition",
      details: error.message,
    });
  }
});

// Route pour initialiser/sauvegarder un groupe
app.post("/api/group", async (req, res) => {
  try {
    const groupData = req.body;
    console.log("Données de groupe reçues:", groupData);

    // Validation des données
    if (!groupData.competitionId) {
      return res.status(400).json({
        message: "ID de compétition manquant",
        details: "L'ID de compétition est requis pour créer un groupe",
      });
    }

    if (!groupData.gender) {
      return res.status(400).json({
        message: "Genre manquant",
        details: "Le genre est requis pour créer un groupe",
      });
    }

    if (!groupData.ageCategoryName) {
      return res.status(400).json({
        message: "Nom de catégorie d'âge manquant",
        details: "Le nom de la catégorie d'âge est requis pour créer un groupe",
      });
    }

    if (
      groupData.ageCategoryMin === undefined ||
      groupData.ageCategoryMin === null
    ) {
      return res.status(400).json({
        message: "Informations de catégorie d'âge incomplètes",
        details: "L'âge minimum est requis pour la catégorie d'âge",
      });
    }

    if (
      groupData.ageCategoryMax === undefined ||
      groupData.ageCategoryMax === null
    ) {
      return res.status(400).json({
        message: "Informations de catégorie d'âge incomplètes",
        details: "L'âge maximum est requis pour la catégorie d'âge",
      });
    }

    if (!groupData.weightCategoryName) {
      return res.status(400).json({
        message: "Nom de catégorie de poids manquant",
        details:
          "Le nom de la catégorie de poids est requis pour créer un groupe",
      });
    }

    if (
      groupData.weightCategoryMax === undefined ||
      groupData.weightCategoryMax === null
    ) {
      return res.status(400).json({
        message: "Informations de catégorie de poids incomplètes",
        details: "Le poids maximum est requis pour la catégorie de poids",
      });
    }

    // Vérifier si la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id: groupData.competitionId },
    });

    if (!competition) {
      return res.status(404).json({
        message: "Compétition non trouvée",
        details: `Aucune compétition trouvée avec l'ID: ${groupData.competitionId}`,
      });
    }

    // Créer le groupe
    const result = await prisma.group.create({
      data: {
        gender: groupData.gender,
        ageCategoryName: groupData.ageCategoryName,
        ageCategoryMin: groupData.ageCategoryMin,
        ageCategoryMax: groupData.ageCategoryMax,
        weightCategoryName: groupData.weightCategoryName,
        weightCategoryMax: groupData.weightCategoryMax,
        competition: {
          connect: { id: groupData.competitionId },
        },
      },
    });

    console.log("Groupe créé:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la création du groupe:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création du groupe",
      details: error.message,
    });
  }
});

// Route pour récupérer un groupe spécifique
app.get("/api/group/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        pools: true,
        competition: true,
      },
    });

    if (!group) {
      return res.status(404).json({
        message: "Groupe non trouvé",
        details: `Aucun groupe trouvé avec l'ID: ${id}`,
      });
    }

    res.json(group);
  } catch (error) {
    console.error("Erreur lors de la récupération du groupe:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération du groupe",
      details: error.message,
    });
  }
});

// Route pour récupérer les poules d'un groupe
app.get("/api/group/:id/pools", async (req, res) => {
  try {
    const { id } = req.params;
    const pools = await prisma.pool.findMany({
      where: { groupId: id },
      include: {
        poolParticipants: {
          include: {
            participant: true,
          },
        },
      },
    });

    if (pools.length === 0) {
      return res.status(404).json({
        message: "Aucune poule trouvée pour ce groupe",
        details: `Aucune poule associée au groupe avec l'ID: ${id}`,
      });
    }

    res.json(pools);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des poules du groupe:",
      error
    );
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des poules",
      details: error.message,
    });
  }
});

// Route pour créer une poule
app.post("/api/pool", async (req, res) => {
  try {
    const poolData = req.body;
    console.log("Données de poule reçues:", poolData);

    // Validation des données
    if (!poolData.groupId) {
      return res.status(400).json({
        message: "ID de groupe manquant",
        details: "L'ID de groupe est requis pour créer une poule",
      });
    }

    if (poolData.poolIndex === undefined || poolData.poolIndex === null) {
      return res.status(400).json({
        message: "Index de poule manquant",
        details: "L'index de la poule est requis",
      });
    }

    // Vérifier si le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: poolData.groupId },
    });

    if (!group) {
      return res.status(404).json({
        message: "Groupe non trouvé",
        details: `Aucun groupe trouvé avec l'ID: ${poolData.groupId}`,
      });
    }

    // Vérifier si une poule avec le même index existe déjà dans ce groupe
    const existingPool = await prisma.pool.findFirst({
      where: {
        groupId: poolData.groupId,
        poolIndex: poolData.poolIndex,
      },
    });

    if (existingPool) {
      return res.status(409).json({
        message: "Poule déjà existante",
        details: `Une poule avec l'index ${poolData.poolIndex} existe déjà dans ce groupe`,
        existingPool,
      });
    }

    // Créer la poule
    const result = await prisma.pool.create({
      data: {
        poolIndex: poolData.poolIndex,
        group: {
          connect: { id: poolData.groupId },
        },
      },
    });

    console.log("Poule créée:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la création de la poule:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création de la poule",
      details: error.message,
    });
  }
});

// Route pour récupérer une poule spécifique
app.get("/api/pool/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        group: true,
        poolParticipants: {
          include: {
            participant: true,
          },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({
        message: "Poule non trouvée",
        details: `Aucune poule trouvée avec l'ID: ${id}`,
      });
    }

    res.json(pool);
  } catch (error) {
    console.error("Erreur lors de la récupération de la poule:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération de la poule",
      details: error.message,
    });
  }
});

// Route pour sauvegarder un participant de poule
app.post("/api/poolParticipant", async (req, res) => {
  console.log("POST /api/poolParticipant - Corps de la requête:", req.body);

  // Validation des données
  const { poolId, participantId } = req.body;

  if (!poolId) {
    return res.status(400).json({
      message: "poolId est requis",
      details: "Veuillez fournir un ID de poule valide",
    });
  }

  if (!participantId) {
    return res.status(400).json({
      message: "participantId est requis",
      details: "Veuillez fournir un ID de participant valide",
    });
  }

  try {
    // Vérifier que la poule existe
    const existingPool = await prisma.pool.findUnique({
      where: { id: poolId },
    });

    if (!existingPool) {
      return res.status(404).json({
        message: "Poule non trouvée",
        details: `Aucune poule trouvée avec l'ID: ${poolId}`,
      });
    }

    // Vérifier que le participant existe
    const existingParticipant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!existingParticipant) {
      return res.status(404).json({
        message: "Participant non trouvé",
        details: `Aucun participant trouvé avec l'ID: ${participantId}`,
      });
    }

    // Vérifier si ce participant est déjà dans cette poule
    const existingAssociation = await prisma.poolParticipant.findFirst({
      where: {
        poolId,
        participantId,
      },
    });

    if (existingAssociation) {
      return res.status(409).json({
        message: "Participant déjà dans la poule",
        details: `Le participant ${participantId} est déjà associé à la poule ${poolId}`,
        existingAssociation,
      });
    }

    // Créer l'association
    const poolParticipant = await prisma.poolParticipant.create({
      data: {
        pool: { connect: { id: poolId } },
        participant: { connect: { id: participantId } },
      },
      include: {
        participant: true,
      },
    });

    res.status(201).json(poolParticipant);
  } catch (error) {
    console.error("Erreur lors de la création du participant de poule:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création du participant de poule",
      details: error.message,
    });
  }
});

// Route pour créer un match
app.post("/api/match", async (req, res) => {
  try {
    console.log("Données du match reçues:", req.body);

    const { matchNumber, startTime, status, groupId, poolIndex, areaNumber } =
      req.body;

    // Vérifier si le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { pools: true },
    });

    if (!group) {
      throw new Error(`Groupe non trouvé avec l'ID: ${groupId}`);
    }

    console.log("Groupe trouvé:", group);
    console.log("Pools du groupe:", group.pools);

    // Trouver la pool correspondante
    console.log("Recherche pool avec critères:", { groupId, poolIndex });
    const pool = group.pools.find((p) => p.poolIndex === poolIndex);

    if (!pool) {
      throw new Error(
        `Pool non trouvée pour le groupe ${groupId} et l'index ${poolIndex}`
      );
    }

    console.log("Pool à utiliser:", pool);

    // Créer ou récupérer l'aire de combat
    let area = await prisma.area.findFirst({
      where: {
        AND: [{ areaNumber }, { competitionId: group.competitionId }],
      },
    });

    if (!area) {
      area = await prisma.area.create({
        data: {
          areaNumber,
          competition: {
            connect: { id: group.competitionId },
          },
        },
      });
    }

    // Créer le match avec toutes les relations nécessaires
    const result = await prisma.match.create({
      data: {
        matchNumber,
        startTime: new Date(startTime),
        status,
        winner: null,
        endTime: null,
        poolIndex,
        group: {
          connect: { id: groupId },
        },
        pool: {
          connect: { id: pool.id },
        },
        area: {
          connect: { id: area.id },
        },
      },
      include: {
        matchParticipants: true,
        rounds: true,
        group: true,
        pool: true,
        area: true,
      },
    });

    res.json(result);
  } catch (error) {
    console.error("Erreur détaillée lors de la création du match:", error);
    res.status(400).json({ message: error.message });
  }
});

// Route pour récupérer un match spécifique
app.get("/api/match/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        matchParticipants: {
          include: {
            participant: true,
          },
        },
        rounds: true,
        group: true,
        pool: true,
        area: true,
      },
    });

    if (!match) {
      return res.status(404).json({ message: "Match non trouvé" });
    }

    res.json(match);
  } catch (error) {
    console.error("Erreur lors de la récupération du match:", error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour récupérer les matches terminés
app.get("/api/match", async (req, res) => {
  try {
    const { status, competitionId } = req.query;
    console.log(
      "Recherche des matches avec status:",
      status,
      "et competitionId:",
      competitionId
    );

    const matches = await prisma.match.findMany({
      where: {
        status,
        group: {
          competitionId: competitionId, // Suppression du parseInt car c'est un UUID
        },
      },
      include: {
        matchParticipants: {
          include: {
            participant: true,
          },
        },
        rounds: true,
        group: true,
        pool: true,
        area: true,
      },
      orderBy: {
        endTime: "desc",
      },
    });

    console.log("Matches trouvés:", matches.length);
    res.json(matches);
  } catch (error) {
    console.error("Erreur lors de la récupération des matches:", error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour sauvegarder un participant
app.post("/api/participant", async (req, res) => {
  try {
    const participantData = req.body;
    console.log("Données du participant reçues:", participantData);

    const result = await prisma.participant.create({
      data: {
        nom: participantData.nom,
        prenom: participantData.prenom,
        sexe: participantData.sexe,
        age: participantData.age,
        poids: participantData.poids,
        ligue: participantData.ligue,
        club: participantData.club,
        competitionId: participantData.competitionId,
      },
    });

    console.log("Participant créé:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la création du participant:", error);
    res.status(500).json({
      error: "Erreur lors de la création du participant",
      message: error.message,
    });
  }
});

// Route pour mettre à jour un match existant
app.put("/api/match/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const matchData = req.body;
    console.log("Mise à jour du match:", id, matchData);

    // Vérifier que le match existe
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      include: { rounds: true },
    });

    if (!existingMatch) {
      return res.status(404).json({ message: "Match non trouvé" });
    }

    // Supprimer les anciens rounds
    await prisma.round.deleteMany({
      where: { matchId: id },
    });

    // Mettre à jour le match
    const result = await prisma.match.update({
      where: { id },
      data: {
        status: matchData.status,
        winner: matchData.winner,
        endTime: matchData.endTime ? new Date(matchData.endTime) : null,
        rounds: {
          create: matchData.rounds.map((round, index) => ({
            roundNumber: index + 1,
            scoreA: round.scoreA || round.fighterA || 0,
            scoreB: round.scoreB || round.fighterB || 0,
            winner: round.winner,
          })),
        },
      },
      include: {
        rounds: true,
        matchParticipants: {
          include: {
            participant: true,
          },
        },
      },
    });

    console.log("Match mis à jour:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du match:", error);
    res.status(500).json({
      error: "Erreur lors de la mise à jour du match",
      message: error.message,
    });
  }
});

// Route pour sauvegarder un participant de match
app.post("/api/matchParticipant", async (req, res) => {
  console.log("POST /api/matchParticipant - Corps de la requête:", req.body);

  // Validation des données
  const { position, matchId, participantId } = req.body;

  if (!matchId) {
    return res.status(400).json({
      message: "matchId est requis",
      details: "Veuillez fournir un ID de match valide",
    });
  }

  if (!participantId) {
    return res.status(400).json({
      message: "participantId est requis",
      details: "Veuillez fournir un ID de participant valide",
    });
  }

  if (!position || !["A", "B"].includes(position)) {
    return res.status(400).json({
      message: "position invalide",
      details: "La position doit être A ou B",
    });
  }

  try {
    // Vérifier que le match existe
    const existingMatch = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!existingMatch) {
      return res.status(404).json({
        message: "Match non trouvé",
        details: `Aucun match trouvé avec l'ID: ${matchId}`,
      });
    }

    // Vérifier que le participant existe
    const existingParticipant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!existingParticipant) {
      return res.status(404).json({
        message: "Participant non trouvé",
        details: `Aucun participant trouvé avec l'ID: ${participantId}`,
      });
    }

    // Vérifier si ce participant est déjà associé à ce match avec cette position
    const existingAssociation = await prisma.matchParticipant.findFirst({
      where: {
        matchId,
        position,
      },
    });

    if (existingAssociation) {
      if (existingAssociation.participantId === participantId) {
        return res.status(409).json({
          message: "Association déjà existante",
          details: `Le participant ${participantId} est déjà en position ${position} pour ce match`,
          existingAssociation,
        });
      } else {
        // Si un autre participant occupe déjà cette position, on le remplace
        const updatedAssociation = await prisma.matchParticipant.update({
          where: { id: existingAssociation.id },
          data: { participantId },
        });
        return res.status(200).json(updatedAssociation);
      }
    }

    // Créer l'association
    const matchParticipant = await prisma.matchParticipant.create({
      data: {
        position,
        match: { connect: { id: matchId } },
        participant: { connect: { id: participantId } },
      },
      include: {
        participant: true,
      },
    });

    res.status(201).json(matchParticipant);
  } catch (error) {
    console.error("Erreur lors de la création du participant de match:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création du participant de match",
      details: error.message,
    });
  }
});

// Route pour sauvegarder un round
app.post("/api/round", async (req, res) => {
  try {
    const roundData = req.body;
    console.log("Données du round reçues:", roundData);

    const result = await prisma.round.create({
      data: {
        scoreA: roundData.scoreA,
        scoreB: roundData.scoreB,
        winner: roundData.winner,
        matchId: roundData.matchId,
      },
    });

    console.log("Round créé:", result);
    res.json(result);
  } catch (error) {
    console.error("Erreur lors de la création du round:", error);
    res.status(500).json({
      error: "Erreur lors de la création du round",
      details: error.message,
    });
  }
});

// Route pour récupérer un participant spécifique
app.get("/api/participant/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const participant = await prisma.participant.findUnique({
      where: { id },
    });

    if (!participant) {
      return res.status(404).json({
        message: "Participant non trouvé",
        details: { participantId: id },
      });
    }

    res.json(participant);
  } catch (error) {
    console.error("Erreur lors de la récupération du participant:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération du participant",
      details: error.message,
    });
  }
});

// Route pour récupérer toutes les compétitions
app.get("/api/competitions", async (req, res) => {
  try {
    const competitions = await prisma.competition.findMany({
      orderBy: {
        date: "desc",
      },
      include: {
        _count: {
          select: {
            groups: true,
            participants: true,
          },
        },
      },
    });

    res.json(competitions);
  } catch (error) {
    console.error("Erreur lors de la récupération des compétitions:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des compétitions",
      details: error.message,
    });
  }
});

// Route pour récupérer une compétition spécifique avec ses détails
app.get("/api/competition/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        participants: true,
        areas: true,
        groups: {
          include: {
            pools: {
              include: {
                poolParticipants: {
                  include: { participant: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            groups: true,
            participants: true,
            areas: true,
          },
        },
      },
    });

    if (!competition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Ajouter une propriété numAreas plus explicite pour faciliter l'utilisation côté client
    const responseData = {
      ...competition,
      numAreas: competition.areas.length,
    };

    res.json(responseData);
  } catch (error) {
    console.error("Erreur lors de la récupération de la compétition:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de la compétition",
      details: error.message,
    });
  }
});

// Route pour supprimer une compétition
app.delete("/api/competition/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Suppression de la compétition: ${id}`);

    // Vérifier que la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Approche de suppression explicite pour chaque relation, suivie d'une suppression en cascade
    // Nous supprimons les entités dans l'ordre inverse des dépendances

    // 1. Supprimer d'abord les rounds car ils dépendent des matchs
    console.log("Suppression des rounds...");
    await prisma.round.deleteMany({
      where: {
        match: {
          group: {
            competitionId: id,
          },
        },
      },
    });

    // 2. Supprimer les matchParticipants car ils dépendent des matchs
    console.log("Suppression des matchParticipants...");
    await prisma.matchParticipant.deleteMany({
      where: {
        match: {
          group: {
            competitionId: id,
          },
        },
      },
    });

    // 3. Supprimer les matchs
    console.log("Suppression des matchs...");
    await prisma.match.deleteMany({
      where: {
        group: {
          competitionId: id,
        },
      },
    });

    // 4. Supprimer les pauses
    console.log("Suppression des pauses...");
    await prisma.break.deleteMany({
      where: {
        area: {
          competitionId: id,
        },
      },
    });

    // 5. Supprimer les poolParticipants
    console.log("Suppression des poolParticipants...");
    await prisma.poolParticipant.deleteMany({
      where: {
        pool: {
          group: {
            competitionId: id,
          },
        },
      },
    });

    // 6. Supprimer les pools
    console.log("Suppression des pools...");
    await prisma.pool.deleteMany({
      where: {
        group: {
          competitionId: id,
        },
      },
    });

    // 7. Supprimer les participantGroups
    console.log("Suppression des participantGroups...");
    await prisma.participantGroup.deleteMany({
      where: {
        group: {
          competitionId: id,
        },
      },
    });

    // 8. Supprimer les aires
    console.log("Suppression des aires...");
    await prisma.area.deleteMany({
      where: {
        competitionId: id,
      },
    });

    // 9. Supprimer les groupes
    console.log("Suppression des groupes...");
    await prisma.group.deleteMany({
      where: {
        competitionId: id,
      },
    });

    // 10. Supprimer les participants
    console.log("Suppression des participants...");
    await prisma.participant.deleteMany({
      where: {
        competitionId: id,
      },
    });

    // 11. Finalement, supprimer la compétition elle-même
    console.log("Suppression de la compétition...");
    await prisma.competition.delete({
      where: { id },
    });

    res.json({
      message:
        "Compétition et toutes ses données associées supprimées avec succès",
      deletedCompetitionId: id,
      deletedCompetitionName: competition.name,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de la compétition:", error);
    res.status(500).json({
      error: "Erreur lors de la suppression de la compétition",
      details: error.message,
    });
  }
});

// Route pour associer un participant à un groupe
app.post("/api/participantGroup", async (req, res) => {
  try {
    const { participantId, groupId } = req.body;

    // Validation des données
    if (!participantId) {
      return res.status(400).json({
        message: "ID de participant manquant",
        details: "L'ID du participant est requis",
      });
    }

    if (!groupId) {
      return res.status(400).json({
        message: "ID de groupe manquant",
        details: "L'ID du groupe est requis",
      });
    }

    // Vérifier que le participant existe
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return res.status(404).json({
        message: "Participant non trouvé",
        details: `Aucun participant trouvé avec l'ID ${participantId}`,
      });
    }

    // Vérifier que le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({
        message: "Groupe non trouvé",
        details: `Aucun groupe trouvé avec l'ID ${groupId}`,
      });
    }

    // Vérifier si l'association existe déjà
    const existingAssociation = await prisma.participantGroup.findFirst({
      where: {
        participantId: participantId,
        groupId: groupId,
      },
    });

    if (existingAssociation) {
      return res.json(existingAssociation);
    }

    // Créer l'association
    const participantGroup = await prisma.participantGroup.create({
      data: {
        participantId: participantId,
        groupId: groupId,
      },
    });

    res.status(201).json(participantGroup);
  } catch (error) {
    console.error(
      "Erreur lors de l'association du participant au groupe:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de l'association du participant au groupe",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les participants d'un groupe
app.get("/api/group/:id/participants", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le groupe existe
    const group = await prisma.group.findUnique({
      where: { id },
    });

    if (!group) {
      return res.status(404).json({
        message: "Groupe non trouvé",
        details: `Aucun groupe trouvé avec l'ID ${id}`,
      });
    }

    // Récupérer tous les participants du groupe
    const participantGroups = await prisma.participantGroup.findMany({
      where: { groupId: id },
      include: { participant: true },
    });

    const participants = participantGroups.map((pg) => pg.participant);

    res.json(participants);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des participants du groupe:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des participants du groupe",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les groupes d'un participant
app.get("/api/participant/:id/groups", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le participant existe
    const participant = await prisma.participant.findUnique({
      where: { id },
    });

    if (!participant) {
      return res.status(404).json({
        message: "Participant non trouvé",
        details: `Aucun participant trouvé avec l'ID ${id}`,
      });
    }

    // Récupérer tous les groupes du participant
    const participantGroups = await prisma.participantGroup.findMany({
      where: { participantId: id },
      include: { group: true },
    });

    const groups = participantGroups.map((pg) => pg.group);

    res.json(groups);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des groupes du participant:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des groupes du participant",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les groupes d'une compétition
app.get("/api/competition/:id/groups", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Récupérer tous les groupes de la compétition
    const groups = await prisma.group.findMany({
      where: { competitionId: id },
      include: {
        pools: true,
        _count: {
          select: {
            participants: true,
            pools: true,
          },
        },
      },
      orderBy: [
        { gender: "asc" },
        { ageCategoryName: "asc" },
        { weightCategoryName: "asc" },
      ],
    });

    res.json(groups);
  } catch (error) {
    console.error("Erreur lors de la récupération des groupes:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des groupes",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les groupes d'une compétition avec détails complets
app.get("/api/competition/:id/groupsWithDetails", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Récupérer tous les groupes de la compétition avec leurs pools et participants
    const groups = await prisma.group.findMany({
      where: { competitionId: id },
      include: {
        pools: {
          include: {
            poolParticipants: {
              include: {
                participant: true,
              },
            },
          },
        },
        participants: {
          include: {
            participant: true,
          },
        },
      },
      orderBy: [
        { gender: "asc" },
        { ageCategoryName: "asc" },
        { weightCategoryName: "asc" },
      ],
    });

    res.json(groups);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des groupes avec détails:",
      error
    );
    res.status(500).json({
      error: "Erreur lors de la récupération des groupes avec détails",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les matchs d'une compétition
app.get("/api/competition/:id/matches", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Récupérer tous les matchs de la compétition
    const matches = await prisma.match.findMany({
      where: {
        group: {
          competitionId: id,
        },
      },
      include: {
        group: true,
        pool: true,
        area: true,
        _count: {
          select: {
            matchParticipants: true,
          },
        },
      },
      orderBy: [{ matchNumber: "asc" }],
    });

    res.json(matches);
  } catch (error) {
    console.error("Erreur lors de la récupération des matchs:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des matchs",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les matchs d'une compétition avec détails complets
app.get("/api/competition/:id/matchesWithDetails", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      return res.status(404).json({ message: "Compétition non trouvée" });
    }

    // Récupérer tous les matchs de la compétition avec leurs participants
    const matches = await prisma.match.findMany({
      where: {
        group: {
          competitionId: id,
        },
      },
      include: {
        group: true,
        pool: true,
        area: true,
        matchParticipants: {
          include: {
            participant: true,
          },
        },
        rounds: true,
      },
      orderBy: [{ matchNumber: "asc" }],
    });

    res.json(matches);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des matchs avec détails:",
      error
    );
    res.status(500).json({
      error: "Erreur lors de la récupération des matchs avec détails",
      details: error.message,
    });
  }
});

// Route pour récupérer tous les participants d'une compétition
app.get("/api/participants", async (req, res) => {
  try {
    const { competitionId } = req.query;

    if (!competitionId) {
      return res.status(400).json({
        message: "Paramètre competitionId requis",
        details: "Veuillez fournir l'ID de la compétition",
      });
    }

    // Vérifier que la compétition existe
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
    });

    if (!competition) {
      return res.status(404).json({
        message: "Compétition non trouvée",
        details: `Aucune compétition trouvée avec l'ID ${competitionId}`,
      });
    }

    // Récupérer tous les participants de la compétition
    const participants = await prisma.participant.findMany({
      where: { competitionId: competitionId },
    });

    res.json(participants);
  } catch (error) {
    console.error("Erreur lors de la récupération des participants:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération des participants",
      details: error.message,
    });
  }
});

// Route pour récupérer un match par son numéro
app.get("/api/match/byNumber/:competitionId/:matchNumber", async (req, res) => {
  try {
    const { competitionId, matchNumber } = req.params;
    const matchNum = parseInt(matchNumber, 10);

    if (isNaN(matchNum)) {
      return res.status(400).json({
        message: "Numéro de match invalide",
        details: "Le numéro de match doit être un nombre",
      });
    }

    console.log(
      `Recherche du match numéro ${matchNum} pour la compétition ${competitionId}`
    );

    // Trouver le match par son numéro et la compétition associée via le groupe
    const match = await prisma.match.findFirst({
      where: {
        matchNumber: matchNum,
        group: {
          competitionId: competitionId,
        },
      },
      include: {
        matchParticipants: {
          include: {
            participant: true,
          },
        },
        rounds: true,
        group: true,
        pool: true,
        area: true,
      },
    });

    if (!match) {
      return res.status(404).json({
        message: "Match non trouvé",
        details: `Aucun match trouvé avec le numéro ${matchNum} pour cette compétition`,
      });
    }

    console.log(`Match #${matchNum} trouvé avec ID: ${match.id}`);
    res.json(match);
  } catch (error) {
    console.error("Erreur lors de la récupération du match par numéro:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération du match",
      message: error.message,
    });
  }
});

// Nouvel endpoint spécifique pour sauvegarder les résultats d'un match
app.post("/api/match/:id/results", async (req, res) => {
  try {
    const { id } = req.params;
    const resultsData = req.body;
    console.log("Sauvegarde des résultats pour le match:", id);
    console.log("Données reçues:", resultsData);

    // Vérifier que le match existe
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      include: {
        matchParticipants: {
          include: {
            participant: true,
          },
        },
      },
    });

    if (!existingMatch) {
      return res.status(404).json({
        message: "Match non trouvé",
        details: `Aucun match trouvé avec l'ID ${id}`,
      });
    }

    // Récupérer les IDs des participants
    const participantA = existingMatch.matchParticipants.find(
      (p) => p.position === "A"
    );
    const participantB = existingMatch.matchParticipants.find(
      (p) => p.position === "B"
    );

    if (!participantA || !participantB) {
      return res.status(400).json({
        message: "Participants incomplets",
        details:
          "Le match ne possède pas les deux participants requis (A et B)",
      });
    }

    // Vérifier quels participants sont en positions A et B
    console.log(
      "Participant A:",
      participantA.participantId,
      participantA.participant.prenom,
      participantA.participant.nom
    );
    console.log(
      "Participant B:",
      participantB.participantId,
      participantB.participant.prenom,
      participantB.participant.nom
    );

    // Calculer le vainqueur en fonction des rounds gagnés
    let winnerPosition = null;
    let winnerId = null;
    let matchStatus = "completed"; // Par défaut, le match est terminé quand on sauvegarde les résultats
    let pointMatch = 0;

    // Compter les rounds gagnés par chaque athlète
    const roundsWonByA = resultsData.rounds.filter(
      (r) => r.winnerPosition === "A" || r.winner === "A"
    ).length;
    const roundsWonByB = resultsData.rounds.filter(
      (r) => r.winnerPosition === "B" || r.winner === "B"
    ).length;

    // Déterminer le vainqueur du match
    if (roundsWonByA > roundsWonByB) {
      winnerPosition = "A";
      winnerId = participantA.participantId;
      pointMatch = 3; // 3 points pour une victoire
    } else if (roundsWonByB > roundsWonByA) {
      winnerPosition = "B";
      winnerId = participantB.participantId;
      pointMatch = 3; // 3 points pour une victoire
    }

    console.log(
      `Vainqueur calculé: ${winnerPosition} (A: ${roundsWonByA} rounds, B: ${roundsWonByB} rounds)`
    );
    console.log(`ID du vainqueur: ${winnerId}`);
    console.log(`Points attribués: ${pointMatch}`);

    // Transaction pour garantir la cohérence des données
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Supprimer d'abord les rounds existants
      await prisma.round.deleteMany({
        where: { matchId: id },
      });

      // 2. Mettre à jour le match avec ses informations générales
      const updatedMatch = await prisma.match.update({
        where: { id },
        data: {
          status: matchStatus,
          winner: winnerId, // Utiliser l'ID du participant au lieu de "A" ou "B"
          endTime: resultsData.endTime
            ? new Date(resultsData.endTime)
            : new Date(),
          pointMatch: pointMatch,
        },
      });

      // 3. Créer les nouveaux rounds
      const rounds = [];
      for (const [index, round] of resultsData.rounds.entries()) {
        // Déterminer l'ID du vainqueur du round et la position
        let roundWinnerId = null;
        let roundWinnerPosition = round.winnerPosition || round.winner;

        if (roundWinnerPosition === "A") {
          roundWinnerId = participantA.participantId;
        } else if (roundWinnerPosition === "B") {
          roundWinnerId = participantB.participantId;
        }

        const newRound = await prisma.round.create({
          data: {
            matchId: id,
            roundNumber: index + 1,
            scoreA: round.scoreA || round.fighterA || 0,
            scoreB: round.scoreB || round.fighterB || 0,
            winner: roundWinnerId, // Utiliser l'ID du participant au lieu de "A" ou "B"
            winnerPosition: roundWinnerPosition, // Garder l'information de la position (A ou B) dans un nouveau champ
          },
        });
        rounds.push(newRound);
      }

      // 4. Récupérer le match complet avec ses relations
      return prisma.match.findUnique({
        where: { id },
        include: {
          rounds: {
            orderBy: { roundNumber: "asc" },
          },
          matchParticipants: {
            include: {
              participant: true,
            },
          },
        },
      });
    });

    // Ajouter des propriétés utiles à la réponse
    const response = {
      ...result,
      winnerPosition, // Ajouter la position du vainqueur pour la référence du client
      winnerParticipant: winnerId
        ? result.matchParticipants.find((p) => p.participantId === winnerId)
            ?.participant
        : null,
    };

    console.log("Résultats sauvegardés avec succès:", response);
    res.json(response);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des résultats:", error);
    res.status(500).json({
      error: "Erreur lors de la sauvegarde des résultats",
      message: error.message,
    });
  }
});

// Route pour supprimer un groupe et toutes ses dépendances
app.delete("/api/group/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Demande de suppression du groupe ${id}`);

    // Vérifier que le groupe existe
    const existingGroup = await prisma.group.findUnique({
      where: { id },
      include: {
        pools: {
          include: {
            poolParticipants: true,
            matches: {
              include: {
                matchParticipants: true,
                rounds: true,
              },
            },
          },
        },
        participants: true,
      },
    });

    if (!existingGroup) {
      return res.status(404).json({
        message: "Groupe non trouvé",
        details: `Aucun groupe trouvé avec l'ID: ${id}`,
      });
    }

    // Transaction pour supprimer toutes les données associées au groupe
    await prisma.$transaction(async (prisma) => {
      // Pour chaque poule du groupe
      for (const pool of existingGroup.pools) {
        // Pour chaque match de la poule
        for (const match of pool.matches) {
          // Supprimer tous les rounds du match
          await prisma.round.deleteMany({
            where: { matchId: match.id },
          });

          // Supprimer toutes les associations match-participant
          await prisma.matchParticipant.deleteMany({
            where: { matchId: match.id },
          });
        }

        // Supprimer tous les matchs de la poule
        await prisma.match.deleteMany({
          where: { poolId: pool.id },
        });

        // Supprimer toutes les associations pool-participant
        await prisma.poolParticipant.deleteMany({
          where: { poolId: pool.id },
        });
      }

      // Supprimer toutes les poules du groupe
      await prisma.pool.deleteMany({
        where: { groupId: id },
      });

      // Supprimer toutes les associations groupe-participant
      await prisma.participantGroup.deleteMany({
        where: { groupId: id },
      });

      // Enfin, supprimer le groupe lui-même
      await prisma.group.delete({
        where: { id },
      });
    });

    console.log(`Groupe ${id} supprimé avec succès`);
    res.json({ success: true, message: `Groupe ${id} supprimé avec succès` });
  } catch (error) {
    console.error(
      `Erreur lors de la suppression du groupe ${req.params.id}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du groupe",
      details: error.message,
    });
  }
});

// Route pour supprimer tous les matchs d'une compétition
app.delete(
  "/api/match/deleteByCompetition/:competitionId",
  async (req, res) => {
    try {
      const { competitionId } = req.params;
      console.log(
        `Demande de suppression de tous les matchs de la compétition ${competitionId}`
      );

      // Vérifier que la compétition existe
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
      });

      if (!competition) {
        return res.status(404).json({
          success: false,
          message: "Compétition non trouvée",
          details: `Aucune compétition trouvée avec l'ID: ${competitionId}`,
        });
      }

      // Transaction pour supprimer tous les matchs de la compétition
      const result = await prisma.$transaction(async (prisma) => {
        // 1. Récupérer tous les matchs de la compétition
        const matches = await prisma.match.findMany({
          where: {
            group: {
              competitionId: competitionId,
            },
          },
          select: { id: true },
        });

        const matchIds = matches.map((match) => match.id);
        console.log(`${matchIds.length} matchs trouvés pour suppression`);

        // 2. Supprimer tous les rounds associés aux matchs
        if (matchIds.length > 0) {
          const deletedRounds = await prisma.round.deleteMany({
            where: {
              matchId: { in: matchIds },
            },
          });
          console.log(`${deletedRounds.count} rounds supprimés`);
        }

        // 3. Supprimer toutes les associations match-participant
        if (matchIds.length > 0) {
          const deletedMatchParticipants =
            await prisma.matchParticipant.deleteMany({
              where: {
                matchId: { in: matchIds },
              },
            });
          console.log(
            `${deletedMatchParticipants.count} associations match-participant supprimées`
          );
        }

        // 4. Supprimer les matchs eux-mêmes
        const deletedMatches = await prisma.match.deleteMany({
          where: {
            group: {
              competitionId: competitionId,
            },
          },
        });

        return { count: deletedMatches.count };
      });

      console.log(`${result.count} matchs supprimés avec succès`);
      res.json({
        success: true,
        message: `${result.count} matchs supprimés avec succès`,
        count: result.count,
      });
    } catch (error) {
      console.error(
        `Erreur lors de la suppression des matchs de la compétition ${req.params.competitionId}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Erreur lors de la suppression des matchs",
        details: error.message,
      });
    }
  }
);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0"; // Écouter sur toutes les interfaces réseau

app.listen(PORT, HOST, () => {
  console.log(`Serveur démarré sur http://${HOST}:${PORT}`);
  console.log(
    `Pour accéder depuis d'autres ordinateurs, utilisez l'adresse IP de ce serveur`
  );
});
