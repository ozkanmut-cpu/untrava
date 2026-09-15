import { describe, expect, it } from 'vitest';
import type { QuitEventEnvelope } from '@untrava/contracts';
import { PrismaEventRepository } from '../src/modules/events/event.repository';

const event: QuitEventEnvelope = {
  eventId: '550e8400-e29b-41d4-a716-446655440003', userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002', eventType: 'product_use',
  occurredAt: '2026-09-16T08:00:00.000Z', recordedAt: '2026-09-16T08:00:01.000Z', schemaVersion: 1,
  payload: { product: 'cigarette', quantity: 1 },
};

describe('PrismaEventRepository', () => {
  it('returns duplicate without rewriting an existing event', async () => {
    let creates = 0;
    const prisma = { quitEvent: {
      async findUnique() { return { eventId: event.eventId }; },
      async create() { creates += 1; return {}; },
    } };
    const repository = new PrismaEventRepository(prisma as never);
    await expect(repository.append(event)).resolves.toBe('duplicate');
    expect(creates).toBe(0);
  });
});
