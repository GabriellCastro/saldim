/** Catálogo fixo de categorias (fonte única para API e web via GET /categories). */
export type CategoryKind = 'fixo' | 'variavel' | 'entrada' | 'interno';

export interface Category {
  id: string;
  label: string;
  kind: CategoryKind;
  /** limite padrão sugerido para categorias variáveis */
  defaultLimit?: number;
}

export const CATEGORIES: Category[] = [
  { id: 'lanches', label: 'Lanches e pequenos gastos', kind: 'variavel', defaultLimit: 700 },
  { id: 'mercado', label: 'Mercado e padaria', kind: 'variavel', defaultLimit: 800 },
  { id: 'compras', label: 'Compras', kind: 'variavel', defaultLimit: 300 },
  { id: 'pessoas', label: 'Pix para pessoas', kind: 'variavel', defaultLimit: 400 },
  { id: 'transporte', label: 'Transporte e apps', kind: 'variavel', defaultLimit: 450 },
  { id: 'delivery', label: 'Delivery', kind: 'variavel', defaultLimit: 250 },
  { id: 'saude', label: 'Saúde, academia e beleza', kind: 'variavel', defaultLimit: 300 },
  { id: 'restaurantes', label: 'Bares e restaurantes', kind: 'variavel', defaultLimit: 150 },
  { id: 'assinaturas', label: 'Assinaturas', kind: 'variavel', defaultLimit: 110 },
  { id: 'educacao', label: 'Educação', kind: 'variavel', defaultLimit: 136 },
  { id: 'moradia', label: 'Aluguel', kind: 'fixo' },
  { id: 'moto', label: 'Moto', kind: 'fixo' },
  { id: 'celular', label: 'Celular', kind: 'fixo' },
  { id: 'contas', label: 'Contas da casa', kind: 'fixo' },
  { id: 'emprestimo', label: 'Empréstimos na conta', kind: 'fixo' },
  { id: 'tarifas', label: 'Tarifas e seguros', kind: 'fixo' },
  { id: 'salario', label: 'Salário', kind: 'entrada' },
  { id: 'emprestimo_in', label: 'Crédito de empréstimo', kind: 'entrada' },
  { id: 'outros_in', label: 'Outras entradas', kind: 'entrada' },
  { id: 'propria', label: 'Transferência entre contas próprias', kind: 'interno' },
  { id: 'investimento', label: 'Caixinha e investimentos', kind: 'interno' },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const VARIABLE_IDS = CATEGORIES.filter((c) => c.kind === 'variavel').map((c) => c.id);
