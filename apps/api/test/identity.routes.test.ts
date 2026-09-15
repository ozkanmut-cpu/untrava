import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const deviceId = '550e8400-e29b-41d4-a716-446655440002';

describe('identity HTTP routes', () => {
  it('creates an anonymous identity for a valid device id', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ deviceId });
    expect(response.json().userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.json().sessionId).toMatch(/^[0-9a-f-]{36}$/);
    await app.close();
  });

  it('rejects malformed device ids', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('revokes a device session idempotently', async () => {
    const app = await buildApp();
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
});
