/** Mensagem amigável para exibir: falha de rede, erro da API (pt-BR) ou o fallback. */
export function errorText(e: unknown, fallback: string): string {
  if (e instanceof TypeError) return 'Sem conexão com o servidor. Tenta de novo em instantes.';
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
