import { describe, expect, it } from 'vitest';
import {
  AlcoholEventEnvelopeSchema,
  type AlcoholEventEnvelope,
  type QuitEventEnvelope,
} from '../../../packages/contracts/src/index';
import { LocalEventStore, type LocalEventDatabase } from '../src/local-event-store';

const event: QuitEventEnvelope = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  eventType: 'craving',
  occurredAt: '2026-09-15T20:00:00.000Z',
  recordedAt: '2026-09-15T20:00:01.000Z',
  schemaVersion: 1,
  payload: { intensity: 7 },
};

const alcoholRecoveryOutcomeEvent: AlcoholEventEnvelope = {
  eventId: '550e8400-e29b-41d4-a716-446655440010',
  userId: '550e8400-e29b-41d4-a716-446655440011',
  deviceId: '550e8400-e29b-41d4-a716-446655440012',
  moduleId: 'alcohol',
  eventType: 'alcohol_recovery_outcome',
  occurredAt: '2026-09-15T20:00:00.000Z',
  recordedAt: '2026-09-15T20:00:01.000Z',
  schemaVersion: 1,
  payload: {
    recoverySessionId: '550e8400-e29b-41d4-a716-446655440013',
    triggeringUseEventId: '550e8400-e29b-41d4-a716-446655440014',
    outcome: 'completed',
  },
};

class MemoryDatabase implements LocalEventDatabase {
  rows = new Map<string, { envelope: string; syncState: 'pending' | 'synced' | 'failed'; attemptCount: number; nextAttemptAt: string | null; syncedAt: string | null }>();
  async get(eventId: string) { const row = this.rows.get(eventId); return row ? { eventId, ...row } : null; }
  async insert(eventId: string, envelope: string) {
    this.rows.set(eventId, { envelope, syncState: 'pending', attemptCount: 0, nextAttemptAt: null, syncedAt: null });
  }
  async listPending(limit: number) {
    return [...this.rows.entries()].filter(([, row]) => row.syncState === 'pending').slice(0, limit).map(([eventId, row]) => ({ eventId, ...row }));
  }
  async markSynced(eventId: string, syncedAt: string) {
    const row = this.rows.get(eventId);
    if (row) this.rows.set(eventId, { ...row, syncState: 'synced', syncedAt });
  }
}

describe('LocalEventStore', () => {
  it('keeps an immutable event and treats an identical duplicate as a no-op', async () => {
    const db = new MemoryDatabase();
    const store = new LocalEventStore(db);
    await store.append(event);
    await store.append(event);
    expect(db.rows.size).toBe(1);
    expect(await store.get(event.eventId)).toEqual(event);
  });

  it('rejects a conflicting duplicate event id', async () => {
    const store = new LocalEventStore(new MemoryDatabase());
    await store.append(event);
    await expect(store.append({ ...event, payload: { intensity: 9 } })).rejects.toThrow('conflicting_event_id');
  });

  it('keeps correction and original events independently pending', async () => {
    const store = new LocalEventStore(new MemoryDatabase());
    const correction: QuitEventEnvelope = {
      ...event,
      eventId: '550e8400-e29b-41d4-a716-446655440003',
      eventType: 'correction',
      payload: { targetEventId: event.eventId, intensity: 5 },
    };
    await store.append(event);
    await store.append(correction);
    expect((await store.listPending(10)).map((item) => item.eventId)).toEqual([event.eventId, correction.eventId]);
  });

  it('stores alcohol recovery outcomes with the injected strict schema', async () => {
    const db = new MemoryDatabase();
    const store = new LocalEventStore<AlcoholEventEnvelope>(db, AlcoholEventEnvelopeSchema);

    await store.append(alcoholRecoveryOutcomeEvent);
    await store.append(alcoholRecoveryOutcomeEvent);

    expect(db.rows.size).toBe(1);
    expect(await store.get(alcoholRecoveryOutcomeEvent.eventId)).toEqual(alcoholRecoveryOutcomeEvent);
    expect(await store.listPending(10)).toEqual([alcoholRecoveryOutcomeEvent]);
    await expect(store.append({
      ...alcoholRecoveryOutcomeEvent,
      payload: { ...alcoholRecoveryOutcomeEvent.payload, outcome: 'abandoned' },
    })).rejects.toThrow('conflicting_event_id');
    await expect(store.append({
      ...alcoholRecoveryOutcomeEvent,
      eventId: '550e8400-e29b-41d4-a716-446655440015',
      payload: { ...alcoholRecoveryOutcomeEvent.payload, outcome: 'safety_routed' },
    })).rejects.toThrow();
    expect(db.rows.size).toBe(1);
  });
});
