-- No máximo uma meta ativa (achievedAt null) por usuário. Índice parcial: o Prisma não representa no schema.
CREATE UNIQUE INDEX "Goal_userId_active_key" ON "Goal"("userId") WHERE "achievedAt" IS NULL;
