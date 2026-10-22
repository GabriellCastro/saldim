FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache openssl
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
RUN pnpm --filter api build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3333
# SEED_ON_START=false em produção: o seed redefine a senha do usuário de demonstração
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && { [ \"$SEED_ON_START\" = false ] || pnpm exec prisma db seed; }; node dist/main"]
