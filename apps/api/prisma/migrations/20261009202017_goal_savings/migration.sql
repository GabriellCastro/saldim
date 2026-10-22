-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "achievedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "savedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "savedAt" TIMESTAMP(3);

-- Mais de uma meta não batida: a de prazo mais próximo fica ativa, o resto vai pro histórico.
UPDATE "Goal" g SET "achievedAt" = now()
WHERE EXISTS (
  SELECT 1 FROM "Goal" o
  WHERE o."userId" = g."userId" AND (o."deadline", o."createdAt", o."id") < (g."deadline", g."createdAt", g."id")
);
