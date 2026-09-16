import { describe, expect, it } from 'vitest';
import type { QuitEventEnvelope } from '../../../packages/contracts/src/index';
import { LocalEventStore, type LocalEventDatabase, type LocalEventRow } from '../src/local-event-store';
import { RescueEventSinkAdapter } from '../src/rescue/events';

class MemoryDatabase implements LocalEventDatabase {
  rows = new Map<string, LocalEventRow>();
  async get(eventId: string) { return this.rows.get(eventId) ?? null; }
  async insert(eventId: string, envelope: string) {
    this.rows.set(eventId, { eventId, envelope, syncState: 'pending', attemptCount: 0, nextAttemptAt: null, syncedAt: null });
  }
  async listPending(limit: number) { return [...this.rows.values()].slice(0, limit); }
  async markSynced(eventId: string, syncedAt: string) {
    const row = this.rows.get(eventId);
    if (row) this.rows.set(eventId, { ...row, syncState: 'synced', syncedAt });
  }
}

const ids = [
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440103',
];

const base = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  rescueSessionId: '550e8400-e29b-41d4-a716-446655440010',
  interventionId: 'micro-regulate',
  interventionVersion: 1,
  rescueLevel: 'micro' as const,
  libraryContentVersion: 1,
  occurredAt: '2026-09-16T05:00:00.000Z',
};

describe('RescueEventSinkAdapter', () => {
  it('appends start and completion as distinct immutable events with pinned metadata', async () => {
    const db = new MemoryDatabase();
    let index = 0;
    const sink = new RescueEventSinkAdapter(new LocalEventStore(db), () => ids[index++]!, () => '2026-09-16T05:00:01.000Z');

    await sink.interventionStarted({ ...base, reasonCodes: ['user_preferred'] });
    await sink.interventionCompleted(base);

    const events = await new LocalEventStore(db).listPending(10);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.eventType)).toEqual(['intervention_started', 'intervention_completed']);
    expect(events[0]?.eventId).not.toBe(events[1]?.eventId);
    expect(events[0]?.payload).toMatchObject({
      rescueSessionId: base.rescueSessionId,
      interventionVersion: 1,
      rescueLevel: 'micro',
      libraryContentVersion: 1,
    });
  });

  it('records product use as a new event without changing prior rescue history', async () => {
    const db = new MemoryDatabase();
    let index = 0;
    const store = new LocalEventStore(db);
    const sink = new RescueEventSinkAdapter(store, () => ids[index++]!, () => '2026-09-16T05:00:01.000Z');

    await sink.interventionStarted({ ...base, reasonCodes: [] });
    const original = (await store.listPending(10))[0] as QuitEventEnvelope;
    await sink.productUse({
      userId: base.userId,
      deviceId: base.deviceId,
      rescueSessionId: base.rescueSessionId,
      product: 'cigarette',
      quantity: 1,
      occurredAt: '2026-09-16T05:02:00.000Z',
    });

    const events = await store.listPending(10);
    expect(events).toHaveLength(2);
    expect(await store.get(original.eventId)).toEqual(original);
    expect(events[1]).toMatchObject({ eventType: 'product_use', payload: { product: 'cigarette', quantity: 1 } });
  });
});
