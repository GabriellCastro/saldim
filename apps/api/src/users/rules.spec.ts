import { isValidCpf, maskCpf, passwordError, passwordProblems, isValidPassword } from './rules';

describe('CPF', () => {
  it('aceita CPFs válidos com e sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.444.777-53')).toBe(false);
  });

  it('rejeita tamanho errado e sequências repetidas', () => {
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf('000.000.000-00')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
  });

  it('mascara como no design', () => {
    expect(maskCpf('12348231055')).toBe('•••.482.310-••');
    expect(maskCpf('123.482.310-55')).toBe('•••.482.310-••');
  });
});

describe('Senha', () => {
  it('aceita senha com 8+, número, letra e símbolo', () => {
    expect(isValidPassword('Saldim@2026')).toBe(true);
    expect(passwordError('abc12345!')).toBeNull();
  });

  it('exige mínimo de 8 caracteres', () => {
    expect(passwordProblems('a1@b')).toEqual(['Mínimo 8 caracteres']);
  });

  it('exige um número', () => {
    expect(passwordProblems('abcdefg@')).toEqual(['Um número']);
  });

  it('exige letra e símbolo', () => {
    expect(passwordProblems('abcd1234')).toEqual(['Letra e símbolo']);
    expect(passwordProblems('1234567@')).toEqual(['Letra e símbolo']);
  });

  it('gera mensagem pt-BR', () => {
    expect(passwordError('abc')).toBe('Senha fraca: falta mínimo 8 caracteres, um número, letra e símbolo.');
  });
});
