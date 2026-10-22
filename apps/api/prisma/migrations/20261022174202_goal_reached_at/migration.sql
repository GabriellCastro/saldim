-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "reachedAt" TIMESTAMP(3);

-- metas que já foram pro histórico: a melhor data que se tem é quando viraram histórico
UPDATE "Goal" SET "reachedAt" = "achievedAt" WHERE "achievedAt" IS NOT NULL;
