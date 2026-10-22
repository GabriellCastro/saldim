import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Payslip } from '@prisma/client';
import pdfParse from 'pdf-parse';
import { num } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { parsePayslipText, PayslipItem } from './payslip-text';

export const toPayslipDto = (p: Payslip) => ({
  id: p.id,
  month: p.month,
  gross: num(p.gross),
  net: num(p.net),
  items: (p.items as unknown as PayslipItem[]) ?? [],
});

const MANUAL = 'Não consegui ler os valores desse holerite. Preenche bruto, líquido e mês à mão.';

@Injectable()
export class PayslipsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.payslip.findMany({ where: { userId }, orderBy: { month: 'desc' } });
    return rows.map(toPayslipDto);
  }

  async latest(userId: string) {
    const p = await this.prisma.payslip.findFirst({ where: { userId }, orderBy: { month: 'desc' } });
    return p ? toPayslipDto(p) : null;
  }

  /** Grava (ou substitui) o holerite do mês e atualiza a renda do usuário pelo mais recente. */
  async save(userId: string, dto: CreatePayslipDto, fileName?: string) {
    const items = (dto.items ?? []).map((i) => ({ ...i, amount: Math.round(i.amount * 100) / 100 }));
    const data = { gross: dto.gross, net: dto.net, items, fileName: fileName ?? null };
    const p = await this.prisma.payslip.upsert({
      where: { userId_month: { userId, month: dto.month } },
      create: { userId, month: dto.month, ...data },
      update: data,
    });
    await this.prisma.import.create({
      data: { userId, kind: 'HOLERITE', status: 'DONE', fileName: fileName ?? 'manual', count: 1 },
    });
    await this.syncIncome(userId);
    return toPayslipDto(p);
  }

  /** PDF → valores (melhor esforço). Sem bruto/líquido/mês → Import FAILED e 422 pedindo digitação. */
  async importFile(userId: string, file: Express.Multer.File, fallbackMonth?: string) {
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    let parsed: ReturnType<typeof parsePayslipText> | undefined;
    if (file.buffer.subarray(0, 4).toString() === '%PDF') {
      try {
        parsed = parsePayslipText((await pdfParse(file.buffer)).text);
      } catch {
        parsed = undefined;
      }
    }
    const month = parsed?.month ?? fallbackMonth;
    if (!parsed || parsed.gross == null || parsed.net == null || !month) {
      await this.prisma.import.create({
        data: { userId, kind: 'HOLERITE', status: 'FAILED', fileName, error: MANUAL },
      });
      throw new UnprocessableEntityException(MANUAL);
    }
    return this.save(userId, { month, gross: parsed.gross, net: parsed.net, items: parsed.items }, fileName);
  }

  private async syncIncome(userId: string) {
    const last = await this.prisma.payslip.findFirst({ where: { userId }, orderBy: { month: 'desc' } });
    if (last) await this.prisma.user.update({ where: { id: userId }, data: { netIncome: last.net, grossIncome: last.gross } });
  }
}
