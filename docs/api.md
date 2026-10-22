# Contrato da API Saldim

Base: `http://localhost:3333`. JSON. Auth por cookie httpOnly `saldim_token` (JWT) — o web sempre usa `credentials: 'include'`.
Tudo exige login, exceto o que está marcado **público**. Datas: ISO `YYYY-MM-DD`. Mês: `YYYY-MM`. Dinheiro: `number` com 2 casas (saídas negativas).
Erros: `{ statusCode, message }` (message pode ser string[] de validação).

> Este arquivo é a fonte da verdade entre API e web. Quem mudar um endpoint atualiza este arquivo no mesmo commit.

## Tipos comuns
```ts
type User = { id; name; email; cpfMasked: string /* •••.482.310-•• */; phone: string|null;
  faceEnabled: boolean; privacyMode: boolean; notifications: boolean;
  netIncome: number|null; grossIncome: number|null; otherIncome: number|null };
type Category = { id; label; kind: 'fixo'|'variavel'|'entrada'|'interno'; defaultLimit?: number };
type Tx = { id; date: string; description: string; amount: number; category: string; categoryLabel: string;
  unexpected: string|null /* tipo de imprevisto */; unexpectedLabel: string|null; unexpectedNote: string|null /* justificativa */ };
type Alert = { tag: string /* DÍVIDA, INCOMUM, LIMITE… */; tone: 'neg'|'warn'|'pos'; title: string; body: string };
```

## Auth / perfil  (dono: agente api-auth)
| Método | Rota | Body | Resposta |
|---|---|---|---|
| POST **público** | /auth/register | `{name, cpf, phone, email, password}` | `{user: User}` + cookie. 403 `Cadastro fechado` com `REGISTRATION_OPEN=false` |
| POST **público** | /auth/login | `{email, password}` | `{user: User}` + cookie |
| POST | /auth/logout | – | 204, limpa cookie |
| POST | /auth/device | – | 204 + cookie `saldim_device` (lembra o aparelho; exige `faceEnabled`, senão 400) |
| POST **público** | /auth/device/login | – (usa cookie `saldim_device`) | `{user: User}` + cookie; 401 se o aparelho não é mais lembrado |
| GET | /auth/me | – | `User` |
| PATCH | /me | `{name?, phone?}` | `User` |
| PATCH | /me/settings | `{faceEnabled?, privacyMode?, notifications?}` | `User` |
| POST | /me/email/request | `{newEmail, password}` | `{sent: true, devCode?: string}` (devCode só fora de produção) |
| POST | /me/email/confirm | `{code}` | `User` |
| POST | /me/password | `{currentPassword, newPassword}` | 204 |

Senha: mín. 8, 1 número, letra + símbolo. CPF validado (dígitos verificadores).

Notas:
- `/auth/logout` é **público** (limpa cookie mesmo expirado). Login responde 200, registro 201.
- Senha atual errada em `/me/email/request` e `/me/password` → **400** (não 401, para o web não confundir com sessão perdida).
- Confirmar e-mail reemite o cookie. Uma troca pendente por usuário; e-mail já em uso → 409.
- CPF salvo só com dígitos; e-mails normalizados (trim + minúsculas).
- **Entrar com o rosto = aparelho lembrado.** A varredura facial do web é ilustrativa; quem autentica é o cookie httpOnly `saldim_device` (path `/auth/device`, 90 dias, sobrevive ao logout). O banco guarda só o hash (`TrustedDevice`), e cada `/auth/device/login` troca o token. `faceEnabled: false` ou senha trocada esquecem todos os aparelhos do usuário.

## Categorias
| GET **público** | /categories | – | `Category[]` |
| GET **público** | /categories/unexpected | – | `{id, label}[]` (tipos de imprevisto) |

## Contas, importação, lançamentos, holerite, empréstimos  (dono: agente api-data)
| Método | Rota | Body | Resposta |
|---|---|---|---|
| GET | /accounts | – | `{id, bank, label, balance, lastSyncAt}[]` |
| POST | /imports/extrato | multipart `file` (PDF Itaú, CSV, OFX ou JSON no formato `design/extrato-itau.json`) | `Import` = `{id, kind, status, fileName, count, periodStart, periodEnd, error}` |
| POST | /imports/holerite | multipart `file` (PDF/JPG) **ou** JSON `{month, gross, net, items}` | `Payslip` |
| GET | /imports | – | `Import[]` (mais recentes primeiro) |
| GET | /transactions | query `month?`, `category?`, `take?`(50), `cursor?` | `{items: Tx[], nextCursor: string|null}` |
| PATCH | /transactions/:id | `{category?, unexpected?: tipo\|null, unexpectedNote?: string\|null}` | `Tx` (recategorizar e/ou marcar imprevisto; `unexpected: null` desmarca; só saída pode ser imprevisto) |
| GET | /transactions/unexpected | `month?` (YYYY-MM ou `all`; padrão = mês do último lançamento) | `{month, total, count, byType: {type, label, count, amount}[], items: Tx[]}` |
| GET | /payslips | – | `Payslip[]` = `{id, month, gross, net, items: {label, amount, kind: 'provento'|'desconto'}[]}` |
| GET | /payslips/latest | – | `Payslip|null` |
| GET | /loans | – | `{items: Loan[], kpis: {monthlyFolha, monthlyConta, totalRemaining, endsNext3Months}}` |
| POST | /loans | `{name, source, installment, currentInstallment, totalInstallments}` | `Loan` |
| PATCH/DELETE | /loans/:id | parcial | `Loan` / 204 |

`Loan = {id, name, source: 'FOLHA'|'CONTA', installment, currentInstallment, totalInstallments, remainingInstallments, remainingAmount, endMonth: 'YYYY-MM'}`

## Open Finance (Pluggy)
| Método | Rota | Body | Resposta |
|---|---|---|---|
| POST | /open-finance/connect-token | `{itemId?, allowDuplicate?}` (com itemId = reconectar/atualizar; `allowDuplicate` depois de `ITEM_USER_ALREADY_EXISTS` de item nunca registrado) | `{accessToken}` para o widget Pluggy Connect; 503 sem `PLUGGY_CLIENT_ID/SECRET` |
| GET | /open-finance/connections | – | `{id, itemId, connector, imageUrl, status, error, lastSyncAt, accounts: {id, label, balance}[]}[]` |
| POST | /open-finance/connections | `{itemId}` (do `onSuccess` do widget) | 201 `{status, accounts, imported}` — confere o dono do item e sincroniza; 409 (e apaga o item novo) se o usuário já tem conexão com o mesmo conector |
| POST | /open-finance/connections/:id/sync | – | `{status, accounts, imported}` |
| DELETE | /open-finance/connections/:id | – | 204 (apaga o item na Pluggy; lançamentos ficam) |
| POST **público** | /open-finance/webhook?secret=… | evento Pluggy `{event, itemId}` | `{received: true}`; 404 sem `PLUGGY_WEBHOOK_SECRET` ou segredo errado |

Notas:
- Só contas `BANK` (conta corrente/poupança): saldo vai em `BankAccount.balance`, lançamentos **postados** viram `Transaction` com `externalId` (id da Pluggy, único por usuário — re-sync não duplica). Sinal pelo `type` (DEBIT negativo).
- Primeira sync busca 90 dias; as seguintes revisam a partir de 7 dias antes do último lançamento trazido.
- Conta do mesmo banco criada por extrato é adotada; lançamentos até a última data vinda de arquivo não são trazidos de novo (descrições diferem entre extrato e API).
- Webhook (opcional, precisa de URL pública): `PLUGGY_WEBHOOK_URL` + `PLUGGY_WEBHOOK_SECRET` vão no connect token; o evento só dispara sync de item conhecido.

## Painel, orçamento, metas, IA  (dono: agente api-insights)
| Método | Rota | Query/Body | Resposta |
|---|---|---|---|
| GET | /dashboard/overview | `month?`, `today?` | `Overview` |
| GET | /dashboard/spending | `month?` (`YYYY-MM` ou `all` = todos os meses; padrão: mês anterior a "hoje"), `today?` | `{month /* YYYY-MM ou 'all' */, months: string[] /* meses com lançamentos, mais recente primeiro */, total, income /* em 'all': renda mensal × nº de meses */, byCategory: {id, label, kind: 'fixo'|'variavel', amount /* positivo */, pctIncome /* % de income, 1 casa */}[], insight: string}` |
| GET | /dashboard/projection | `months?=15`, `plan?=true`, `countOther?=true`, `today?` | `Projection` |
| GET | /dashboard/month/:month | – | `MonthDetail` (detalhe de um mês da Projeção, de 2 meses atrás até 35 à frente; fora disso 404) |
| GET | /budgets | `month?`, `today?` | `{month, day, daysInMonth, items: BudgetItem[], totals: {spent, limit, avg}}` |
| PUT | /budgets/:category | `{amount}` (só categorias variáveis; outra → 400) | `BudgetItem` |
| GET | /goals/current | – | `{goal: {id, name, target, reachedAt} \| null, saved, savedAt, savedMonth, plan: GoalPlan \| null, reserve: Reserve}` |
| PUT | /goals/current | `{name, target}` | idem (cria ou edita a meta ativa; sem prazo: a data é calculada) |
| POST | /goals/current/next | `{increment, name?}` | idem, já com a nova meta (alvo = anterior + increment); meta atual não batida → 409 |
| PUT | /goals/saved | `{amount ≥ 0}` | idem (acerta a base do guardado: quanto tem hoje) |
| GET | /goals/history | – | `{id, name, target, createdAt, reachedAt, days, active}[]` metas batidas (inclusive a ativa, se já bateu), mais recentes primeiro; `days` = dias entre criar e bater |
| GET | /assistant/alerts | – | `Alert[]` |
| GET | /assistant/prompts | – | `string[]` (sugestões de pergunta) |
| GET | /assistant/usage | – | `{month: 'YYYY-MM', thisMonth: AiUsage, total: AiUsage, usdBrl: number, model: string|null}` com `AiUsage = {usd, brl, replies, tokens}` — custo das respostas que vieram do Claude (as por regras não contam); mês = calendário UTC; `brl` usa `USD_BRL` do .env (padrão 5,40) |
| GET | /assistant/messages | – | `ChatMessage[]` (mais antigas primeiro) |
| POST | /assistant/messages | `{content}` | 201 `{reply: ChatMessage}` (usa Claude se `ANTHROPIC_API_KEY` — modelo `ANTHROPIC_MODEL`, padrão `claude-sonnet-5-5`; sem chave ou se a chamada falhar, respostas por regras com os números do usuário) |

Guardado: `saved` = base informada no `PUT /goals/saved` (em `savedAt`) + lançamentos da categoria `investimento` (caixinha/cofrinho) lançados num dia depois do dia da base (Brasília) e importados depois dela (depósito soma, resgate tira; os do mesmo dia ou que já tavam no app já tavam no valor informado); `savedMonth` = o que entrou (−saiu) da caixinha no mês atual.

Meta: uma ativa por vez, só valor (a data sai dos dados). `reachedAt` (YYYY-MM-DD) é gravado sozinho no primeiro `GET /goals/current` em que o guardado chega no alvo; fica mesmo se resgatar depois, e zera se o alvo mudar no `PUT`. A meta só vai pro histórico fechado (`achievedAt`) quando nasce a próxima (`POST /goals/current/next`), e criar a próxima é opcional. `GoalPlan = {missing, status: reached|onTrack|tooSlow, reachPlan, monthsPlan, savePerMonth, reachToday, paceToday, cuts: {category, label, avg, limit, committed, cut}[], unexpected: {amount, delayMonths}}` — `reachPlan` = mês em que a reserva (partindo do guardado) bate o alvo gastando até os limites; `reachToday`/`paceToday` = gastando como o mês passado; `cuts` = categorias com média acima do limite do plano (`limit` nunca abaixo de `committed`, as contas recorrentes da categoria, que não entram no corte); `tooSlow` = nem com os limites chega em 5 anos. `unexpected` = imprevistos do mês atual e quantos meses empurraram a data.

Imprevisto (lançamento marcado): fica fora dos fixos, médias, limites, recorrentes e ritmo; o do mês atual sai uma vez da projeção (`ProjMonth.unexpected`, mês 0).

`Reserve = {saved, essential /* fixos + mercado + saúde nos limites */, monthlyCost /* fixos + variáveis nos limites */, levels: {id: min|ideal|dream, label, months: 3|6|12, base: essencial|custo, target, reached, reachPlan /* YYYY-MM seguindo os limites; null = já tem ou não chega em 5 anos */}[]}`

**"Hoje"** = data do lançamento mais recente do usuário (ex.: seed → 2026-10-07), a menos que venha `?today=YYYY-MM-DD`.
`?month` de um mês passado vira "hoje" = último dia desse mês. Toda a matemática está em `apps/api/src/dashboard/finance.ts` (funções puras).

```ts
type ChatMessage = { id; role: 'user'|'assistant'; content: string; createdAt: string };
type Goal = { id; name; target: number; deadline: string; createdAt: string;
  reachedAt: string|null /* 'YYYY-MM' em que a reserva projetada com o plano bate o alvo */ };
type BudgetItem = { category; label; limit /* salvo; sem salvo = padrão do catálogo, mas no máx. 20% abaixo da média */;
  spent /* mês atual até hoje */; avg /* mês anterior */;
  committed /* contas recorrentes da categoria por mês (mesmo estabelecimento em 2 dos 3 últimos meses); piso do plano */;
  ratio /* spent/limit */; status: 'ok'|'warn'|'over' /* warn: ratio > dia/diasDoMês + 0,15 */ };
type Overview = {
  month: string; today: string; day: number; daysInMonth: number;
  account: { label: string; lastSyncAt: string|null; balance: number|null };
  income: { net: number; gross: number; other: number; total: number };
  fixed: { id: string; label: string; amount: number }[]; fixedTotal: number;  // estimativa mensal dos fixos
  variable: { spent: number; limit: number; avg: number; idealToDate: number;
    diff: number /* spent - idealToDate; <0 = abaixo do ritmo */; daily: number[] /* acumulado por dia, índice 0 = 0 */ };
  leftover: number;          // income.total - fixedTotal - variable.limit
  // variáveis de salário a salário: salário = 5º dia útil (sábado conta, domingo/feriado nacional não; caiu no
  // sábado → sexta), ou o dia em que o salário entrou de fato (±5 dias). limit = soma dos limites (por ciclo).
  cycle: { start: string; nextPayday: string; day: number /* 1 = dia do salário */; days: number; daysLeft: number /* conta hoje */;
    spent: number; limit: number; remaining: number /* <0 = passou */; perDay: number /* remaining/daysLeft */;
    idealToDate: number; diff: number; daily: number[] /* acumulado por dia do ciclo, índice 0 = 0 */ };
  payslipFreed: number|null; // quanto o líquido sobe quando os consignados da folha terminam (dentro de 15 meses)
  netAfterLoans: { month: string; net: number } | null; // mês em que o líquido chega ao máximo
  insight: string;           // texto do card "IA" da visão geral: só a próxima ação (categoria estourada > acima do ritmo > a que mais pesa no plano), sem repetir números dos cards
  alertsCount: number;
};
type Projection = {
  months: { month: string /* YYYY-MM */; label: string /* out/26 */; income: number /* líquido + outra conta */;
    payslipNet: number; freed: number /* aumento do líquido vs mês anterior */; out: number;
    extra: number /* 13º */; balance: number; reserve: number /* acumulado */ }[];
  goal: { name; target; deadline; reachedAt: string|null; reachedAtPlan: string|null; reachedAtNoPlan: string|null } | null;
  plan: boolean;
  alt: { month: string; balance: number; reserve: number }[]; // a outra linha (sem plano se plan=true e vice-versa)
  // real × plano da IA: mês atual (partial, até "hoje") e os 2 meses fechados anteriores (com lançamentos).
  // real: entrada = salário + outras entradas + maior crédito da conta própria (>20% do líquido); saída = fixos +
  // variáveis (sem internos/caixinha); balance = sobra: no mês atual, o saldo das contas (soma de BankAccount.balance;
  // sem saldo, entrou − saiu); nos fechados, entrou − saiu.
  // plan = fixos + limites de hoje (no mês atual, a projeção do mês 0). reserve (só no atual): o guardado × a reserva do mês 0.
  // A projeção parte do guardado no início do mês: saved − caixinha (investimento) do mês (senão contaria duas vezes).
  actual: { month; label; partial: boolean; real: { income; out; balance; unexpected }; plan: { income; out; balance };
    pct: { income; out; balance } /* real ÷ plano em %, null se plano ≤ 0 */; reserve: { real; plan; pct } | null;
    // só no atual: excedente = max(0, guardado no mês − meta de guardar); plan.balance (sobra esperada) = sobra do plano − excedente
    saving: { month /* guardado no mês */; planned /* meta de guardar = sobra do plano */; extra /* excedente */ } | null }[];
};
```

`MonthDetail = {month, label, kind: past|current|future, offset, income|fixed|variable: {lines: {id, label, real|null, plan, noPlan}[], real|null, plan, noPlan}, unexpected: {total, items: {date, description, amount, type, label, note}[]}, totals: {real: {income, out, balance}|null, plan, noPlan}, reserve: {real /* guardado, só no atual */, plan, noPlan}, events: string[], prev, next}` — `real` = lançamentos do mês (null no futuro); `plan` = fixos estimados + limites (no atual/futuro, a projeção); `noPlan` = variáveis como o mês passado.
