import { describe, expect, it } from 'vitest';
import type { RescueContext, RescueSession } from '../../../packages/contracts/src/index';
import { MemoryRescueSessionStore, type RescueSessionStore } from '../src/rescue/session-store';
import { RescueSessionCoordinator } from '../src/rescue/session';

const context: RescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-16T05:00:00.000Z',
  goalType: 'smoke_free',
  canContactSupport: true,
};

const selection = { interventionId: 'micro-regulate', version: 1, reasonCodes: ['test'] };

function coordinator() {
  return RescueSessionCoordinator.start({
    rescueSessionId: '550e8400-e29b-41d4-a716-446655440010',
    context,
    libraryContentVersion: 1,
    now: '2026-09-16T05:00:00.000Z',
  });
}

function coordinatorAtReassessment() {
  const rescue = coordinator();
  rescue.stabilize('2026-09-16T05:00:01.000Z');
  rescue.select(selection, '2026-09-16T05:00:02.000Z');
  rescue.beginSelected('2026-09-16T05:00:03.000Z');
  rescue.completeIntervention('2026-09-16T05:01:03.000Z');
  return rescue;
}

describe('RescueSessionCoordinator', () => {
  it('runs the legal resolve path and pins the selected intervention version', () => {
    const rescue = coordinator();
    rescue.stabilize('2026-09-16T05:00:01.000Z');
    rescue.select(selection, '2026-09-16T05:00:02.000Z');
    expect(rescue.snapshot()).toMatchObject({
      state: 'intervention_selected',
      libraryContentVersion: 1,
      interventionId: 'micro-regulate',
      interventionVersion: 1,
    });
    rescue.beginSelected('2026-09-16T05:00:03.000Z');
    rescue.completeIntervention('2026-09-16T05:01:03.000Z');
    expect(rescue.reassess({ wantsAnother: false }, '2026-09-16T05:01:04.000Z').state).toBe('resolved');
  });

  it('supports escalation back into intervention selection', () => {
    const rescue = coordinator();
    rescue.stabilize('2026-09-16T05:00:01.000Z');
    rescue.select(selection, '2026-09-16T05:00:02.000Z');
    rescue.beginSelected('2026-09-16T05:00:03.000Z');
    rescue.completeIntervention('2026-09-16T05:01:03.000Z');
    expect(rescue.reassess({ wantsAnother: true }, '2026-09-16T05:01:04.000Z').state).toBe('escalating');
    rescue.select({ interventionId: 'cbt-reframe', version: 1, reasonCodes: ['escalated'] }, '2026-09-16T05:01:05.000Z');
    expect(rescue.snapshot().state).toBe('intervention_selected');
  });

  it('proves all four specified exits are available directly from reassessment', () => {
    const resolved = coordinatorAtReassessment();
    expect(resolved.reassess({ wantsAnother: false }, '2026-09-16T05:01:04.000Z').state).toBe('resolved');

    const escalated = coordinatorAtReassessment();
    expect(escalated.reassess({ wantsAnother: true }, '2026-09-16T05:01:04.000Z').state).toBe('escalating');

    const supported = coordinatorAtReassessment();
    expect(supported.requestSupport('2026-09-16T05:01:04.000Z').state).toBe('support_offered');

    const recovery = coordinatorAtReassessment();
    expect(recovery.reportUse('2026-09-16T05:01:04.000Z').state).toBe('recovery');
  });

  it('allows user-requested immediate escalation from an active intervention', () => {
    const rescue = coordinator();
    rescue.stabilize('2026-09-16T05:00:01.000Z');
    rescue.select(selection, '2026-09-16T05:00:02.000Z');
    rescue.beginSelected('2026-09-16T05:00:03.000Z');

    expect(rescue.escalate('2026-09-16T05:00:04.000Z').state).toBe('escalating');
  });

  it('persists abandonment as a terminal state without losing pinned intervention metadata', () => {
    const store = new MemoryRescueSessionStore();
    const rescueSessionId = '550e8400-e29b-41d4-a716-446655440012';
    const rescue = RescueSessionCoordinator.start(
      {
        rescueSessionId,
        context,
        libraryContentVersion: 1,
        now: '2026-09-16T05:00:00.000Z',
      },
      store,
    );

    rescue.stabilize('2026-09-16T05:00:01.000Z');
    rescue.select(selection, '2026-09-16T05:00:02.000Z');
    rescue.beginSelected('2026-09-16T05:00:03.000Z');

    expect(rescue.abandon('2026-09-16T05:00:04.000Z')).toMatchObject({
      state: 'abandoned',
      libraryContentVersion: 1,
      interventionId: 'micro-regulate',
      interventionVersion: 1,
    });
    expect(store.get(rescueSessionId)).toMatchObject({
      state: 'abandoned',
      libraryContentVersion: 1,
      interventionId: 'micro-regulate',
      interventionVersion: 1,
    });
    expect(() => rescue.escalate('2026-09-16T05:00:05.000Z')).toThrow('invalid_rescue_transition');
    expect(() => rescue.abandon('2026-09-16T05:00:06.000Z')).toThrow('invalid_rescue_transition');
  });

  it('rejects illegal transitions and supports recovery or support states', () => {
    const rescue = coordinator();
    expect(() => rescue.beginSelected('2026-09-16T05:00:01.000Z')).toThrow('invalid_rescue_transition');

    rescue.stabilize('2026-09-16T05:00:01.000Z');
    expect(rescue.requestSupport('2026-09-16T05:00:02.000Z').state).toBe('support_offered');

    const recovery = coordinator();
    recovery.stabilize('2026-09-16T05:00:01.000Z');
    expect(recovery.reportUse('2026-09-16T05:00:02.000Z').state).toBe('recovery');
  });

  it('does not advance in-memory state when local persistence fails', () => {
    let saves = 0;
    const persisted: { value: RescueSession | null } = { value: null };
    const store: RescueSessionStore = {
      save(session) {
        saves += 1;
        if (saves === 2) throw new Error('local_persistence_failed');
        persisted.value = structuredClone(session);
      },
      get() {
        return persisted.value ? structuredClone(persisted.value) : null;
      },
    };

    const rescue = RescueSessionCoordinator.start(
      {
        rescueSessionId: '550e8400-e29b-41d4-a716-446655440011',
        context,
        libraryContentVersion: 1,
        now: '2026-09-16T05:00:00.000Z',
      },
      store,
    );

    expect(() => rescue.stabilize('2026-09-16T05:00:01.000Z')).toThrow('local_persistence_failed');
    expect(rescue.snapshot().state).toBe('started');
    expect(persisted.value?.state).toBe('started');
  });
});
