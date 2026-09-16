import { describe, expect, it } from 'vitest';
import type { RescueOutcome } from '../../../packages/contracts/src/index';
import { LocalEventStore, type LocalEventDatabase, type LocalEventRow } from '../src/local-event-store';
import { RescueEventSinkAdapter } from '../src/rescue/events';

class MemoryDatabase implements LocalEventDatabase {
  rows = new Map<string, LocalEventRow>();

  async get(eventId: string) {
    return this.rows.get(eventId) ?? null;
  }

  async insert(eventId: string, envelope: string) {
    this.rows.set(eventId, {
      eventId,
      envelope,
      syncState: 'pending',
      attemptCount: 0,
      nextAttemptAt: null,
      syncedAt: null,
    });
  }

  async listPending(limit: number) {
    return [...this.rows.values()].filter((row) => row.syncState === 'pending').slice(0, limit);
  }

  async markSynced(eventId: string, syncedAt: string) {
    const row = this.rows.get(eventId);
    if (row) this.rows.set(eventId, { ...row, syncState: 'synced', syncedAt });
  }
}

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

describe('Rescue outcome facts', () => {
  it('rejects causal efficacy claims and persists only observed outcome facts', async () => {
    const db = new MemoryDatabase();
    const store = new LocalEventStore(db);
    let index = 0;
    const ids = [
      '550e8400-e29b-41d4-a716-446655440201',
      '550e8400-e29b-41d4-a716-446655440202',
    ];
    const sink = new RescueEventSinkAdapter(
      store,
      () => ids[index++]!,
      () => '2026-09-16T05:00:01.000Z',
    );

    const causalClaim = {
      cravingBefore: 8,
      cravingAfter: 3,
      causedImprovement: true,
      efficacyScore: 0.9,
    } as RescueOutcome;

    await expect(
      sink.interventionOutcome({
        ...base,
        outcome: causalClaim,
      }),
    ).rejects.toThrow();

    await sink.interventionOutcome({
      ...base,
      outcome: {
        cravingBefore: 8,
        cravingAfter: 3,
        delayMinutes: 6,
        environmentChanged: true,
        userHelpfulRating: 'helped',
      },
    });

    const events = await store.listPending(10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'intervention_outcome',
      payload: {
        rescueSessionId: base.rescueSessionId,
        interventionId: base.interventionId,
        interventionVersion: base.interventionVersion,
        cravingBefore: 8,
        cravingAfter: 3,
        delayMinutes: 6,
        environmentChanged: true,
        userHelpfulRating: 'helped',
      },
    });
    expect(JSON.stringify(events[0]?.payload)).not.toMatch(/caused|efficacy|effective/i);
  });
});
