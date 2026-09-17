import { describe, expect, it } from 'vitest';
import type {
  AlcoholRescueContext,
  AlcoholRescueLibrary,
  WithdrawalSafetyDecision,
  WithdrawalSafetyDisposition,
} from '../../../packages/contracts/src/index';
import {
  ALCOHOL_RESCUE_LIBRARY,
  selectAlcoholIntervention,
} from '../src/alcohol/rescue';
import { sealInterventionLibrary } from '../src/rescue/library-integrity';

const context: AlcoholRescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-17T07:00:00.000Z',
  goalType: 'reduction',
};

function decision(disposition: WithdrawalSafetyDisposition): WithdrawalSafetyDecision {
  return {
    engineId: 'alcohol_withdrawal_risk',
    ruleSetId: 'withdrawal-safety-v1',
    ruleSetVersion: 1,
    disposition,
    reasonCodes: [],
    evaluatedEvidenceKeys: [],
    unknownCriticalEvidenceKeys: [],
    decidedAt: '2026-09-17T07:00:00.000Z',
  };
}

function library(
  mutate?: (candidate: AlcoholRescueLibrary) => void,
): AlcoholRescueLibrary {
  const candidate = structuredClone(ALCOHOL_RESCUE_LIBRARY);
  mutate?.(candidate);
  return sealInterventionLibrary(candidate);
}

describe('selectAlcoholIntervention safety precedence', () => {
  it.each(['emergency_response', 'urgent_medical_assessment'] as const)(
    'routes %s before inspecting the library',
    (disposition) => {
      expect(
        selectAlcoholIntervention(null, context, decision(disposition)),
      ).toEqual({
        kind: 'safety_routing',
        disposition,
        reasonCodes: [`safety:${disposition}`],
      });
    },
  );

  it('allows only supportive action kinds when medical assessment is advised', () => {
    const candidate = library((value) => {
      for (const item of value.interventions) {
        if (
          ![
            'alcohol-delay',
            'alcohol-substitution',
            'alcohol-cbt-reframe',
          ].includes(item.interventionId)
        ) {
          item.status = 'retired';
        }
      }
    });

    const selected = selectAlcoholIntervention(
      candidate,
      {
        ...context,
        preferredInterventionIds: [
          'alcohol-delay',
          'alcohol-substitution',
        ],
      },
      decision('medical_assessment_advised'),
    );

    expect(selected).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-cbt-reframe',
    });
    expect(selected.reasonCodes).toContain(
      'safety:medical_assessment_advised',
    );

    if (selected.kind !== 'intervention') {
      throw new Error('expected supportive intervention');
    }
    const definition = candidate.interventions.find(
      (item) => item.interventionId === selected.interventionId,
    );
    expect(
      definition?.steps.every((step) =>
        [
          'breathing',
          'urge_surfing',
          'cognitive_reframe',
          'environment_change',
          'human_support',
        ].includes(step.actionKind),
      ),
    ).toBe(true);
  });

  it('returns unavailable when medical assessment leaves no supportive candidate', () => {
    const candidate = library((value) => {
      for (const item of value.interventions) {
        if (
          item.interventionId !== 'alcohol-delay' &&
          item.interventionId !== 'alcohol-substitution'
        ) {
          item.status = 'retired';
        }
      }
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        context,
        decision('medical_assessment_advised'),
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['no_eligible_intervention'],
    });
  });
});

describe('selectAlcoholIntervention deterministic eligibility', () => {
  it('returns the same lowest-burden result for identical input', () => {
    const first = selectAlcoholIntervention(
      ALCOHOL_RESCUE_LIBRARY,
      context,
      decision('behavior_change_support_allowed'),
    );
    const second = selectAlcoholIntervention(
      ALCOHOL_RESCUE_LIBRARY,
      context,
      decision('behavior_change_support_allowed'),
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-micro-regulate',
      version: 1,
    });
  });

  it('applies declined, preferred, and recently-completed ranking in order', () => {
    const safety = decision('behavior_change_support_allowed');

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        {
          ...context,
          preferredInterventionIds: ['alcohol-urge-surf'],
        },
        safety,
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-urge-surf',
    });

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        {
          ...context,
          preferredInterventionIds: ['alcohol-urge-surf'],
          recentlyDeclinedInterventionIds: ['alcohol-urge-surf'],
        },
        safety,
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-micro-regulate',
    });

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        {
          ...context,
          recentlyCompletedInterventionIds: [
            'alcohol-micro-regulate',
          ],
        },
        safety,
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-urge-surf',
    });
  });

  it('excludes disabled and goal-ineligible interventions', () => {
    const candidate = library((value) => {
      const urgeSurf = value.interventions.find(
        (item) => item.interventionId === 'alcohol-urge-surf',
      );
      if (!urgeSurf) throw new Error('missing bundled intervention');
      urgeSurf.eligibility.allowedGoalTypes = ['abstinence'];
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        {
          ...context,
          disabledInterventionIds: ['alcohol-micro-regulate'],
          preferredInterventionIds: ['alcohol-urge-surf'],
        },
        decision('behavior_change_support_allowed'),
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-cbt-reframe',
    });
  });

  it('enforces minimum level and exact-true environment capability', () => {
    const safety = decision('behavior_change_support_allowed');

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        context,
        safety,
        'environment_escape',
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['no_eligible_intervention'],
    });

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        { ...context, canMoveEnvironment: true },
        safety,
        'environment_escape',
      ),
    ).toEqual({
      kind: 'intervention',
      interventionId: 'alcohol-environment-change',
      version: 1,
      reasonCodes: [
        'lowest_burden_eligible',
        'minimum_level:environment_escape',
      ],
    });
  });

  it('requires exact-true support capability', () => {
    const safety = decision('behavior_change_support_allowed');

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        context,
        safety,
        'human_support',
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['no_eligible_intervention'],
    });

    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        { ...context, canContactSupport: true },
        safety,
        'human_support',
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-human-support',
    });
  });

  it('requires exact-true audio capability', () => {
    const candidate = library((value) => {
      const micro = value.interventions.find(
        (item) => item.interventionId === 'alcohol-micro-regulate',
      );
      if (!micro) throw new Error('missing bundled intervention');
      micro.eligibility.requiresAudio = true;
    });
    const safety = decision('behavior_change_support_allowed');

    expect(
      selectAlcoholIntervention(candidate, context, safety),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-urge-surf',
    });
    expect(
      selectAlcoholIntervention(
        candidate,
        { ...context, canUseAudio: true },
        safety,
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-micro-regulate',
    });
  });

  it('uses stable ID ordering after level and burden ties', () => {
    const candidate = library((value) => {
      const micro = value.interventions.find(
        (item) => item.interventionId === 'alcohol-micro-regulate',
      );
      const urge = value.interventions.find(
        (item) => item.interventionId === 'alcohol-urge-surf',
      );
      if (!micro || !urge) throw new Error('missing bundled interventions');
      urge.burden = 'very_low';
      value.interventions.reverse();
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        context,
        decision('behavior_change_support_allowed'),
      ),
    ).toMatchObject({
      kind: 'intervention',
      interventionId: 'alcohol-micro-regulate',
    });
  });
});

describe('selectAlcoholIntervention fail-closed library handling', () => {
  it.each([
    null,
    {
      ...ALCOHOL_RESCUE_LIBRARY,
      contentHash: 'fnv1a32:v1:00000000',
    },
  ])('returns library_unavailable without a fallback', (candidate) => {
    expect(
      selectAlcoholIntervention(
        candidate,
        context,
        decision('behavior_change_support_allowed'),
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['library_unavailable'],
    });
  });

  it('does not fabricate a fallback when no intervention is eligible', () => {
    const candidate = library((value) => {
      for (const item of value.interventions) item.status = 'retired';
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        context,
        decision('behavior_change_support_allowed'),
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['no_eligible_intervention'],
    });
  });
});

describe('selectAlcoholIntervention recovery mode', () => {
  it.each([undefined, 'rescue'] as const)(
    'never selects the recovery reset in %s mode',
    (mode) => {
      const selected = selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        context,
        decision('behavior_change_support_allowed'),
        'micro',
        mode,
      );

      expect(selected).toMatchObject({
        kind: 'intervention',
        interventionId: 'alcohol-micro-regulate',
      });
    },
  );

  it('selects only recovery-eligible content in recovery mode', () => {
    expect(
      selectAlcoholIntervention(
        ALCOHOL_RESCUE_LIBRARY,
        {
          ...context,
          preferredInterventionIds: ['alcohol-micro-regulate'],
        },
        decision('behavior_change_support_allowed'),
        'micro',
        'recovery',
      ),
    ).toEqual({
      kind: 'intervention',
      interventionId: 'alcohol-recovery-reset',
      version: 1,
      reasonCodes: ['lowest_burden_eligible', 'mode:recovery'],
    });
  });

  it('returns no eligible intervention when recovery content is absent', () => {
    const candidate = library((value) => {
      value.interventions = value.interventions.filter(
        (item) => item.recoveryEligible !== true,
      );
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        context,
        decision('behavior_change_support_allowed'),
        'micro',
        'recovery',
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['no_eligible_intervention'],
    });
  });

  it('fails closed when sealed recovery content has a missing localization key', () => {
    const candidate = library((value) => {
      const recovery = value.interventions.find(
        (item) => item.interventionId === 'alcohol-recovery-reset',
      );
      if (!recovery) throw new Error('missing bundled recovery intervention');
      recovery.titleKey = 'alcohol.recovery.reset.title.missing';
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        context,
        decision('behavior_change_support_allowed'),
        'micro',
        'recovery',
      ),
    ).toEqual({
      kind: 'unavailable',
      reasonCodes: ['library_unavailable'],
    });
  });

  it.each(['emergency_response', 'urgent_medical_assessment'] as const)(
    'routes %s before corrupt-library handling in recovery mode',
    (disposition) => {
      const corrupt = {
        ...ALCOHOL_RESCUE_LIBRARY,
        contentHash: 'fnv1a32:v1:00000000',
      };

      expect(
        selectAlcoholIntervention(
          corrupt,
          context,
          decision(disposition),
          'micro',
          'recovery',
        ),
      ).toEqual({
        kind: 'safety_routing',
        disposition,
        reasonCodes: [`safety:${disposition}`],
      });
    },
  );

  it('allows the safe recovery reset, but not delay or substitution, when medical assessment is advised', () => {
    const candidate = library((value) => {
      for (const item of value.interventions) {
        if (
          ![
            'alcohol-recovery-reset',
            'alcohol-delay',
            'alcohol-substitution',
          ].includes(item.interventionId)
        ) {
          item.status = 'retired';
        }
      }
    });

    expect(
      selectAlcoholIntervention(
        candidate,
        {
          ...context,
          preferredInterventionIds: ['alcohol-delay', 'alcohol-substitution'],
        },
        decision('medical_assessment_advised'),
        'micro',
        'recovery',
      ),
    ).toEqual({
      kind: 'intervention',
      interventionId: 'alcohol-recovery-reset',
      version: 1,
      reasonCodes: [
        'lowest_burden_eligible',
        'safety:medical_assessment_advised',
        'mode:recovery',
      ],
    });
  });
});
