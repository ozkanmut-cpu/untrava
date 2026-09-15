import { afterEach, describe, expect, it } from 'vitest';
import type { QuitEventEnvelope } from '@untrava/contracts';
import { buildApp } from '../src/app';
import type { AnonymousIdentity, IdentityRepository } from '../src/modules/identity/service';
import type { EventRepository } from '../src/modules/events/event.service';

const userId = '550e8400-e29b-41d4-a716-446655440001';
const deviceId = '550e8400-e29b-41d4-a716-446655440002';
const event: QuitEventEnvelope = {
  eventId: '550e8400-e29b-41d4-a716-446655440003', userId, deviceId,
  eventType: 'product_use', occurredAt: '2026-09-16T08:00:00.000Z',
  recordedAt: '2026-09-16T08:00:01.000Z', schemaVersion: 1,
  payload: { product: 'cigarette', quantity: 1 },
};
const identityRepository: IdentityRepository = {
  async createAnonymousUser(input): Promise<AnonymousIdentity> { return { userId, sessionId: '650e8400-e29b-41d4-a716-446655440010', deviceId: input.deviceId }; },
  async revokeDeviceSession() { return false; },
};
function eventRepository(): EventRepository {
  const events = new Map<string, QuitEventEnvelope>();
  return {
    async append(candidate) { if (events.has(candidate.eventId)) return 'duplicate'; events.set(candidate.eventId, candidate); return 'accepted'; },
    async findByEventId(id) { return events.get(id) ?? null; },
  };
}
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

describe('event batch route', () => {
  it('accepts then deduplicates replayed client events', async () => {
    app = await buildApp({ identityRepository, eventRepository: eventRepository() });
    const request = { method: 'POST' as const, url: '/v1/events/batch', headers: { 'x-untrava-user-id': userId }, payload: { events: [event] } };
    expect((await app.inject(request)).json()).toEqual({ results: [{ eventId: event.eventId, status: 'accepted' }] });
    expect((await app.inject(request)).json()).toEqual({ results: [{ eventId: event.eventId, status: 'duplicate' }] });
  });
});
