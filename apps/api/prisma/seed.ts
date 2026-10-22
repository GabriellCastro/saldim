/**
 * Seed idempotente (pode rodar várias vezes): usuário de demonstração + extrato Itaú fictício,
 * holerite de set/26, empréstimos, limites e meta. Reaproveita os services da API (sem duplicar regra).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AccountsService } from '../src/accounts/accounts.service';
import { CATEGORIES } from '../src/categories/categories';
import { ImportsService } from '../src/imports/imports.service';
import { parseJsonStatement } from '../src/imports/parsers';
import { PayslipsService } from '../src/payslips/payslips.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;

const EXTRATO_FILE = join(__dirname, 'data', 'extrato-itau.json');
const EXTRATO_NAME = 'extrato-itau.json';

// empréstimos fictícios (todos descontados na folha)
const LOANS = [
  { id: 'A', parc: 380, cur: 12, total: 12 },
  { id: 'B', parc: 402.5, cur: 10, total: 12 },
  { id: 'C', parc: 255.3, cur: 13, total: 18 },
  { id: 'D', parc: 140, cur: 10, total: 18 },
  { id: 'E', parc: 240.9, cur: 11, total: 18 },
  { id: 'F', parc: 248.75, cur: 6, total: 36 },
];

// Holerite fictício de set/26
const PAYSLIP_ITEMS = [
  { code: '001', label: 'Salário Base', amount: 5800, kind: 'provento' as const },
  { code: '999', label: 'Arredondamento no Mês', amount: 0.37, kind: 'provento' as const },
  { code: '892', label: 'Desc. Mensalidade Plano de Saúde', amount: 1, kind: 'desconto' as const },
  { code: '903', label: 'INSS Folha', amount: 640.2, kind: 'desconto' as const },
  { code: '914', label: 'IRRF Folha', amount: 491.3, kind: 'desconto' as const },
  ...[
    ['13/18', 255.3],
    ['12/12', 380],
    ['6/36', 248.75],
    ['10/18', 140],
    ['11/18', 240.9],
    ['10/12', 402.5],
  ].map(([parc, amount]) => ({
    code: '869',
    label: `Desc. Empréstimo (Crédito Trabalhador) Parc. ${parc}`,
    amount: amount as number,
    kind: 'desconto' as const,
  })),
  { code: '610', label: 'Desc Arredondamento Mês Anterior', amount: 0.42, kind: 'desconto' as const },
];

async function main() {
  const passwordHash = await bcrypt.hash('Saldim@2026', 10);
  const otherIncome = Math.round(((6903.86 + 5413) / 2) * 100) / 100;
  const profile = { name: 'Lucas M. da Rocha', phone: '(11) 91234-5678', otherIncome };
  const user = await prisma.user.upsert({
    where: { email: 'demo@saldim.dev' },
    create: { email: 'demo@saldim.dev', cpf: '52998224725', passwordHash, ...profile },
    update: { passwordHash, ...profile },
  });
  const userId = user.id;

  // Extrato: mesmo caminho do upload (parser JSON + ImportsService com dedupe)
  const imports = new ImportsService(db, new AccountsService(db));
  const already = await prisma.import.findFirst({
    where: { userId, kind: 'EXTRATO', fileName: EXTRATO_NAME, status: 'DONE' },
  });
  if (!already) {
    const parsed = parseJsonStatement(readFileSync(EXTRATO_FILE, 'utf8'));
    const imp = await imports.importParsed(userId, EXTRATO_NAME, parsed);
    console.log(`extrato: ${imp.count} lançamentos importados`);
  }

  // Holerite (atualiza netIncome/grossIncome)
  const payslips = new PayslipsService(db);
  if (!(await prisma.payslip.findUnique({ where: { userId_month: { userId, month: '2026-09' } } }))) {
    await payslips.save(userId, { month: '2026-09', gross: 5800.37, net: 3000, items: PAYSLIP_ITEMS }, 'holerite-2026-09.pdf');
  }

  // Empréstimos
  if ((await prisma.loan.count({ where: { userId } })) === 0) {
    await prisma.loan.createMany({
      data: LOANS.map((l) => ({
        userId,
        name: `Consignado ${l.id}`,
        source: 'FOLHA' as const,
        installment: l.parc,
        currentInstallment: l.cur,
        totalInstallments: l.total,
      })),
    });
  }

  // Limites padrão das categorias variáveis
  for (const c of CATEGORIES.filter((c) => c.defaultLimit != null)) {
    await prisma.categoryLimit.upsert({
      where: { userId_category: { userId, category: c.id } },
      create: { userId, category: c.id, amount: c.defaultLimit! },
      update: {},
    });
  }

  // Meta
  // qualquer meta (ativa ou batida) já basta: não cria uma segunda ativa se o usuário renomeou a dele
  if (!(await prisma.goal.findFirst({ where: { userId } }))) {
    await prisma.goal.create({
      data: { userId, name: 'Reserva de emergência', target: 10000, deadline: new Date('2026-12-31T00:00:00Z') },
    });
  }

  const txCount = await prisma.transaction.count({ where: { userId } });
  console.log(`seed ok: ${user.email} · ${txCount} lançamentos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
