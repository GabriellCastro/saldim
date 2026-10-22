import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { aiCostUsd, toBrl, usdBrlRate } from './ai-cost';
import { FinanceDataService } from '../dashboard/finance-data.service';
import { alerts, financeSummary, prompts, ruleReply, type FinInput } from '../dashboard/finance';

/** Mensagens anteriores mandadas pro Claude (pra lembrar da conversa). */
const HISTORY = 40;

const toDto = (m: ChatMessage) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() });

/** Prompt de sistema em pt-BR com o resumo compacto das finanças do usuário. */
export function systemPrompt(name: string, input: FinInput, now = new Date()): string {
  return [
    `Tu é a assistente financeira do app Saldim, conversando com ${name}. Data de hoje: ${now.toISOString().slice(0, 10)}.`,
    'Responde em português do Brasil, tom informal e acolhedor (usa "tu"), direto ao ponto, no máximo 5 frases curtas, com valores em R$ no formato brasileiro. Sem markdown, sem listas.',
    'É uma conversa: considera as mensagens anteriores. Se a pergunta for curta ("e se eu cortar isso?", "e no mês que vem?"), entende pelo que já foi falado antes de responder.',
    'Usa só os números do resumo abaixo (JSON). Se faltar dado, diz o que falta. Não é aconselhamento de investimento; foca em orçamento, dívidas e reserva.',
    '"hoje" no resumo é a data do último lançamento importado. "lancamentos" traz os lançamentos dos últimos 2 meses (dd/mm, descrição, valor, categoria; saída negativa) pra responder sobre gastos específicos.',
    'Cortes: "fixos" e "contasRecorrentes" são compromissos (aluguel, parcelas, faculdade, academia, assinaturas, boletos mensais) e não se cortam; numa categoria, o campo "recorrente" é a parte que é conta. Só sugere cortar o gasto livre, de forma gradual (no máximo uns 20% de uma categoria por vez), começando pelo que mais passou da média. Nunca sugere zerar categoria nem cortar mercado/saúde ao ponto de faltar o básico. Se a meta só fecha com corte pesado, fala isso e sugere esticar o prazo em vez de apertar tudo.',
    'Imprevistos: "imprevistos" são gastos pontuais que a pessoa marcou (com tipo e justificativa). Não entram nas médias, nos limites nem nos cortes, mas o do mês atual já tá descontado da projeção; "meta.plano.unexpected.delayMonths" diz quantos meses ele empurrou a meta. Não julga o imprevisto; se repetir muito, sugere reforçar a reserva.',
    'Reservas: "reservas" traz a mínima (3 meses do essencial), a ideal (6 meses do custo de vida) e a dos sonhos (12 meses), com quando cada uma chega.',
    'Projeções: "comLimites" = gastar até os limites dos variáveis (nunca abaixo das contas recorrentes); "gastandoComoHoje" = na média do mês anterior. A reserva parte do valor que a pessoa já tem guardado ("meta.guardado").',
    `Resumo: ${JSON.stringify(financeSummary(input))}`,
  ].join('\n');
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly data: FinanceDataService,
  ) {}

  async alerts(userId: string) {
    return alerts(await this.data.load(userId));
  }

  async prompts(userId: string) {
    return prompts(await this.data.load(userId));
  }

  async messages(userId: string) {
    const list = await this.prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return list.map(toDto);
  }

  async send(userId: string, content: string) {
    await this.prisma.chatMessage.create({ data: { userId, role: 'user', content } });
    const input = await this.data.load(userId);
    let ai: Awaited<ReturnType<AssistantService['askClaude']>> | null = null;
    if (process.env.ANTHROPIC_API_KEY) ai = await this.askClaude(userId, input).catch((e: unknown) => {
      this.logger.warn(`Claude indisponível, usando regras: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });
    const text = ai?.text.trim();
    const reply = await this.prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: text || ruleReply(input, content), ...(text ? ai!.usage : {}) },
    });
    return { reply: toDto(reply) };
  }

  /** Quanto a IA custou: mês corrente (calendário) e total, em US$ e R$ (cotação `USD_BRL`). */
  async usage(userId: string) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const sumOf = (where: object) =>
      this.prisma.chatMessage.aggregate({
        where: { userId, role: 'assistant', model: { not: null }, ...where },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: true,
      });
    const [month, total] = await Promise.all([sumOf({ createdAt: { gte: monthStart } }), sumOf({})]);
    const rate = usdBrlRate(process.env.USD_BRL);
    const pack = (a: Awaited<ReturnType<typeof sumOf>>) => {
      // US$ com 4 casas: uma resposta custa frações de centavo (num() cortaria pra 2)
      const usd = Math.round(Number(a._sum.costUsd ?? 0) * 10000) / 10000;
      return { usd, brl: toBrl(usd, rate), replies: a._count, tokens: (a._sum.inputTokens ?? 0) + (a._sum.outputTokens ?? 0) };
    };
    return {
      month: monthStart.toISOString().slice(0, 7),
      thisMonth: pack(month),
      total: pack(total),
      usdBrl: rate,
      model: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' : null,
    };
  }

  private async askClaude(userId: string, input: FinInput) {
    const [user, history] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
      this.prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: HISTORY }),
    ]);
    const msgs = history.reverse().map((m) => ({ role: m.role, content: m.content }));
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
    const res = await client.messages.create({
      model,
      // o pensamento adaptativo conta no max_tokens: deixa folga e usa esforço baixo (chat curto)
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system: systemPrompt(user.name.split(' ')[0], input),
      messages: msgs,
      // resumo + histórico se repetem a cada pergunta: cacheia o prefixo
      cache_control: { type: 'ephemeral' },
    });
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
      throw new Error(`stop_reason=${res.stop_reason}`);
    }
    const u = res.usage;
    const cost = aiCostUsd(model, u);
    if (cost === null) this.logger.warn(`Sem preço para ${model}: custo da IA não será somado (ver ai-cost.ts)`);
    return {
      text: res.content.map((b) => (b.type === 'text' ? b.text : '')).join(''),
      usage: {
        model,
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
        costUsd: cost,
      },
    };
  }
}
