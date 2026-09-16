import { describe, expect, it } from 'vitest';
import type { RescueContext } from '../../../packages/contracts/src/index';
import { LocalEventStore, type LocalEventDatabase, type LocalEventRow } from '../src/local-event-store';
import { RescueEventSinkAdapter } from '../src/rescue/events';
import { createBundledRescueLibrary } from '../src/rescue/library';
import { RescueSessionCoordinator } from '../src/rescue/session';
import { MemoryRescueSessionStore } from '../src/rescue/session-store';
import { selectIntervention } from '../src/rescue/selector';

class MemoryEventDatabase implements LocalEventDatabase {
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

const context: RescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-16T05:10:00.000Z',
  goalType: 'smoke_free',
  canMoveEnvironment: true,
  canContactSupport: true,
};

const eventIds = Array.from({ length: 12 }, (_, index) =>
  `550e8400-e29b-41d4-a716-${(446655441000 + index).toString()}`,
);

describe('offline Rescue vertical flow', () => {
  it('resolves Rescue, recovers after use, and resumes without any network dependency', async () => {
    const offlineTransport = {
      calls: 0,
      async send(): Promise<never> {
        this.calls += 1;
        throw new Error('offline');
      },
    };
    const eventDb = new MemoryEventDatabase();
    const eventStore = new LocalEventStore(eventDb);
    const sessionStore = new MemoryRescueSessionStore();
    let eventIndex = 0;
    const sink = new RescueEventSinkAdapter(
      eventStore,
      () => eventIds[eventIndex++]!,
      () => '2026-09-16T05:10:01.000Z',
    );
    const library = createBundledRescueLibrary();

    const firstSelection = selectIntervention(library, context);
    if (!firstSelection) throw new Error('expected rescue selection');
    const firstDefinition = library.interventions.find((item) => item.interventionId === firstSelection.interventionId);
    if (!firstDefinition) throw new Error('missing selection definition');

    const first = RescueSessionCoordinator.start(
      {
        rescueSessionId: '550e8400-e29b-41d4-a716-446655440020',
        context,
        libraryContentVersion: library.contentVersion,
        now: '2026-09-16T05:10:00.000Z',
      },
      sessionStore,
    );
    first.stabilize('2026-09-16T05:10:01.000Z');
    first.select(firstSelection, '2026-09-16T05:10:02.000Z');
    first.beginSelected('2026-09-16T05:10:03.000Z');
    await sink.interventionStarted({
      userId: context.userId,
      deviceId: context.deviceId,
      rescueSessionId: first.snapshot().rescueSessionId,
      interventionId: firstSelection.interventionId,
      interventionVersion: firstSelection.version,
      rescueLevel: firstDefinition.level,
      libraryContentVersion: library.contentVersion,
      occurredAt: '2026-09-16T05:10:03.000Z',
      reasonCodes: firstSelection.reasonCodes,
    });
    first.completeIntervention('2026-09-16T05:11:03.000Z');
    await sink.interventionCompleted({
      userId: context.userId,
      deviceId: context.deviceId,
      rescueSessionId: first.snapshot().rescueSessionId,
      interventionId: firstSelection.interventionId,
      interventionVersion: firstSelection.version,
      rescueLevel: firstDefinition.level,
      libraryContentVersion: library.contentVersion,
      occurredAt: '2026-09-16T05:11:03.000Z',
    });
    await sink.interventionOutcome({
      userId: context.userId,
      deviceId: context.deviceId,
      rescueSessionId: first.snapshot().rescueSessionId,
      interventionId: firstSelection.interventionId,
      interventionVersion: firstSelection.version,
      rescueLevel: firstDefinition.level,
      libraryContentVersion: library.contentVersion,
      occurredAt: '2026-09-16T05:11:04.000Z',
      outcome: { cravingBefore: 8, cravingAfter: 4, productUseOutcome: 'no_use' },
    });
    expect(first.reassess({ wantsAnother: false, outcome: { cravingBefore: 8, cravingAfter: 4 } }, '2026-09-16T05:11:04.000Z').state).toBe('resolved');

    const second = RescueSessionCoordinator.start(
      {
        rescueSessionId: '550e8400-e29b-41d4-a716-446655440021',
        context,
        libraryContentVersion: library.contentVersion,
        now: '2026-09-16T05:20:00.000Z',
      },
      sessionStore,
    );
    second.stabilize('2026-09-16T05:20:01.000Z');
    expect(second.reportUse('2026-09-16T05:20:02.000Z').state).toBe('recovery');
    await sink.productUse({
      userId: context.userId,
      deviceId: context.deviceId,
      rescueSessionId: second.snapshot().rescueSessionId,
      product: 'cigarette',
      quantity: 1,
      occurredAt: '2026-09-16T05:20:02.000Z',
    });
    const recoveryDefinition = library.interventions.find((item) => item.status === 'active' && item.recoveryEligible);
    if (!recoveryDefinition) throw new Error('missing recovery intervention');
    second.select(
      { interventionId: recoveryDefinition.interventionId, version: recoveryDefinition.version, reasonCodes: ['recovery'] },
      '2026-09-16T05:20:03.000Z',
    );
    second.beginSelected('2026-09-16T05:20:04.000Z');
    await sink.interventionStarted({
      userId: context.userId,
      deviceId: context.deviceId,
      rescueSessionId: second.snapshot().rescueSessionId,
      interventionId: recoveryDefinition.interventionId,
      interventionVersion: recoveryDefinition.version,
      rescueLevel: recoveryDefinition.level,
      libraryContentVersion: library.contentVersion,
      occurredAt: '2026-09-16T05:20:04.000Z',
      reasonCodes: ['recovery'],
    });
    second.completeIntervention('2026-09-16T05:21:04.000Z');
    await sink.interventionCompleted({
      userId: context.userId,
      deviceId: context.deviceId,
      rescueSessionId: second.snapshot().rescueSessionId,
      interventionId: recoveryDefinition.interventionId,
      interventionVersion: recoveryDefinition.version,
      rescueLevel: recoveryDefinition.level,
      libraryContentVersion: library.contentVersion,
      occurredAt: '2026-09-16T05:21:04.000Z',
    });
    second.reassess({ wantsAnother: false, outcome: { productUseOutcome: 'use' } }, '2026-09-16T05:21:05.000Z');

    const third = RescueSessionCoordinator.start(
      {
        rescueSessionId: '550e8400-e29b-41d4-a716-446655440022',
        context,
        libraryContentVersion: library.contentVersion,
        now: '2026-09-16T05:30:00.000Z',
      },
      sessionStore,
    );
    third.stabilize('2026-09-16T05:30:01.000Z');
    third.select(firstSelection, '2026-09-16T05:30:02.000Z');
    third.beginSelected('2026-09-16T05:30:03.000Z');
    const persisted = sessionStore.get(third.snapshot().rescueSessionId);
    if (!persisted) throw new Error('session was not persisted');
    const resumed = RescueSessionCoordinator.resume(persisted, sessionStore);
    expect(resumed.snapshot()).toMatchObject({
      state: 'intervention_active',
      libraryContentVersion: library.contentVersion,
      interventionId: firstSelection.interventionId,
      interventionVersion: firstSelection.version,
    });
    resumed.completeIntervention('2026-09-16T05:31:03.000Z');

    const events = await eventStore.listPending(20);
    expect(events.map((event) => event.eventType)).toEqual([
      'intervention_started',
      'intervention_completed',
      'intervention_outcome',
      'product_use',
      'intervention_started',
      'intervention_completed',
    ]);
    expect(sessionStore.get(first.snapshot().rescueSessionId)?.state).toBe('resolved');
    expect(sessionStore.get(second.snapshot().rescueSessionId)?.state).toBe('resolved');
    expect(offlineTransport.calls).toBe(0);
  });
});
