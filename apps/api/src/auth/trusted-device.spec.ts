import { DEVICE_TTL_MS, deviceExpiry, hashDeviceToken, newDeviceToken } from './trusted-device';

describe('token de aparelho lembrado', () => {
  it('gera tokens longos e diferentes a cada chamada', () => {
    const a = newDeviceToken();
    const b = newDeviceToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hash é determinístico e não contém o token', () => {
    const t = newDeviceToken();
    expect(hashDeviceToken(t)).toBe(hashDeviceToken(t));
    expect(hashDeviceToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeviceToken(t)).not.toContain(t);
  });

  it('expira 90 dias depois', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(deviceExpiry(now).getTime() - now.getTime()).toBe(DEVICE_TTL_MS);
  });
});
