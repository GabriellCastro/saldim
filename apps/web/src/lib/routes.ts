/** Rotas do app (fonte única para sidebar, tab bar e links). */
export const NAV = [
  { href: '/visao-geral', label: 'Visão geral', mobile: true },
  { href: '/projecao', label: 'Projeção', mobile: true },
  { href: '/gastos', label: 'Gastos', mobile: true },
  { href: '/limites', label: 'Limites e metas', mobile: false },
  { href: '/assistente', label: 'Assistente IA', mobile: true, badge: 'alerts' as const },
  { href: '/emprestimos', label: 'Empréstimos', mobile: false },
  { href: '/holerite', label: 'Holerite', mobile: false },
  { href: '/bancos', label: 'Conectar bancos', mobile: false },
] as const;

export const AUTH_ROUTES = { login: '/login', registro: '/registro', facial: '/facial' } as const;
export const PERFIL = '/perfil';
export const MAIS = '/mais'; // só mobile: lista os itens com mobile:false + perfil
