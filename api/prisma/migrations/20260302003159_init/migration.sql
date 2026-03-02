-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "roundDuration" INTEGER NOT NULL,
    "breakDuration" INTEGER NOT NULL,
    "breakFrequency" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "poolSize" INTEGER NOT NULL DEFAULT 4,
    "tournamentType" TEXT NOT NULL DEFAULT 'pools',
    "numAreas" INTEGER NOT NULL DEFAULT 6
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gender" TEXT NOT NULL,
    "ageCategoryName" TEXT NOT NULL,
    "ageCategoryMin" INTEGER NOT NULL,
    "ageCategoryMax" INTEGER NOT NULL,
    "weightCategoryName" TEXT NOT NULL,
    "weightCategoryMax" INTEGER NOT NULL,
    "competitionId" TEXT NOT NULL,
    CONSTRAINT "Group_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolIndex" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'config',
    "bronzeMatch" BOOLEAN NOT NULL DEFAULT true,
    "fightsPerPerson" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Pool_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "poids" REAL NOT NULL,
    "ligue" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    CONSTRAINT "Participant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParticipantGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "ParticipantGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParticipantGroup_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PoolParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    CONSTRAINT "PoolParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PoolParticipant_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "areaNumber" INTEGER NOT NULL,
    "competitionId" TEXT NOT NULL,
    CONSTRAINT "Area_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "winner" TEXT,
    "groupId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "poolIndex" INTEGER NOT NULL,
    "pointMatch" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'pool',
    "tour" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Match_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundNumber" INTEGER NOT NULL,
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "winner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "matchId" TEXT NOT NULL,
    "winnerPosition" TEXT,
    "penaltyA" INTEGER NOT NULL DEFAULT 0,
    "penaltyB" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Round_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Break" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "areaId" TEXT NOT NULL,
    CONSTRAINT "Break_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Group_competitionId_idx" ON "Group"("competitionId");

-- CreateIndex
CREATE INDEX "Pool_groupId_idx" ON "Pool"("groupId");

-- CreateIndex
CREATE INDEX "Participant_competitionId_idx" ON "Participant"("competitionId");

-- CreateIndex
CREATE INDEX "ParticipantGroup_participantId_idx" ON "ParticipantGroup"("participantId");

-- CreateIndex
CREATE INDEX "ParticipantGroup_groupId_idx" ON "ParticipantGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantGroup_participantId_groupId_key" ON "ParticipantGroup"("participantId", "groupId");

-- CreateIndex
CREATE INDEX "PoolParticipant_poolId_idx" ON "PoolParticipant"("poolId");

-- CreateIndex
CREATE INDEX "PoolParticipant_participantId_idx" ON "PoolParticipant"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolParticipant_poolId_participantId_key" ON "PoolParticipant"("poolId", "participantId");

-- CreateIndex
CREATE INDEX "Area_competitionId_idx" ON "Area"("competitionId");

-- CreateIndex
CREATE INDEX "Match_groupId_idx" ON "Match"("groupId");

-- CreateIndex
CREATE INDEX "Match_poolId_idx" ON "Match"("poolId");

-- CreateIndex
CREATE INDEX "Match_areaId_idx" ON "Match"("areaId");

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_idx" ON "MatchParticipant"("matchId");

-- CreateIndex
CREATE INDEX "MatchParticipant_participantId_idx" ON "MatchParticipant"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_position_key" ON "MatchParticipant"("matchId", "position");

-- CreateIndex
CREATE INDEX "Round_matchId_idx" ON "Round"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_matchId_roundNumber_key" ON "Round"("matchId", "roundNumber");

-- CreateIndex
CREATE INDEX "Break_areaId_idx" ON "Break"("areaId");
