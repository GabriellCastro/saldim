import { connection } from 'next/server';

/**
 * Cadastro aberto? Lido no servidor a cada request (REGISTRATION_OPEN=false fecha, padrão aberto),
 * então a mesma imagem serve pra instância pessoal e pra pública. A API confere a mesma variável.
 */
export async function registrationOpen(): Promise<boolean> {
  await connection();
  return process.env.REGISTRATION_OPEN !== 'false';
}
