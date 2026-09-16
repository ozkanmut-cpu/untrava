import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProductionApp } from '../src/server-app';

const deviceId = '550e8400-e29b-41d4-a716-446655440010';
const eventId = '550e8400-e29b-41d4-a716-446655440011';
const correctionId = '550e8400-e29b-41d4-a716-446655440012';
const goalId = '550e8400-e29b-41d4-a716-446655440013';
const now = '2026-09-16T04:10:00.000Z';

describe('foundation vertical flow', () => {
  let runtime: Awaited<ReturnType<typeof createProductionApp>>;

  beforeAll(async () => {
    runtime = await createProductionApp();
    await runtime.prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (!runtime) return;
    await runtime.app.close();
    await runtime.prisma.$disconnect();
  });

  it('persists identity, consent, profile, goal and idempotent immutable events end to end', async () => {
    const identityResponse = await runtime.app.inject({
      method: 'POST',
      url: '/v1/identity/anonymous',
      payload: { deviceId },
    });
    expect(identityResponse.statusCode).toBe(201);
    const identity = identityResponse.json<{ userId: string; sessionId: string; deviceId: string }>();
    expect(identity.deviceId).toBe(deviceId);

    const headers = { 'x-untrava-user-id': identity.userId };

    const consentResponse = await runtime.app.inject({
      method: 'POST',
      url: '/v1/consents',
      headers,
      payload: {
        category: 'cessation_data_processing',
        purpose: 'foundation-flow',
        action: 'grant',
        version: 1,
      },
    });
    expect(consentResponse.statusCode).toBe(201);

    const profileResponse = await runtime.app.inject({
      method: 'PUT',
      url: '/v1/quit-profile',
      headers,
      payload: {
        userId: identity.userId,
        strategy: 'quit_now',
        products: [{ product: 'cigarette', dailyQuantity: 12 }],
        quitDate: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(profileResponse.statusCode).toBe(200);

    const goalResponse = await runtime.app.inject({
      method: 'POST',
      url: '/v1/goals',
      headers,
      payload: {
        goalId,
        userId: identity.userId,
        type: 'smoke_free',
        startsAt: now,
        endsAt: null,
      },
    });
    expect(goalResponse.statusCode).toBe(201);

    const original = {
      eventId,
      userId: identity.userId,
      deviceId,
      eventType: 'product_use' as const,
      occurredAt: now,
      recordedAt: now,
      schemaVersion: 1 as const,
      payload: { product: 'cigarette' as const, quantity: 1 },
    };

    const firstIngest = await runtime.app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      headers,
      payload: { events: [original] },
    });
    expect(firstIngest.statusCode).toBe(200);
    expect(firstIngest.json<{ results: Array<{ eventId: string; status: string }> }>().results[0]?.status).toBe('accepted');

    const replay = await runtime.app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      headers,
      payload: { events: [original] },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json<{ results: Array<{ eventId: string; status: string }> }>().results[0]?.status).toBe('duplicate');

    const correction = {
      eventId: correctionId,
      userId: identity.userId,
      deviceId,
      eventType: 'correction' as const,
      occurredAt: now,
      recordedAt: now,
      schemaVersion: 1 as const,
      payload: { targetEventId: eventId, quantity: 0.5 },
    };
    const correctionResponse = await runtime.app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      headers,
      payload: { events: [correction] },
    });
    expect(correctionResponse.statusCode).toBe(200);
    expect(correctionResponse.json<{ results: Array<{ eventId: string; status: string }> }>().results[0]?.status).toBe('accepted');

    expect(await runtime.prisma.quitEvent.count({ where: { userId: identity.userId } })).toBe(2);
    expect(await runtime.prisma.quitEvent.findUnique({ where: { eventId } })).not.toBeNull();
    expect(await runtime.prisma.quitEvent.findUnique({ where: { eventId: correctionId } })).not.toBeNull();
  });
});
