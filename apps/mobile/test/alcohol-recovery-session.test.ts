import { describe, expect, it } from 'vitest';
import type {
  AlcoholRecoveryContext,
  AlcoholRecoveryNextAction,
  AlcoholRecoverySession,
  AlcoholRecoverySessionState,
  WithdrawalSafetyDisposition,
} from '../../../packages/contracts/src/index';
import {
  AlcoholRecoverySessionCoordinator,
  MemoryAlcoholRecoverySessionStore,
  type AlcoholRecoverySessionStore,
  type StartAlcoholRecoveryInput,
} from '../src/alcohol/recovery';
import { ALCOHOL_RESCUE_LIBRARY } from '../src/alcohol/rescue';
import { sealInterventionLibrary } from '../src/rescue/library-integrity';

const now = '2026-09-17T07:00:00.000Z';
const later = '2026-09-17T07:01:00.000Z';

function context(
  disposition: WithdrawalSafetyDisposition = 'behavior_change_support_allowed',
): AlcoholRecoveryContext {
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
      engineId: 'alcohol_withdrawal_risk',
      ruleSetId: 'pinned-safety-rules',
      ruleSetVersion: 7,
      disposition,
      reasonCodes: [],
      evaluatedEvidenceKeys: ['currentSeizure'],
      unknownCriticalEvidenceKeys: [],
      decidedAt: now,
    },
  };
}

function start(
  store?: AlcoholRecoverySessionStore,
  disposition?: WithdrawalSafetyDisposition,
) {
  const input: StartAlcoholRecoveryInput = {
    context: context(disposition),
    libraryContentVersion: ALCOHOL_RESCUE_LIBRARY.contentVersion,
    now,
  };
  return AlcoholRecoverySessionCoordinator.start(input, store);
}

function atState(state: AlcoholRecoverySessionState, store?: AlcoholRecoverySessionStore) {
  const recovery = start(store, state === 'safety_routing' ? 'emergency_response' : undefined);
  if (['reflecting', 'intervention_selected', 'intervention_active', 'completed'].includes(state)) {
    recovery.beginReflection(now);
  }
  if (['intervention_selected', 'intervention_active', 'completed'].includes(state)) {
    recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, now);
  }
  if (['intervention_active', 'completed'].includes(state)) recovery.beginSelected(now);
  if (state === 'completed') recovery.complete(undefined, now);
  if (state === 'abandoned') recovery.abandon(now);
  return recovery;
}

const operations = [
  { name: 'beginReflection', allowed: ['started'], target: 'reflecting', run: (c: AlcoholRecoverySessionCoordinator) => c.beginReflection(later) },
  { name: 'recordReflection', allowed: ['reflecting'], target: 'reflecting', run: (c: AlcoholRecoverySessionCoordinator) => c.recordReflection({}, later) },
  { name: 'selectReset', allowed: ['reflecting'], target: 'intervention_selected', run: (c: AlcoholRecoverySessionCoordinator) => c.selectReset(ALCOHOL_RESCUE_LIBRARY, later) },
  { name: 'beginSelected', allowed: ['intervention_selected'], target: 'intervention_active', run: (c: AlcoholRecoverySessionCoordinator) => c.beginSelected(later) },
  { name: 'complete', allowed: ['intervention_active'], target: 'completed', run: (c: AlcoholRecoverySessionCoordinator) => c.complete('review_plan', later) },
  { name: 'completeSafetyRouting', allowed: ['safety_routing'], target: 'completed', run: (c: AlcoholRecoverySessionCoordinator) => c.completeSafetyRouting(later) },
  { name: 'abandon', allowed: ['started', 'safety_routing', 'reflecting', 'intervention_selected', 'intervention_active'], target: 'abandoned', run: (c: AlcoholRecoverySessionCoordinator) => c.abandon(later) },
];
const states: AlcoholRecoverySessionState[] = [
  'started', 'safety_routing', 'reflecting', 'intervention_selected', 'intervention_active', 'completed', 'abandoned',
];

describe('AlcoholRecoverySessionCoordinator', () => {
  it.each(['behavior_change_support_allowed', 'medical_assessment_advised'] as const)(
    'runs the low-risk reset path for %s without changing pinned identities',
    (disposition) => {
      const store = new MemoryAlcoholRecoverySessionStore();
      const recovery = start(store, disposition);
      const originalContext = recovery.snapshot().context;
      expect(recovery.snapshot()).toMatchObject({ state: 'started', interventionId: null, interventionVersion: null, currentStepIndex: 0 });
      expect(recovery.beginReflection(later).state).toBe('reflecting');
      expect(recovery.recordReflection({}, later).reflection).toEqual({});
      expect(recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, later)).toMatchObject({
        state: 'intervention_selected', interventionId: 'alcohol-recovery-reset', interventionVersion: 1,
        libraryContentVersion: 2, currentStepIndex: 0,
      });
      expect(recovery.beginSelected(later).state).toBe('intervention_active');
      const completed = recovery.complete('continue_goal', later);
      expect(completed).toMatchObject({ state: 'completed', reflection: { nextAction: 'continue_goal' }, updatedAt: later });
      expect(completed.context).toEqual(originalContext);
      expect(store.get(originalContext.recoverySessionId)).toEqual(completed);
    },
  );

  it.each(['emergency_response', 'urgent_medical_assessment'] as const)(
    'routes %s immediately and never records reflection or selects a reset',
    (disposition) => {
      const recovery = start(undefined, disposition);
      const before = recovery.snapshot();
      expect(before.state).toBe('safety_routing');
      for (const operation of operations.filter((op) => !['completeSafetyRouting', 'abandon'].includes(op.name))) {
        expect(() => operation.run(recovery)).toThrow('invalid_alcohol_recovery_transition');
        expect(recovery.snapshot()).toEqual(before);
      }
      expect(recovery.completeSafetyRouting(later)).toEqual({ ...before, state: 'completed', updatedAt: later });
    },
  );

  for (const state of states) {
    it.each(operations)(`enforces ${state} -> $name`, (operation) => {
      const store = new MemoryAlcoholRecoverySessionStore();
      const recovery = atState(state, store);
      const before = recovery.snapshot();
      if (operation.allowed.includes(state)) {
        const after = operation.run(recovery);
        expect(after.state).toBe(operation.target);
        expect(after.updatedAt).toBe(later);
        expect(after.context).toEqual(before.context);
        expect(store.get(before.context.recoverySessionId)).toEqual(after);
      } else {
        expect(() => operation.run(recovery)).toThrow('invalid_alcohol_recovery_transition');
        expect(recovery.snapshot()).toEqual(before);
        expect(store.get(before.context.recoverySessionId)).toEqual(before);
      }
    });
  }

  it.each(['continue_goal', 'open_rescue', 'offer_support', 'review_plan', 'finish'] as const)(
    'stores explicit %s only as next-action metadata',
    (nextAction) => {
      const recovery = atState('reflecting');
      recovery.recordReflection({ planRelation: 'unplanned', triggerTags: ['social'], contextTags: ['home'] }, now);
      recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, now);
      recovery.beginSelected(now);
      const before = recovery.snapshot();
      expect(recovery.complete(nextAction, later)).toEqual({
        ...before, state: 'completed', updatedAt: later,
        reflection: { ...before.reflection, nextAction },
      });
    },
  );

  it('does not invent reflection or a next action when completion omits it', () => {
    const recovery = atState('intervention_active');
    expect(recovery.complete(undefined, later).reflection).toBeUndefined();
    const reflected = atState('reflecting');
    reflected.recordReflection({ nextAction: 'finish' }, now);
    reflected.selectReset(ALCOHOL_RESCUE_LIBRARY, now);
    reflected.beginSelected(now);
    expect(reflected.complete(undefined, later).reflection).toEqual({ nextAction: 'finish' });
  });

  it.each(['intervention_selected', 'intervention_active'] as const)(
    'retains provenance on abandonment from %s only if activated', (state) => {
      for (const origin of ['fresh', 'resumed']) {
        const store = new MemoryAlcoholRecoverySessionStore();
        const selected = start(store);
        selected.beginReflection(now);
        selected.recordReflection({ nextAction: 'review_plan' }, now);
        selected.selectReset(ALCOHOL_RESCUE_LIBRARY, now);
        if (state === 'intervention_active') selected.beginSelected(now);
        const recovery = origin === 'resumed'
          ? AlcoholRecoverySessionCoordinator.resume(selected.snapshot(), store)
          : selected;
        const before = recovery.snapshot();
        const abandoned = recovery.abandon(later);
        expect(abandoned).toEqual({
          ...before, state: 'abandoned', updatedAt: later,
          interventionId: state === 'intervention_active' ? 'alcohol-recovery-reset' : null,
          interventionVersion: state === 'intervention_active' ? 1 : null,
        });
        expect(store.get(before.context.recoverySessionId)).toEqual(abandoned);
      }
    },
  );

  it.each(['intervention_selected', 'intervention_active'] as const)(
    'preserves %s provenance when abandonment persistence fails', (state) => {
      const memory = new MemoryAlcoholRecoverySessionStore();
      let fail = false;
      const store: AlcoholRecoverySessionStore = {
        get: (id) => memory.get(id),
        save(snapshot) {
          if (fail) throw new Error('local_persistence_failed');
          memory.save(snapshot);
        },
      };
      const recovery = atState(state, store);
      const before = recovery.snapshot();
      fail = true;
      expect(() => recovery.abandon(later)).toThrow('local_persistence_failed');
      expect(recovery.snapshot()).toEqual(before);
      expect(memory.get(before.context.recoverySessionId)).toEqual(before);
    },
  );

  it.each(states)('round-trips a validated %s snapshot with no aliases', (state) => {
    const store = new MemoryAlcoholRecoverySessionStore();
    const original = atState(state).snapshot();
    const expected = structuredClone(original);
    const resumed = AlcoholRecoverySessionCoordinator.resume(original, store);
    expect(resumed.snapshot()).toEqual(expected);
    original.context.safetyDecision.evaluatedEvidenceKeys.push('epilepsy');
    const snapshot = resumed.snapshot();
    snapshot.context.safetyDecision.reasonCodes.push('risk.epilepsy');
    expect(resumed.snapshot()).toEqual(expected);
    expect(store.get(expected.context.recoverySessionId)).toEqual(expected);
  });

  it('validates context at start and snapshots on resume before persistence', () => {
    const store = new MemoryAlcoholRecoverySessionStore();
    const invalidContext = { ...context(), triggeringUseEventId: 'invalid' };
    expect(() => AlcoholRecoverySessionCoordinator.start({ context: invalidContext, libraryContentVersion: 2, now }, store)).toThrow();
    expect(store.get(context().recoverySessionId)).toBeNull();
    const invalid = { ...start().snapshot(), unexpected: true };
    expect(() => AlcoholRecoverySessionCoordinator.resume(invalid, store)).toThrow();
    expect(store.get(context().recoverySessionId)).toBeNull();
  });

  it.each(['emergency_response', 'urgent_medical_assessment'] as const)(
    'rejects impossible %s snapshots before resume persistence',
    (disposition) => {
      for (const state of ['started', 'reflecting', 'intervention_selected', 'intervention_active'] as const) {
        const snapshot = atState(state).snapshot();
        snapshot.context.safetyDecision = context(disposition).safetyDecision;
        const saved: AlcoholRecoverySession[] = [];
        const store: AlcoholRecoverySessionStore = { save: (value) => { saved.push(value); }, get: () => null };
        expect(() => AlcoholRecoverySessionCoordinator.resume(snapshot, store)).toThrow();
        expect(saved).toEqual([]);
      }
    },
  );

  it.each([
    { state: 'intervention_active' as const },
    { state: 'intervention_selected' as const },
    { state: 'completed' as const },
    { interventionId: 'alcohol-recovery-reset' },
    { interventionVersion: 1 },
    { reflection: {} },
    { state: 'safety_routing' as const },
  ])('rejects contradictory resume fields %j before persistence', (fields) => {
    const saved: AlcoholRecoverySession[] = [];
    const store: AlcoholRecoverySessionStore = { save: (value) => { saved.push(value); }, get: () => null };
    const invalid = { ...start().snapshot(), ...fields };
    expect(() => AlcoholRecoverySessionCoordinator.resume(invalid, store)).toThrow();
    expect(saved).toEqual([]);
  });

  it('rejects unavailable selection without committing', () => {
    const store = new MemoryAlcoholRecoverySessionStore();
    const recovery = atState('reflecting', store);
    const before = recovery.snapshot();
    const invalidLibrary = structuredClone(ALCOHOL_RESCUE_LIBRARY);
    invalidLibrary.contentHash = 'fnv1a32:v1:00000000';
    const emptyLibrary = sealInterventionLibrary({ ...structuredClone(ALCOHOL_RESCUE_LIBRARY), interventions: [] });
    for (const library of [invalidLibrary, emptyLibrary]) {
      expect(() => recovery.selectReset(library, later)).toThrow('alcohol_recovery_reset_unavailable');
      expect(recovery.snapshot()).toEqual(before);
      expect(store.get(before.context.recoverySessionId)).toEqual(before);
    }
  });

  it.each(['fresh', 'resumed'] as const)(
    'rejects a mismatched library version for a %s session without persistence',
    (origin) => {
      const memory = new MemoryAlcoholRecoverySessionStore();
      let saves = 0;
      const store: AlcoholRecoverySessionStore = {
        get: (id) => memory.get(id),
        save(session) {
          saves += 1;
          memory.save(session);
        },
      };
      const started = AlcoholRecoverySessionCoordinator.start({
        context: context(), libraryContentVersion: 1, now,
      }, store);
      started.beginReflection(now);
      const recovery = origin === 'resumed'
        ? AlcoholRecoverySessionCoordinator.resume(started.snapshot(), store)
        : started;
      const before = recovery.snapshot();
      const savesBefore = saves;

      expect(() => recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, later))
        .toThrow('alcohol_recovery_library_version_mismatch');
      expect(recovery.snapshot()).toEqual(before);
      expect(memory.get(before.context.recoverySessionId)).toEqual(before);
      expect(saves).toBe(savesBefore);

      const invalidLibrary = { ...ALCOHOL_RESCUE_LIBRARY, contentHash: 'fnv1a32:v1:00000000' };
      expect(() => recovery.selectReset(invalidLibrary, later))
        .toThrow('alcohol_recovery_library_version_mismatch');
      expect(recovery.snapshot()).toEqual(before);
      expect(memory.get(before.context.recoverySessionId)).toEqual(before);
      expect(saves).toBe(savesBefore);
    },
  );

  it('validates reflection, next action and timestamps without committing', () => {
    const recovery = atState('reflecting');
    const before = recovery.snapshot();
    expect(() => recovery.recordReflection({ triggerTags: [''] }, later)).toThrow();
    expect(() => recovery.recordReflection({ planRelation: 'planned', extra: true } as never, later)).toThrow();
    expect(() => recovery.recordReflection({}, 'invalid')).toThrow();
    expect(recovery.snapshot()).toEqual(before);
    recovery.selectReset(ALCOHOL_RESCUE_LIBRARY, now);
    recovery.beginSelected(now);
    const active = recovery.snapshot();
    expect(() => recovery.complete('change_goal' as AlcoholRecoveryNextAction, later)).toThrow();
    expect(recovery.snapshot()).toEqual(active);
  });

  it('isolates the start context and recorded reflection from caller mutation', () => {
    const inputContext = context();
    const recovery = AlcoholRecoverySessionCoordinator.start({ context: inputContext, libraryContentVersion: 2, now });
    inputContext.safetyDecision.disposition = 'emergency_response';
    recovery.beginReflection(now);
    const reflection = { triggerTags: ['social'] };
    recovery.recordReflection(reflection, later);
    reflection.triggerTags.push('stress');
    expect(recovery.snapshot().reflection).toEqual({ triggerTags: ['social'] });
    expect(recovery.snapshot().context.safetyDecision.disposition).toBe('behavior_change_support_allowed');
  });

  it.each(operations)('does not advance $name on persistence failure', (operation) => {
    let fail = false;
    const memory = new MemoryAlcoholRecoverySessionStore();
    const store: AlcoholRecoverySessionStore = {
      get: (id) => memory.get(id),
      save(session) {
        if (fail) {
          session.context.safetyDecision.disposition = 'emergency_response';
          throw new Error('local_persistence_failed');
        }
        memory.save(session);
      },
    };
    const recovery = atState(operation.allowed[0] as AlcoholRecoverySessionState, store);
    const before = recovery.snapshot();
    fail = true;
    expect(() => operation.run(recovery)).toThrow('local_persistence_failed');
    expect(recovery.snapshot()).toEqual(before);
    expect(memory.get(before.context.recoverySessionId)).toEqual(before);
  });

  it('isolates successful store writes from in-memory state', () => {
    const retained: AlcoholRecoverySession[] = [];
    const store: AlcoholRecoverySessionStore = { save: (session) => { retained.push(session); }, get: () => null };
    const recovery = start(store);
    recovery.beginReflection(now);
    retained.forEach((session) => { session.context.safetyDecision.disposition = 'emergency_response'; });
    expect(recovery.snapshot().context.safetyDecision.disposition).toBe('behavior_change_support_allowed');
  });

  it('propagates start and resume persistence failure', () => {
    const store: AlcoholRecoverySessionStore = { save() { throw new Error('local_persistence_failed'); }, get: () => null };
    expect(() => start(store)).toThrow('local_persistence_failed');
    expect(() => AlcoholRecoverySessionCoordinator.resume(start().snapshot(), store)).toThrow('local_persistence_failed');
  });
});

describe('MemoryAlcoholRecoverySessionStore', () => {
  it('keys by recovery session identity and deep-clones both save and get', () => {
    const store = new MemoryAlcoholRecoverySessionStore();
    const snapshot = start().snapshot();
    const expected = structuredClone(snapshot);
    store.save(snapshot);
    snapshot.context.safetyDecision.disposition = 'emergency_response';
    const retrieved = store.get(expected.context.recoverySessionId)!;
    expect(retrieved).toEqual(expected);
    retrieved.context.safetyDecision.evaluatedEvidenceKeys.push('epilepsy');
    expect(store.get(expected.context.recoverySessionId)).toEqual(expected);
    expect(store.get(expected.context.triggeringUseEventId)).toBeNull();
  });

  it('rejects malformed and non-Alcohol snapshots without replacing saved state', () => {
    const store = new MemoryAlcoholRecoverySessionStore();
    const snapshot = start().snapshot();
    store.save(snapshot);
    expect(() => store.save({ ...snapshot, state: 'resolved' } as never)).toThrow();
    expect(() => store.save({ ...snapshot, rescueSessionId: snapshot.context.recoverySessionId } as never)).toThrow();
    expect(store.get(snapshot.context.recoverySessionId)).toEqual(snapshot);
  });
});
