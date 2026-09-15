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
});
