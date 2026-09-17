import { describe, expect, it, vi } from 'vitest';
import {
  AlcoholEventEnvelopeSchema,
  type AlcoholEventEnvelope,
  type AlcoholRecoveryContext,
  type AlcoholRecoverySession,
  type WithdrawalSafetyDisposition,
} from '../../../packages/contracts/src/index';
import { AlcoholRecoveryEventSinkAdapter } from '../src/alcohol/recovery/events';
import { AlcoholRecoverySessionCoordinator } from '../src/alcohol/recovery';
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

const now = '2026-09-17T07:00:00.000Z';
const later = '2026-09-17T07:01:00.000Z';
const recordedAt = '2026-09-17T07:02:00.000Z';
const ids = [
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440102',
];

function context(disposition: WithdrawalSafetyDisposition = 'behavior_change_support_allowed'): AlcoholRecoveryContext {
  return {
    recoverySessionId: '550e8400-e29b-41d4-a716-446655440010',
    triggeringUseEventId: '550e8400-e29b-41d4-a716-446655440011',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    deviceId: '550e8400-e29b-41d4-a716-446655440002',
    startedAt: now,
    goalType: 'reduction',
    goalId: '550e8400-e29b-41d4-a716-446655440003',
    canContactSupport: false,
    safetyDecision: {
      engineId: 'alcohol_withdrawal_risk', ruleSetId: 'pinned-safety-rules', ruleSetVersion: 7,
      disposition, reasonCodes: [], evaluatedEvidenceKeys: ['currentSeizure'],
      unknownCriticalEvidenceKeys: [], decidedAt: now,
    },
  };
}

function start(disposition?: WithdrawalSafetyDisposition) {
  return AlcoholRecoverySessionCoordinator.start({ context: context(disposition), libraryContentVersion: 2, now });
}

function active() {
  const recovery = start();
  recovery.beginReflection(now);
  recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, now);
  recovery.beginSelected(now);
  return recovery;
}

function setup() {
  const db = new MemoryEventDatabase();
  const store = new LocalEventStore<AlcoholEventEnvelope>(db, AlcoholEventEnvelopeSchema);
  let index = 0;
  const createEventId = vi.fn(() => ids[index++]!);
  const clock = vi.fn(() => recordedAt);
  return { db, store, createEventId, clock, sink: new AlcoholRecoveryEventSinkAdapter(store, createEventId, clock) };
}

describe('AlcoholRecoveryEventSinkAdapter', () => {
  it('appends only supplied structured reflection with injected identity and time', async () => {
    const { sink, store } = setup();
    const recovery = start();
    recovery.beginReflection(now);
    const snapshot = recovery.recordReflection({ planRelation: 'unknown', triggerTags: ['social'], contextTags: ['home'] }, later);
    await sink.reflection(snapshot);
    snapshot.reflection!.triggerTags!.push('not-supplied-at-append');

    expect(await store.listPending(10)).toEqual([{
      eventId: ids[0], userId: context().userId, deviceId: context().deviceId,
      moduleId: 'alcohol', schemaVersion: 1, eventType: 'alcohol_recovery_reflection',
      occurredAt: later, recordedAt,
      payload: {
        recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId,
        planRelation: 'unknown', triggerTags: ['social'], contextTags: ['home'],
      },
    }]);
  });

  it('does not fabricate reflection, allocate an id, or read the clock for absent or empty reflection', async () => {
    const { sink, store, createEventId, clock } = setup();
    const recovery = start();
    recovery.beginReflection(now);
    await sink.reflection(recovery.snapshot());
    await sink.reflection(recovery.recordReflection({}, later));
    expect(await store.listPending(10)).toEqual([]);
    expect(createEventId).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
  });

  it.each([
    { planRelation: undefined },
    { triggerTags: undefined },
    { contextTags: undefined },
    { nextAction: undefined },
    { planRelation: undefined, triggerTags: undefined, contextTags: undefined, nextAction: undefined },
  ])('does not append or allocate identity/time for undefined-only reflection %j', async (reflection) => {
    const { sink, store, createEventId, clock } = setup();
    const append = vi.spyOn(store, 'append');
    const recovery = start();
    recovery.beginReflection(now);
    const snapshot = recovery.recordReflection(reflection, later);
    const before = structuredClone(snapshot);

    await sink.reflection(snapshot);

    expect(await store.listPending(10)).toEqual([]);
    expect(append).not.toHaveBeenCalled();
    expect(createEventId).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(snapshot).toStrictEqual(before);
  });

  it.each([
    { planRelation: 'unknown' as const },
    { triggerTags: [] },
    { contextTags: ['home'] },
    { nextAction: 'offer_support' as const },
  ])('preserves supplied reflection %j while removing undefined entries before append', async (supplied) => {
    const { sink, store } = setup();
    const append = vi.spyOn(store, 'append');
    const recovery = start();
    recovery.beginReflection(now);
    const snapshot = recovery.recordReflection({
      planRelation: undefined, triggerTags: undefined, contextTags: undefined, nextAction: undefined,
      ...supplied,
    }, later);
    const before = structuredClone(snapshot);

    await sink.reflection(snapshot);

    const expected = {
      recoverySessionId: context().recoverySessionId,
      triggeringUseEventId: context().triggeringUseEventId,
      ...supplied,
    };
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0].payload).toStrictEqual(expected);
    expect((await store.listPending(10))[0]?.payload).toStrictEqual(expected);
    expect(snapshot).toStrictEqual(before);
  });

  it.each([{ success: true }, { nextAction: 'change_goal' }, { triggerTags: [''] }, { relapse: true }])(
    'rejects invalid reflection before append: %j', async (reflection) => {
      const { sink, store } = setup();
      const append = vi.spyOn(store, 'append');
      await expect(sink.reflection({ ...start().snapshot(), reflection } as AlcoholRecoverySession)).rejects.toThrow();
      expect(append).not.toHaveBeenCalled();
      expect(await store.listPending(10)).toEqual([]);
    },
  );

  it('records completion without inventing reflection, next action, success, or goal changes', async () => {
    const { sink, store } = setup();
    const snapshot = active().complete(undefined, later);
    const before = structuredClone(snapshot);
    await sink.outcome(snapshot);
    const [event] = await store.listPending(10);
    expect(event).toEqual({
      eventId: ids[0], userId: context().userId, deviceId: context().deviceId,
      moduleId: 'alcohol', schemaVersion: 1, eventType: 'alcohol_recovery_outcome',
      occurredAt: later, recordedAt,
      payload: {
        recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId,
        goalId: context().goalId, outcome: 'completed', interventionId: 'alcohol-recovery-reset', interventionVersion: 1,
      },
    });
    expect(AlcoholEventEnvelopeSchema.safeParse(event).success).toBe(true);
    expect(snapshot).toEqual(before);
  });

  it.each(['offer_support', 'review_plan'] as const)('keeps explicit %s as inert data only', async (nextAction) => {
    const { sink, store } = setup();
    const snapshot = active().complete(nextAction, later);
    const before = structuredClone(snapshot);
    await sink.reflection(snapshot);
    await sink.outcome(snapshot);
    const events = await store.listPending(10);
    expect(events.map((event) => event.eventType)).toEqual(['alcohol_recovery_reflection', 'alcohol_recovery_outcome']);
    expect(events[0]?.payload).toEqual({ recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId, nextAction });
    expect(events[1]?.payload).toEqual({
      recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId,
      goalId: context().goalId, outcome: 'completed', nextAction,
      interventionId: 'alcohol-recovery-reset', interventionVersion: 1,
    });
    expect(events.every((event) => AlcoholEventEnvelopeSchema.safeParse(event).success)).toBe(true);
    expect(snapshot).toEqual(before);
    expect(JSON.stringify(events)).not.toMatch(/goal_changed|failed|relapse|success|causality/);
  });

  it.each(['behavior_change_support_allowed', 'emergency_response'] as const)(
    'records abandonment, not completion or safety routing, for %s', async (disposition) => {
      const { sink, store } = setup();
      await sink.outcome(start(disposition).abandon(later));
      const [event] = await store.listPending(10);
      expect(event?.payload).toEqual({
        recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId,
        goalId: context().goalId, outcome: 'abandoned',
      });
      expect(AlcoholEventEnvelopeSchema.safeParse(event).success).toBe(true);
    },
  );

  it.each(['emergency_response', 'urgent_medical_assessment'] as const)(
    'maps completed %s routing to only the pinned safety audit', async (disposition) => {
      const { sink, store } = setup();
      const snapshot = start(disposition).completeSafetyRouting(later);
      await sink.reflection(snapshot);
      await sink.outcome(snapshot);
      const events = await store.listPending(10);
      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toEqual({
        recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId,
        goalId: context().goalId, outcome: 'safety_routed',
        safetyAudit: { engineId: 'alcohol_withdrawal_risk', ruleSetId: 'pinned-safety-rules', ruleSetVersion: 7, disposition },
      });
      expect(AlcoholEventEnvelopeSchema.safeParse(events[0]).success).toBe(true);
    },
  );

  it.each(['started', 'reflecting', 'intervention_selected', 'intervention_active', 'safety_routing'] as const)(
    'does not infer an outcome from nonterminal %s', async (state) => {
      const { sink, store } = setup();
      await expect(sink.outcome({ ...start().snapshot(), state })).rejects.toThrow('alcohol_recovery_outcome_requires_terminal_session');
      expect(await store.listPending(10)).toEqual([]);
    },
  );

  it('does not invent an optional goal id', async () => {
    const { sink, store } = setup();
    const snapshot = start().abandon(later);
    delete snapshot.context.goalId;
    await sink.outcome(snapshot);
    expect((await store.listPending(10))[0]?.payload).toEqual({
      recoverySessionId: context().recoverySessionId, triggeringUseEventId: context().triggeringUseEventId, outcome: 'abandoned',
    });
  });

  it.each(['reflection', 'outcome'] as const)('validates the generated %s envelope before calling append', async (method) => {
    const { store } = setup();
    const append = vi.spyOn(store, 'append');
    const snapshot = active().complete('finish', later);
    for (const [id, time] of [['not-a-uuid', recordedAt], [ids[0]!, 'not-a-time']]) {
      const sink = new AlcoholRecoveryEventSinkAdapter(store, () => id!, () => time!);
      await expect(sink[method](snapshot)).rejects.toThrow();
    }
    expect(append).not.toHaveBeenCalled();
    expect(await store.listPending(10)).toEqual([]);
  });

  it('appends recovery facts after existing history without changing the original use or order', async () => {
    const { sink, store, db } = setup();
    const use: AlcoholEventEnvelope = {
      eventId: context().triggeringUseEventId, userId: context().userId, deviceId: context().deviceId,
      moduleId: 'alcohol', schemaVersion: 1, eventType: 'alcohol_use', occurredAt: now, recordedAt: now,
      payload: { beverageCategory: 'beer', volumeMl: 330, quantityConfidence: 'exact', entrySource: 'manual', planRelation: 'unplanned' },
    };
    const prior = { ...use, eventId: '550e8400-e29b-41d4-a716-446655440012' };
    await store.append(prior);
    await store.append(use);
    const rowsBefore = structuredClone([...db.rows.values()]);
    const snapshot = active().complete('continue_goal', later);
    await sink.reflection(snapshot);
    await sink.outcome(snapshot);
    expect([...db.rows.values()].slice(0, 2)).toEqual(rowsBefore);
    expect(await store.get(use.eventId)).toEqual(use);
    const events = await store.listPending(10);
    expect(events.map((event) => event.eventId)).toEqual([prior.eventId, use.eventId, ...ids]);
    expect(events.map((event) => event.eventType)).toEqual(['alcohol_use', 'alcohol_use', 'alcohol_recovery_reflection', 'alcohol_recovery_outcome']);
    expect(JSON.stringify(events)).not.toMatch(/goal_changed|failed|relapse|success|causality/);
  });
});
