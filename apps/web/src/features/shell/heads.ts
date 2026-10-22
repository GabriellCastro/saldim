/** Kicker/título padrão do header por rota (as telas podem sobrescrever com useScreenHead). */
export const HEADS: Record<string, { kicker: string; title: string }> = {
  '/projecao': { kicker: 'Projeção mês a mês', title: 'Projeção' },
  '/gastos': { kicker: 'Extrato', title: 'Gastos' },
  '/limites': { kicker: 'Limites do mês', title: 'Limites e metas' },
  '/assistente': { kicker: 'Lê teu holerite, o Itaú e teus limites', title: 'Assistente IA' },
  '/emprestimos': { kicker: 'Crédito Trabalhador · desconto em folha', title: 'Empréstimos' },
  '/holerite': { kicker: 'Último holerite', title: 'Holerite' },
  '/bancos': { kicker: 'Open Finance Brasil · Banco Central', title: 'Conectar bancos' },
  '/perfil': { kicker: 'Conta, segurança e privacidade', title: 'Perfil' },
};

/** Ícones da tab bar (traço 1.6, do design mobile). */
/** Ícones (path SVG 24×24, traço) de cada tela: sidebar, tab bar e tela "Mais". */
export const NAV_ICONS: Record<string, string> = {
  '/visao-geral': 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  '/projecao': 'M4 19h16M5 15l4-4 3 3 7-7M15 7h4v4',
  '/gastos': 'M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM4 9.5h16M8 14.5h3',
  '/limites': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  '/assistente':
    'M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5ZM18.5 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.25-2.25 1-2.5 2.5-.25-1.5-1-2.25-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5Z',
  // pilha de moedas
  '/emprestimos': 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  // documento com linhas
  '/holerite': 'M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5zM14 3.5V8h4M9.5 12h5M9.5 15.5h5',
  // prédio de banco
  '/bancos': 'M4 9.5 12 5l8 4.5M5 9.5h14M6.5 9.5v7M10 9.5v7M14 9.5v7M17.5 9.5v7M4 19.5h16',
  // pessoa
  '/perfil': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
};
/** Rótulos curtos da tab bar. */
export const TAB_LABEL: Record<string, string> = {
  '/visao-geral': 'Início',
  '/projecao': 'Projeção',
  '/gastos': 'Gastos',
  '/limites': 'Metas',
  '/assistente': 'IA',
};
/** Subtítulos da tela "Mais". */
export const MORE_SUB: Record<string, string> = {
  '/projecao': 'Reserva e sobra mês a mês',
  '/limites': 'Limites por categoria e meta de reserva',
  '/emprestimos': 'Folha e consignados na conta',
  '/holerite': 'Bruto ao líquido',
  '/bancos': 'Open Finance ou carregar extrato',
  '/perfil': 'Dados, senha e privacidade',
};
