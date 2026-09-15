import { describe, expect, it } from 'vitest';
import { IdentityService, type IdentityRepository } from '../src/modules/identity/service';

const deviceId = '550e8400-e29b-41d4-a716-446655440002';

function memoryRepository(): IdentityRepository {
  const sessions = new Map<string, { userId: string; deviceId: string; revokedAt: Date | null }>();
  let sequence = 0;

  return {
    async createAnonymousUser(input) {
      sequence += 1;
      const userId = `550e8400-e29b-41d4-a716-${String(sequence).padStart(12, '0')}`;
      const sessionId = `650e8400-e29b-41d4-a716-${String(sequence).padStart(12, '0')}`;
      sessions.set(sessionId, { userId, deviceId: input.deviceId, revokedAt: null });
      return { userId, sessionId, deviceId: input.deviceId };
    },
    async revokeDeviceSession(userId, sessionId, revokedAt) {
      const session = sessions.get(sessionId);
      if (!session || session.userId !== userId) return false;
      if (!session.revokedAt) session.revokedAt = revokedAt;
      return true;
    },
  };
}

describe('IdentityService', () => {
  it('creates an anonymous user bound to the requesting device', async () => {
    const service = new IdentityService(memoryRepository());

    const result = await service.createAnonymousUser(deviceId);

    expect(result.deviceId).toBe(deviceId);
    expect(result.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('revokes the same device session idempotently', async () => {
    const service = new IdentityService(memoryRepository());
    const identity = await service.createAnonymousUser(deviceId);

    await expect(service.revokeDeviceSession(identity.userId, identity.sessionId)).resolves.toEqual({
      revoked: true,
    });
    await expect(service.revokeDeviceSession(identity.userId, identity.sessionId)).resolves.toEqual({
      revoked: true,
    });
  });
});
