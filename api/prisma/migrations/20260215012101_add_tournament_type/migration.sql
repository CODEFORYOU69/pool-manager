-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "numAreas" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "tournamentType" TEXT NOT NULL DEFAULT 'pools';
