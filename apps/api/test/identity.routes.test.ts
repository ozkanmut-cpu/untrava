import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { AnonymousIdentity, IdentityRepository } from '../src/modules/identity/service';

const deviceId = '550e8400-e29b-41d4-a716-446655440002';

class SpyIdentityRepository implements IdentityRepository {
  createCalls: string[] = [];
  revokeCalls: Array<{ userId: string; sessionId: string }> = [];
  private identity: AnonymousIdentity = {
    userId: '550e8400-e29b-41d4-a716-446655440010',
    sessionId: '650e8400-e29b-41d4-a716-446655440010',
    deviceId,
  };

  async createAnonymousUser(input: { deviceId: string }): Promise<AnonymousIdentity> {
    this.createCalls.push(input.deviceId);
    return { ...this.identity, deviceId: input.deviceId };
  }

  async revokeDeviceSession(userId: string, sessionId: string): Promise<boolean> {
    this.revokeCalls.push({ userId, sessionId });
    return userId === this.identity.userId && sessionId === this.identity.sessionId;
  }
}

describe('identity HTTP routes', () => {
  it('requires an explicit repository when no persistent database is configured', async () => {
    await expect(buildApp()).rejects.toThrow(/DATABASE_URL|identity repository/i);
  });

  it('creates an anonymous identity for a valid device id', async () => {
    const repository = new SpyIdentityRepository();
    const app = await buildApp({ identityRepository: repository });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ deviceId });
    await app.close();
  });

  it('rejects malformed device ids', async () => {
    const repository = new SpyIdentityRepository();
    const app = await buildApp({ identityRepository: repository });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('revokes a device session idempotently', async () => {
    const repository = new SpyIdentityRepository();
    const app = await buildApp({ identityRepository: repository });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId },
    });
    const { userId, sessionId } = created.json();

    const first = await app.inject({
      method: 'DELETE',
      url: `/v1/device-sessions/${sessionId}`,
      headers: { 'x-untrava-user-id': userId },
    });
    const second = await app.inject({
      method: 'DELETE',
      url: `/v1/device-sessions/${sessionId}`,
      headers: { 'x-untrava-user-id': userId },
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ revoked: true });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ revoked: true });
    await app.close();
  });

  it('routes identity persistence through an injected repository boundary', async () => {
    const repository = new SpyIdentityRepository();
    const app = await buildApp({ identityRepository: repository });

    const created = await app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId },
    });
    const { userId, sessionId } = created.json();
    const revoked = await app.inject({
      method: 'DELETE',
      url: `/v1/device-sessions/${sessionId}`,
      headers: { 'x-untrava-user-id': userId },
    });

    expect(created.statusCode).toBe(201);
    expect(revoked.statusCode).toBe(200);
    expect(repository.createCalls).toEqual([deviceId]);
    expect(repository.revokeCalls).toEqual([{ userId, sessionId }]);
    await app.close();
  });
});
