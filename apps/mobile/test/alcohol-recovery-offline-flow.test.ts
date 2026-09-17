import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlcoholEventEnvelopeSchema, type AlcoholEventEnvelope, type AlcoholRecoveryContext } from '../../../packages/contracts/src/index';
import { AlcoholRecoveryEventSinkAdapter } from '../src/alcohol/recovery/events';
import { AlcoholRecoverySessionCoordinator, MemoryAlcoholRecoverySessionStore } from '../src/alcohol/recovery';
import { ALCOHOL_RESCUE_LIBRARY } from '../src/alcohol/rescue';
import { LocalEventStore, type LocalEventDatabase, type LocalEventRow } from '../src/local-event-store';

class MemoryEventDatabase implements LocalEventDatabase {
  rows = new Map<string, LocalEventRow>();
  async get(eventId: string) { return this.rows.get(eventId) ?? null; }
  async insert(eventId: string, envelope: string) {
    this.rows.set(eventId, { eventId, envelope, syncState: 'pending', attemptCount: 0, nextAttemptAt: null, syncedAt: null });
  }
  async listPending(limit: number) {
    return [...this.rows.values()].filter((row) => row.syncState === 'pending').slice(0, limit);
  }
  async markSynced(eventId: string, syncedAt: string) {
    const row = this.rows.get(eventId);
    if (row) this.rows.set(eventId, { ...row, syncState: 'synced', syncedAt });
  }
}

const now = '2026-09-17T08:00:00.000Z';
const context: AlcoholRecoveryContext = {
  recoverySessionId: '550e8400-e29b-41d4-a716-446655440010',
  triggeringUseEventId: '550e8400-e29b-41d4-a716-446655440011',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: now, goalType: 'reduction', goalId: '550e8400-e29b-41d4-a716-446655440003',
  safetyDecision: {
    engineId: 'alcohol_withdrawal_risk', ruleSetId: 'pinned-safety-rules', ruleSetVersion: 7,
    disposition: 'behavior_change_support_allowed', reasonCodes: [], evaluatedEvidenceKeys: [],
    unknownCriticalEvidenceKeys: [], decidedAt: now,
  },
};

describe('offline Alcohol Recovery acceptance', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserves the original use and goal through a complete reset and one local resume with zero transport calls', async () => {
    const offlineTransport = {
      calls: 0,
      async send(): Promise<never> {
        this.calls += 1;
        throw new Error('offline transport must never be called');
      },
    };
    vi.stubGlobal('fetch', offlineTransport.send.bind(offlineTransport));
    const db = new MemoryEventDatabase();
    const events = new LocalEventStore<AlcoholEventEnvelope>(db, AlcoholEventEnvelopeSchema);
    const sessions = new MemoryAlcoholRecoverySessionStore();
    const ids = ['550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440102'];
    let index = 0;
    const sink = new AlcoholRecoveryEventSinkAdapter(events, () => ids[index++]!, () => '2026-09-17T08:02:00.000Z');
    const use: AlcoholEventEnvelope = {
      eventId: context.triggeringUseEventId, userId: context.userId, deviceId: context.deviceId,
      moduleId: 'alcohol', schemaVersion: 1, eventType: 'alcohol_use', occurredAt: now, recordedAt: now,
      payload: {
        beverageCategory: 'beer', volumeMl: 330, abvPercent: 5,
        pureEthanol: { grams: 13.0185, calculationVersion: 'volume_abv_density_v1' },
        quantityConfidence: 'exact', entrySource: 'manual', planRelation: 'unplanned',
      },
    };
    await events.append(use);
    const originalRow = structuredClone(await db.get(use.eventId));
    const recovery = AlcoholRecoverySessionCoordinator.start({ context, libraryContentVersion: ALCOHOL_RESCUE_LIBRARY.contentVersion, now }, sessions);
    recovery.beginReflection('2026-09-17T08:00:01.000Z');
    await sink.reflection(recovery.recordReflection({ planRelation: 'unplanned', triggerTags: ['social'] }, '2026-09-17T08:00:02.000Z'));
    recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, '2026-09-17T08:00:03.000Z');
    recovery.beginSelected('2026-09-17T08:00:04.000Z');

    const persisted = sessions.get(context.recoverySessionId);
    if (!persisted) throw new Error('missing local Recovery session');
    const resumed = AlcoholRecoverySessionCoordinator.resume(persisted, sessions);
    expect(resumed.snapshot()).toMatchObject({
      state: 'intervention_active', libraryContentVersion: 2,
      interventionId: 'alcohol-recovery-reset', interventionVersion: 1,
      context: { goalId: context.goalId, triggeringUseEventId: use.eventId },
    });
    const completed = resumed.complete('continue_goal', '2026-09-17T08:01:04.000Z');
    await sink.outcome(completed);

    const pending = await events.listPending(10);
    expect(pending.map((event) => event.eventType)).toEqual(['alcohol_use', 'alcohol_recovery_reflection', 'alcohol_recovery_outcome']);
    expect(pending.map((event) => event.eventId)).toEqual([use.eventId, ...ids]);
    expect(pending.every((event) => AlcoholEventEnvelopeSchema.safeParse(event).success)).toBe(true);
    expect(pending[1]?.payload).toEqual({
      recoverySessionId: context.recoverySessionId, triggeringUseEventId: use.eventId,
      planRelation: 'unplanned', triggerTags: ['social'],
    });
    expect(pending[2]?.payload).toEqual({
      recoverySessionId: context.recoverySessionId, triggeringUseEventId: use.eventId,
      goalId: context.goalId, outcome: 'completed', nextAction: 'continue_goal',
      interventionId: 'alcohol-recovery-reset', interventionVersion: 1,
    });
    expect(await events.get(use.eventId)).toEqual(use);
    expect(await db.get(use.eventId)).toEqual(originalRow);
    expect(completed.context).toEqual(context);
    expect(sessions.get(context.recoverySessionId)).toEqual(completed);
    expect([...db.rows.values()].map((row) => row.syncState)).toEqual(['pending', 'pending', 'pending']);
    expect(JSON.stringify(pending)).not.toMatch(/goal_changed|failed|relapse|success|causality/);
    expect(offlineTransport.calls).toBe(0);
  });
});
