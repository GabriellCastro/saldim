import { CATEGORY_BY_ID } from '../categories/categories';

/**
 * Categorizador por regras (palavra-chave/regex) para lançamentos do extrato Itaú.
 * Ordem importa: a primeira regra que casar vence. Ajuste a tabela RULES para ensinar
 * novos estabelecimentos; os ids vêm de `src/categories/categories.ts`.
 * Regras pessoais (nome de quem recebe o aluguel, o teu nome em outra conta, loja do financiamento)
 * não entram aqui: vão em CATEGORY_RULES no .env (ver `parseRules`).
 */
type Sign = 'in' | 'out' | 'any';
export interface Rule {
  re: RegExp;
  category: string;
  sign?: Sign;
}

const R = (re: RegExp, category: string, sign: Sign = 'any'): Rule => ({ re, category, sign });

export const RULES: Rule[] = [
  // Aplicação/resgate automático (Open Finance mostra; o extrato em PDF esconde): dinheiro teu indo e voltando
  R(/^APLICACAO APL|APL APLIC AUT|^RESGATE RES|RES APLIC AUT/, 'propria'),
  // Guardar dinheiro (cofrinho/caixinha, poupança, CDB, Tesouro) e resgatar: não é gasto nem renda
  R(/COFRINHO|CAIXINHA|POUPANCA|\bCDB\b|TESOURO|INVESTIMENTO|^APLICACAO|^RESGATE/, 'investimento'),
  // Entradas / internos
  R(/REMUNERACAO|SALARIO/, 'salario', 'in'),
  R(/CREDITO CONSIGNADO|EMPRESTIMO|CONSIG/, 'emprestimo_in', 'in'),
  R(/CREDITO CONSIGNADO|EMPRESTIMO|CONSIG/, 'emprestimo', 'out'),
  R(/PIX TRANSF CREDITA/, 'emprestimo_in', 'in'),
  R(/^ESTORNO|^RSHOP|REND PAGO|PAGTO ITAU SEGUROS/, 'outros_in', 'in'),

  // Fixos
  R(/ITAU SEGURO|TARIFA|ANUIDADE|IOF/, 'tarifas', 'out'),
  R(/ALUGUEL|IMOBILIARIA/, 'moradia', 'out'),
  R(/AGUAS?\b|ÁGUAS|AMBAR|ENERG|FIBRA|INTERNET|DIO TELECOM|TELEFONICA|VIVO|CLARO|\bTIM\b|NET SERV|CONDOMIN/, 'contas', 'out'),

  // Assinaturas
  R(/APPLE|NETFL|SPOTIFY|EBANX|DLOCAL|DISNEY|PRIME VIDEO|YOUTUBE|GOOGLE/, 'assinaturas', 'out'),

  // Educação
  R(/FASUL|EDUCA|KIWIFY|UDEMY|ALURA|ESCOLA|FACULDADE/, 'educacao', 'out'),

  // Delivery
  R(/\bIFD\b|IFOOD|99 FOOD|RAPPI|ZE DELIVERY/, 'delivery', 'out'),

  // Transporte
  R(/99 TECNOLOG|UBER|LOCALIZA|POSTO|OFICINA|MECANICA|\bAUTO\b|ESTAC|LAVA|MOTOS|CONSERT|SHELL|IPIRANGA|PETRO/, 'transporte', 'out'),

  // Saúde, academia e beleza
  R(/SMARTFIT|DROGA|FARM|BARBE|SALAO|ESTETI|MANICU|PILATE|CAPIL|BANHE|SUA A|ACADEM|CLINIC|PAGUE MENOS/, 'saude', 'out'),

  // Mercado e padaria
  R(/SUPER|MERCAD|ATACAD|PANIF|PADAR|PADOCA|HORTI|EMPORI|ACOUGU|FEIRA\b|MINIMER|INGRE|MULTI|CONVE|DISTR\b|MORAD|MANAU|NOSSA|POBRE|ASSAI|CARREFOUR/, 'mercado', 'out'),

  // Bares e restaurantes
  R(/BISTRO|CHOPP|GRILL|CHURRA|ESFIHA|OSTERIA|PEIXAR|SUSHI|TEMAKI|BALNE|BOB'?S|CHOPE|CHURA|ESFIR|JIM C|KIKAO|MANGO|MEG D|MUTSU|OLIVE|PUROF|RENAT|STEAK|SORVE|RESTAU|BAR\b|PIZZ|BURGER|MC ?DONALD/, 'restaurantes', 'out'),

  // Compras (lojas e QR de lojas)
  R(/CASAD|PAPELA|BAZAR|UTILID|LOJAS|LOJIN|T B R|AMAZON|INFO STORE|PICHAU|VIVARA|GIORDANI|MN COMERCIO|MSA EMPRESA|MARKETP|PAGAR ME|P&P|EXTRA|SHOPEE|MERCADOLIVRE|MAGAZINE/, 'compras', 'out'),

  // Lanches (cantinas, distribuidoras e similares)
  R(/JR DI|CANTINA/, 'lanches', 'out'),

  // Fallbacks por tipo de lançamento
  R(/^PIX TRANSF/, 'pessoas', 'out'),
  R(/^PIX QRS/, 'compras', 'out'),
  R(/^PAY\b/, 'lanches', 'out'),
];

/**
 * Descrições do Open Finance ("Compra débito X", "Pix enviado X"…) reescritas no formato do extrato Itaú
 * ("PAY X", "PIX TRANSF X"…), pra cair nas mesmas regras. Recebe texto já em maiúsculas e sem acento.
 */
const OPEN_FINANCE_PREFIXES: [RegExp, string][] = [
  [/^COMPRA DEBITO /, 'PAY '],
  [/^PAGAMENTO DE PIX QR CODE /, 'PIX QRS '],
  [/^PIX (ENVIADO|RECEBIDO) /, 'PIX TRANSF '],
  [/^(ENTRADA|SAIDA) /, ''],
];
export function normalizeDescription(description: string): string {
  let d = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [re, to] of OPEN_FINANCE_PREFIXES) d = d.replace(re, to);
  return d;
}

/**
 * Regras extras no formato de CATEGORY_RULES: `REGEX=categoria[:in|out]` separadas por `;`
 * (ex.: `PIX TRANSF FULANO=propria;PIX TRANSF CICLANA=moradia:out;FINANCEIRA X=moto`).
 * O texto comparado já vem em maiúsculas e sem acento.
 */
export function parseRules(spec = ''): Rule[] {
  return spec
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf('=');
      const [category, sign = 'any'] = s.slice(i + 1).trim().split(':');
      if (i <= 0 || !CATEGORY_BY_ID.has(category) || !['in', 'out', 'any'].includes(sign))
        throw new Error(`CATEGORY_RULES inválida: "${s}" (use REGEX=categoria[:in|out])`);
      return R(new RegExp(s.slice(0, i).trim(), 'i'), category, sign as Sign);
    });
}

// lido na primeira chamada: o ConfigModule carrega o .env depois dos imports
let userRules: Rule[] | undefined;
const envRules = () => (userRules ??= parseRules(process.env.CATEGORY_RULES));

/** Retorna o id da categoria para um lançamento (descrição + valor com sinal). Regras do .env vêm antes. */
export function categorize(description: string, amount: number, extra: Rule[] = envRules()): string {
  const d = normalizeDescription(description);
  const sign: Sign = amount >= 0 ? 'in' : 'out';
  for (const r of [...extra, ...RULES]) {
    if (r.sign !== 'any' && r.sign !== sign) continue;
    if (r.re.test(d)) return r.category;
  }
  return sign === 'in' ? 'outros_in' : 'compras';
}
