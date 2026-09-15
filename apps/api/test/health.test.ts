import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('API composition root', () => {
  it('serves a minimal health response', async () => {
    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
