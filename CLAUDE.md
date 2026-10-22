# Saldim — controle financeiro pessoal

Monorepo pnpm. Design original (fonte da verdade visual) em `design/` — abra com o preview `design` (python http.server na porta 4100) e compare.

```
apps/api   NestJS 11 + Prisma 6 + PostgreSQL 16   (porta 3333)
apps/web   Next.js 15 App Router + React 19 + SWR   (porta 3001 no docker, 3000 em dev)
docs/api.md  contrato da API — fonte da verdade entre api e web
design/      telas .dc.html exportadas do Claude Design + fontes + extrato de exemplo
```

## Comandos
- `pnpm db:up` sobe só o Postgres (docker). `pnpm db:migrate` / `pnpm db:seed`.
- `pnpm dev` api + web em watch. `pnpm test` testes da api (jest).
- `docker compose up --build` sobe tudo (db + api com migrate/seed + web).
- Login do seed: `demo@saldim.dev` / `Saldim@2026` (dados fictícios).
- Cadastro: `REGISTRATION_OPEN` (API e web leem a mesma variável). Regras pessoais do categorizador: `CATEGORY_RULES` no `.env`, nunca no código.
- Repo público: nada de dado real (extrato, holerite, nomes) em código, teste, seed ou design. Deploy pessoal (`deploy/`, `docker-compose.prod.yml`) fica fora do git.

## Convenções (manutenção > esperteza)
- **API**: um módulo Nest por feature em `src/<feature>/` (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`). Regras de negócio no service; controller só valida e delega. DTOs com class-validator. Todas as rotas são autenticadas por padrão (guard global); use `@Public()` para abrir. Pegue o usuário com `@CurrentUser() user: AuthUser`. Toda query filtra por `userId`. Converta Decimal com `num()` de `src/common/money.ts`. Categorias: `src/categories/categories.ts` (não duplicar).
- **Schema Prisma**: `apps/api/prisma/schema.prisma`. Mudou? `pnpm db:migrate --name <x>` e commite a migração.
- **Web**: rotas em `src/app/(auth)/…` (login, registro, facial) e `src/app/(app)/…` (telas logadas com shell). Componentes de tela em `src/features/<feature>/`. Primitivos em `src/components/ui/`. Estilo: CSS Modules + tokens de `src/styles/tokens.css` (nunca hex solto). Dados via SWR + `fetcher` de `src/lib/api.ts`; formatação em `src/lib/format.ts`. Gráficos: SVG próprio (como no design), sem lib de chart.
- Textos em pt-BR, tom do design (informal: "tu tá", "rende").
- Responsivo: um único app. ≥768px sidebar (design `Controle Financeiro v3`), <768px tab bar inferior + tela "Mais" (design `… Mobile v3`).

## Skills do projeto
- `port-dc-screen` — como transformar uma tela `.dc.html` em página/componentes Next.
- `nest-feature` — como criar/alterar um módulo da API seguindo o padrão.
