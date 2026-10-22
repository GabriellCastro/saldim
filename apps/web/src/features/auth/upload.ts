import { post } from '@/lib/api';

export type DocKind = 'holerite' | 'extrato';
type ImportResult = { status?: string; error?: string | null; count?: number };

/** Envia o arquivo para POST /imports/{holerite|extrato}. Lança erro se a importação falhar. */
export async function uploadDoc(kind: DocKind, file: File): Promise<ImportResult> {
  const body = new FormData();
  body.append('file', file);
  const res = await post<ImportResult>(`/imports/${kind}`, body);
  if (res && typeof res.status === 'string' && /err|fail/i.test(res.status)) {
    throw new Error(res.error || 'A IA não conseguiu ler esse arquivo.');
  }
  return res;
}
