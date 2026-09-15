import { describe, expect, it } from 'vitest';
import type { QuitEventEnvelope } from '@untrava/contracts';
import { EventService, type EventRepository } from '../src/modules/events/event.service';

const userId = '550e8400-e29b-41d4-a716-446655440001';
const deviceId = '550e8400-e29b-41d4-a716-446655440002';
const eventId = '550e8400-e29b-41d4-a716-446655440003';

const event: QuitEventEnvelope = {
  eventId,
  userId,
  deviceId,
  eventType: 'product_use',
  occurredAt: '2026-09-16T08:00:00.000Z',
  recordedAt: '2026-09-16T08:00:01.000Z',
  schemaVersion: 1,
  payload: { product: 'cigarette', quantity: 1 },
};

function memoryRepository(): EventRepository & { countByEventId(id: string): Promise<number> } {
  const events = new Map<string, QuitEventEnvelope>();
  return {
    async append(candidate) {
      if (events.has(candidate.eventId)) return 'duplicate';
      events.set(candidate.eventId, candidate);
      return 'accepted';
    },
    async findByEventId(id) {
      return events.get(id) ?? null;
    },
    async countByEventId(id) {
      return events.has(id) ? 1 : 0;
    },
  };
}

describe('EventService', () => {
  it('accepts the same client event exactly once', async () => {
    const repository = memoryRepository();
    const service = new EventService(repository);

    const first = await service.ingestBatch(userId, [event]);
    const second = await service.ingestBatch(userId, [event]);

    expect(first.results[0]?.status).toBe('accepted');
    expect(second.results[0]?.status).toBe('duplicate');
    expect(await repository.countByEventId(eventId)).toBe(1);
  });

  it('rejects an envelope owned by another user', async () => {
    const service = new EventService(memoryRepository());
    await expect(
      service.ingestBatch('650e8400-e29b-41d4-a716-446655440001', [event]),
    ).rejects.toThrow('event user does not match authenticated user');
  });
});
