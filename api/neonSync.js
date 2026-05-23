// Use the dedicated Neon Prisma client (PostgreSQL) separate from local SQLite client
let neonPrismaModule;
try {
  neonPrismaModule = require(".prisma/client-neon");
} catch {
  neonPrismaModule = null;
}

let neonPrisma = null;

// Accept either SUPABASE_DATABASE_URL (new) or NEON_DATABASE_URL (historical name)
const CLOUD_DATABASE_URL =
  process.env.SUPABASE_DATABASE_URL || process.env.NEON_DATABASE_URL;

function getNeonPrisma() {
  if (!CLOUD_DATABASE_URL || !neonPrismaModule) return null;
  if (!neonPrisma) {
    neonPrisma = new neonPrismaModule.PrismaClient({
      datasources: { db: { url: CLOUD_DATABASE_URL } },
    });
    console.log("[NeonSync] Client cloud initialisé");
  }
  return neonPrisma;
}

/**
 * Sync an entire competition (and all its related data) to Neon.
 * Uses upsert for idempotency.
 */
async function syncCompetitionToNeon(localPrisma, competitionId) {
  const neon = getNeonPrisma();
  if (!neon) return; // Neon not configured, skip silently

  try {
    console.log(`[NeonSync] Début sync compétition ${competitionId}`);

    // 1. Fetch full competition data from local DB
    const competition = await localPrisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        areas: true,
        participants: true,
        groups: {
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
            participants: true, // ParticipantGroup
          },
        },
      },
    });

    if (!competition) {
      console.log(`[NeonSync] Compétition ${competitionId} non trouvée localement`);
      return;
    }

    // 2. Upsert competition
    await neon.competition.upsert({
      where: { id: competition.id },
      update: {
        name: competition.name,
        date: competition.date,
        startTime: competition.startTime,
        endTime: competition.endTime,
        roundDuration: competition.roundDuration,
        breakDuration: competition.breakDuration,
        breakFrequency: competition.breakFrequency,
        poolSize: competition.poolSize,
        tournamentType: competition.tournamentType,
        numAreas: competition.numAreas,
        visibleInSpectator: competition.visibleInSpectator ?? true,
        updatedAt: competition.updatedAt,
      },
      create: {
        id: competition.id,
        name: competition.name,
        date: competition.date,
        startTime: competition.startTime,
        endTime: competition.endTime,
        roundDuration: competition.roundDuration,
        breakDuration: competition.breakDuration,
        breakFrequency: competition.breakFrequency,
        poolSize: competition.poolSize,
        tournamentType: competition.tournamentType,
        numAreas: competition.numAreas,
        visibleInSpectator: competition.visibleInSpectator ?? true,
        createdAt: competition.createdAt,
        updatedAt: competition.updatedAt,
      },
    });

    // 3. Upsert areas
    for (const area of competition.areas) {
      await neon.area.upsert({
        where: { id: area.id },
        update: { areaNumber: area.areaNumber },
        create: {
          id: area.id,
          areaNumber: area.areaNumber,
          competitionId: competition.id,
        },
      });
    }

    // 4. Upsert participants
    for (const p of competition.participants) {
      await neon.participant.upsert({
        where: { id: p.id },
        update: {
          nom: p.nom, prenom: p.prenom, sexe: p.sexe,
          age: p.age, poids: p.poids, ligue: p.ligue, club: p.club,
        },
        create: {
          id: p.id, nom: p.nom, prenom: p.prenom, sexe: p.sexe,
          age: p.age, poids: p.poids, ligue: p.ligue, club: p.club,
          competitionId: competition.id,
        },
      });
    }

    // 5. Upsert groups, pools, participants, matches
    for (const group of competition.groups) {
      await neon.group.upsert({
        where: { id: group.id },
        update: {
          gender: group.gender,
          ageCategoryName: group.ageCategoryName,
          ageCategoryMin: group.ageCategoryMin,
          ageCategoryMax: group.ageCategoryMax,
          weightCategoryName: group.weightCategoryName,
          weightCategoryMax: group.weightCategoryMax,
        },
        create: {
          id: group.id,
          gender: group.gender,
          ageCategoryName: group.ageCategoryName,
          ageCategoryMin: group.ageCategoryMin,
          ageCategoryMax: group.ageCategoryMax,
          weightCategoryName: group.weightCategoryName,
          weightCategoryMax: group.weightCategoryMax,
          competitionId: competition.id,
        },
      });

      // ParticipantGroups - use compound unique key (participantId, groupId)
      for (const pg of group.participants) {
        await neon.participantGroup.upsert({
          where: {
            participantId_groupId: {
              participantId: pg.participantId,
              groupId: pg.groupId,
            },
          },
          update: { id: pg.id },
          create: {
            id: pg.id,
            participantId: pg.participantId,
            groupId: pg.groupId,
          },
        });
      }

      // Pools
      for (const pool of group.pools) {
        await neon.pool.upsert({
          where: { id: pool.id },
          update: {
            poolIndex: pool.poolIndex,
            phase: pool.phase,
            bronzeMatch: pool.bronzeMatch,
            fightsPerPerson: pool.fightsPerPerson,
          },
          create: {
            id: pool.id,
            poolIndex: pool.poolIndex,
            groupId: pool.groupId,
            phase: pool.phase,
            bronzeMatch: pool.bronzeMatch,
            fightsPerPerson: pool.fightsPerPerson,
          },
        });

        // PoolParticipants - use compound unique key (poolId, participantId)
        for (const pp of pool.poolParticipants) {
          await neon.poolParticipant.upsert({
            where: {
              poolId_participantId: {
                poolId: pp.poolId,
                participantId: pp.participantId,
              },
            },
            update: { id: pp.id },
            create: {
              id: pp.id,
              poolId: pp.poolId,
              participantId: pp.participantId,
            },
          });
        }

        // Matches
        for (const match of pool.matches) {
          await neon.match.upsert({
            where: { id: match.id },
            update: {
              matchNumber: match.matchNumber,
              status: match.status,
              startTime: match.startTime,
              endTime: match.endTime,
              winner: match.winner,
              poolIndex: match.poolIndex,
              pointMatch: match.pointMatch,
              phase: match.phase,
              tour: match.tour,
            },
            create: {
              id: match.id,
              matchNumber: match.matchNumber,
              status: match.status,
              startTime: match.startTime,
              endTime: match.endTime,
              winner: match.winner,
              groupId: match.groupId,
              poolId: match.poolId,
              areaId: match.areaId,
              poolIndex: match.poolIndex,
              pointMatch: match.pointMatch,
              phase: match.phase,
              tour: match.tour,
            },
          });

          // MatchParticipants - use compound unique key (matchId, position)
          for (const mp of match.matchParticipants) {
            await neon.matchParticipant.upsert({
              where: {
                matchId_position: {
                  matchId: mp.matchId,
                  position: mp.position,
                },
              },
              update: { id: mp.id, participantId: mp.participantId },
              create: {
                id: mp.id,
                position: mp.position,
                matchId: mp.matchId,
                participantId: mp.participantId,
              },
            });
          }

          // Rounds - use compound unique key (matchId, roundNumber)
          for (const round of match.rounds) {
            await neon.round.upsert({
              where: {
                matchId_roundNumber: {
                  matchId: round.matchId,
                  roundNumber: round.roundNumber,
                },
              },
              update: {
                id: round.id,
                scoreA: round.scoreA,
                scoreB: round.scoreB,
                winner: round.winner,
                winnerPosition: round.winnerPosition,
                penaltyA: round.penaltyA,
                penaltyB: round.penaltyB,
                updatedAt: round.updatedAt,
              },
              create: {
                id: round.id,
                roundNumber: round.roundNumber,
                scoreA: round.scoreA,
                scoreB: round.scoreB,
                winner: round.winner,
                winnerPosition: round.winnerPosition,
                penaltyA: round.penaltyA,
                penaltyB: round.penaltyB,
                matchId: round.matchId,
                createdAt: round.createdAt,
                updatedAt: round.updatedAt,
              },
            });
          }
        }
      }
    }

    console.log(`[NeonSync] Sync terminée pour compétition ${competitionId}`);
  } catch (error) {
    console.error(`[NeonSync] Erreur sync compétition ${competitionId}:`, error.message);
    // Ne pas faire planter l'app principale si la sync échoue
  }
}

/**
 * Fire-and-forget sync: call this after write operations.
 * Does not block the response.
 */
function triggerSync(localPrisma, competitionId) {
  if (!NEON_DATABASE_URL || !competitionId) return;
  // Run in background, don't await
  syncCompetitionToNeon(localPrisma, competitionId).catch((err) => {
    console.error("[NeonSync] Background sync failed:", err.message);
  });
}

module.exports = { syncCompetitionToNeon, triggerSync, getNeonPrisma };
