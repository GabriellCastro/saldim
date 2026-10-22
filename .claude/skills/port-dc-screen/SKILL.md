---
name: port-dc-screen
description: Use when porting a screen from design/*.dc.html (Claude Design export) into the Next.js app in apps/web — covers reading the dc template/logic, mapping to React + CSS Modules + SWR, and verifying visually against the original.
---

# Portar tela `.dc.html` → Next.js

## 1. Ler o design
Cada `design/*.dc.html` tem duas partes:
- **Template** dentro de `<x-dc>`: HTML com estilos inline, `{{ expr }}` (valores vindos de `renderVals()`), `<sc-for list="{{ xs }}" as="x">` (map), `<sc-if value="{{ cond }}">` (condicional), `style-hover="..."` (estado :hover), `onClick="{{ fn }}"`.
- **Lógica** em `<script type="text/x-dc" data-dc-script>`: constantes de dados mockados (`EXT`, `LOANS`, `LIM`…), `state`, e `renderVals()` que calcula tudo que o template usa.

Encontre a tela: `grep -n "screen==='gastos'" design/Controle\ Financeiro\ v3.dc.html` e leia o bloco do template + os campos correspondentes em `renderVals()`. Veja também a versão Mobile do mesmo arquivo.
Veja renderizado: preview `design` → `http://localhost:4100/Controle%20Financeiro%20v3.dc.html` (clique no menu para trocar de tela).

## 2. Mapear
| Design | Next |
|---|---|
| estilo inline repetido | classe em `<Tela>.module.css` usando `var(--token)` |
| `{{ valor calculado }}` em renderVals | **vem da API** (`docs/api.md`). Cálculo de negócio vai pro backend; no front só formatação (`src/lib/format.ts`) e geometria de gráfico |
| dados mock (`EXT`, `LOANS`) | nunca copiar pro front — usar SWR `useSWR<T>('/rota', fetcher)` |
| `sc-for` / `sc-if` | `.map()` / `&&` |
| `style-hover` | `:hover` no CSS module |
| `state` de UI (abas, hover, passos) | `useState` local no componente cliente |
| "Ocultar valores" (`priv`) | `useUser().privacyMode` → `money(v, hidden)` |

Estrutura: página fina em `src/app/(app)/<rota>/page.tsx` que renderiza `src/features/<feature>/<Tela>.tsx` (`'use client'`). Sub-blocos grandes viram componentes no mesmo diretório. Reaproveite `src/components/ui` (Card, Eyebrow, Button, Field) antes de criar novo.

## 3. Estados obrigatórios
loading (skeleton simples com `var(--s2)`), erro (mensagem curta + tentar de novo), vazio (ex.: sem extrato → CTA "Carregar extrato" para `/bancos`).

## 4. Verificar
1. `pnpm --filter web exec tsc --noEmit` e `pnpm --filter web lint`.
2. Rode o web numa porta livre e abra lado a lado com o design (desktop 1280px e mobile 390px). Compare espaçamento, tipografia (Exo 2, pesos), cores e textos. Corrija diferenças visíveis.
