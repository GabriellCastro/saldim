---
name: nest-feature
description: Use when creating or changing a feature module in apps/api (NestJS + Prisma) — module/controller/service/dto layout, auth, money handling, contract update and tests.
---

# Feature na API (NestJS + Prisma)

## Layout
```
src/<feature>/
  <feature>.module.ts       // registra controller + service; exporta service se outro módulo usa
  <feature>.controller.ts   // rotas finas: valida DTO, pega @CurrentUser(), chama service
  <feature>.service.ts      // regra de negócio + Prisma
  <feature>.service.spec.ts // testes das regras puras (cálculos), sem banco quando possível
  dto/*.dto.ts              // class-validator
```
Registre o módulo em `src/app.module.ts` (uma linha no `imports`).

## Regras
- Rotas autenticadas por padrão (guard global `JwtAuthGuard`). `@Public()` só para login/registro/categorias/health.
- `@CurrentUser() user: AuthUser` → **toda** query Prisma com `where: { userId: user.id }`. Recurso de outro usuário → `NotFoundException`.
- Dinheiro: Prisma `Decimal` → responda com `num(v)` (`src/common/money.ts`). Saída negativa, entrada positiva.
- Categorias só de `src/categories/categories.ts` (`CATEGORIES`, `CATEGORY_BY_ID`, `VARIABLE_IDS`).
- Cálculos (projeção, ritmo, limites) em funções puras exportadas → fácil de testar com jest.
- Upload: `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile() file: Express.Multer.File` (memória, limite 10MB).
- Não altere `schema.prisma` sem necessidade real. Se alterar: `pnpm --filter api exec prisma migrate dev --name <nome>`.

## Contrato
Formato de request/response segue `docs/api.md`. Mudou algo? Atualize o arquivo junto.

## Verificar
`pnpm --filter api exec tsc --noEmit`, `pnpm --filter api test`, e smoke com curl (login → cookie → rota):
```bash
curl -s -c /tmp/c -H 'content-type: application/json' -d '{"email":"demo@saldim.dev","password":"Saldim@2026"}' localhost:3333/auth/login
curl -s -b /tmp/c localhost:3333/<rota>
```
