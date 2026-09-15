import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { IdentityRepository } from '../src/modules/identity/service';

const identityRepository: IdentityRepository = {
  async createAnonymousUser({ deviceId }) {
    return {
      userId: '550e8400-e29b-41d4-a716-446655440010',
      sessionId: '650e8400-e29b-41d4-a716-446655440010',
      deviceId,
    };
  },
  async revokeDeviceSession() {
    return true;
  },
};

let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('API composition root', () => {
  it('serves a minimal health response', async () => {
    app = await buildApp({ identityRepository });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
