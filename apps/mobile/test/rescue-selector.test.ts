import { describe, expect, it } from 'vitest';
import type { RescueContext, RescueLibrary } from '../../../packages/contracts/src/index';
import { createBundledRescueLibrary } from '../src/rescue/library';
import { selectIntervention } from '../src/rescue/selector';

const context: RescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-16T05:00:00.000Z',
  goalType: 'smoke_free',
};

const library = (): RescueLibrary => createBundledRescueLibrary();

describe('selectIntervention', () => {
  it('is deterministic and excludes retired or context-ineligible interventions', () => {
    const candidate = library();
    const retired = candidate.interventions.find((item) => item.interventionId === 'micro-regulate');
    if (!retired) throw new Error('missing bundled intervention');
    retired.status = 'retired';

    const selected = selectIntervention(candidate, {
      ...context,
      canMoveEnvironment: false,
      canContactSupport: false,
    });

    expect(selected?.interventionId).not.toBe('micro-regulate');
    expect(candidate.interventions.find((item) => item.interventionId === selected?.interventionId)?.level).toBe('micro');
    expect(selectIntervention(candidate, context)).toEqual(selectIntervention(candidate, context));
  });

  it('prefers explicit preferences, then down-ranks declined items', () => {
    expect(selectIntervention(library(), { ...context, preferredInterventionIds: ['urge-surf'] })?.interventionId).toBe('urge-surf');
    expect(
      selectIntervention(library(), {
        ...context,
        preferredInterventionIds: ['urge-surf'],
        recentlyDeclinedInterventionIds: ['urge-surf'],
      })?.interventionId,
    ).not.toBe('urge-surf');
  });

  it('filters environment and support interventions when their capabilities are unavailable', () => {
    const candidate = library();
    const environmentSelection = selectIntervention(candidate, { ...context, canMoveEnvironment: false }, 'environment_escape');
    const environmentDefinition = candidate.interventions.find(
      (item) => item.interventionId === environmentSelection?.interventionId,
    );
    expect(environmentDefinition?.level).not.toBe('environment_escape');
    expect(selectIntervention(candidate, { ...context, canContactSupport: false }, 'human_support')).toBeNull();
  });

  it('never selects an intervention outside the current goal type', () => {
    const candidate = library();
    const micro = candidate.interventions.find((item) => item.interventionId === 'micro-regulate');
    if (!micro) throw new Error('missing bundled intervention');
    micro.eligibility.allowedGoalTypes = ['nicotine_free'];

    expect(selectIntervention(candidate, context)?.interventionId).not.toBe('micro-regulate');
  });

  it('requires recovery-eligible interventions in recovery mode', () => {
    const selected = selectIntervention(library(), context, 'micro', 'recovery');
    expect(selected?.interventionId).toBe('recovery-reset');
  });
});
