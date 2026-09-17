import { describe, expect, it } from 'vitest';
import { ALCOHOL_WITHDRAWAL_RISK_POLICY_V1 } from '../src/alcohol/safety/policy';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true },
    ): Record<string, T>;
  }
}

type ChangeIntent = 'observe' | 'reduce' | 'abstain' | 'unknown';
type EvidenceState = 'present' | 'absent' | 'unknown';

interface WithdrawalSafetyDecision {
  disposition: 'behavior_change_support_allowed' | 'medical_assessment_advised' | 'urgent_medical_assessment' | 'emergency_response';
  reasonCodes: string[];
  unknownCriticalEvidenceKeys: string[];
}

interface SafetyModule {
  evaluateWithdrawalRisk?: (
    evidenceCandidate: unknown,
    decidedAt: string,
    policyCandidate?: unknown,
  ) => WithdrawalSafetyDecision;
}

function loadSafetyModule(): SafetyModule {
  const modules = import.meta.glob<SafetyModule>('../src/alcohol/safety/index.ts', { eager: true });
  expect(Object.keys(modules)).toHaveLength(1);
  const module = Object.values(modules)[0];
  if (!module) throw new Error('Alcohol safety module must exist');
  return module;
}

function evaluator() {
  const evaluate = loadSafetyModule().evaluateWithdrawalRisk;
  expect(evaluate).toBeDefined();
  if (!evaluate) throw new Error('evaluateWithdrawalRisk must be exported');
  return evaluate;
}

const state = (value: EvidenceState) => ({
  state: value,
  source: 'self_report' as const,
});

const baseEvidence = (changeIntent: ChangeIntent = 'abstain') => ({
  changeIntent,
  previousWithdrawalSeizure: state('absent'),
  previousWithdrawalDelirium: state('absent'),
  previousSevereWithdrawal: state('absent'),
  repeatedWithdrawalEpisodes: state('absent'),
  priorMedicallyAssistedWithdrawalComplication: state('absent'),
  currentSeizure: state('absent'),
  severeConfusionOrDisorientation: state('absent'),
  withdrawalSymptomsAfterReduction: state('absent'),
  markedAutonomicSymptoms: state('absent'),
  significantPerceptualDisturbance: state('absent'),
  longDurationHeavyRegularUse: state('absent'),
  morningDrinkingOrReliefDrinking: state('absent'),
  priorWithdrawalSymptomsWhenCuttingDownOrStopping: state('absent'),
  sedativeHypnoticPhysiologicalDependence: state('absent'),
  epilepsy: state('absent'),
  significantUnstableMedicalIllness: state('absent'),
  significantActivePsychiatricIllnessOrCognitiveImpairment: state('absent'),
});

const decidedAt = '2026-09-17T02:45:00.000Z';

describe('evaluateWithdrawalRisk', () => {
  it('routes a current seizure to emergency regardless of intent or lower-level evidence', () => {
    const evidence = {
      ...baseEvidence('observe'),
      currentSeizure: state('present'),
      previousWithdrawalSeizure: state('present'),
    };
    const decision = evaluator()(evidence, decidedAt);
    expect(decision.disposition).toBe('emergency_response');
    expect(decision.reasonCodes).toContain('emergency.current_seizure');
  });

  it('routes marked autonomic symptoms to urgent assessment', () => {
    const decision = evaluator()(
      { ...baseEvidence('observe'), markedAutonomicSymptoms: state('present') },
      decidedAt,
    );
    expect(decision.disposition).toBe('urgent_medical_assessment');
    expect(decision.reasonCodes).toEqual(['urgent.marked_autonomic_symptoms']);
  });

  it('requires medical assessment for severe withdrawal history before abstinence', () => {
    const decision = evaluator()(
      { ...baseEvidence('abstain'), previousWithdrawalSeizure: state('present') },
      decidedAt,
    );
    expect(decision.disposition).toBe('medical_assessment_advised');
    expect(decision.reasonCodes).toEqual(['history.previous_withdrawal_seizure']);
  });

  it('does not block factual observation from historical risk alone', () => {
    const decision = evaluator()(
      { ...baseEvidence('observe'), previousWithdrawalSeizure: state('present') },
      decidedAt,
    );
    expect(decision.disposition).toBe('behavior_change_support_allowed');
  });

  it('fails closed on critical unknown evidence for reduction', () => {
    const decision = evaluator()(
      { ...baseEvidence('reduce'), previousWithdrawalSeizure: state('unknown') },
      decidedAt,
    );
    expect(decision.disposition).toBe('medical_assessment_advised');
    expect(decision.reasonCodes).toContain('insufficient.required_evidence_unknown');
    expect(decision.unknownCriticalEvidenceKeys).toEqual(['previousWithdrawalSeizure']);
  });

  it('allows ordinary support only with no higher-precedence match and complete required evidence', () => {
    expect(evaluator()(baseEvidence('abstain'), decidedAt).disposition).toBe(
      'behavior_change_support_allowed',
    );
  });

  it('is deterministic for the same evidence, policy and timestamp', () => {
    const evidence = baseEvidence('abstain');
    expect(evaluator()(evidence, decidedAt)).toEqual(evaluator()(evidence, decidedAt));
  });

  it('fails closed when the supplied policy is tampered', () => {
    const tamperedPolicy = {
      ...ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
      assessmentEvidenceKeys: ['longDurationHeavyRegularUse'],
    };
    const decision = evaluator()(baseEvidence('abstain'), decidedAt, tamperedPolicy);
    expect(decision.disposition).toBe('medical_assessment_advised');
    expect(decision.reasonCodes).toEqual(['system.invalid_rule_set']);
  });

  it('preserves hard emergency routing even when the supplied policy is invalid', () => {
    const tamperedPolicy = {
      ...ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
      urgentEvidenceKeys: ['previousWithdrawalSeizure'],
    };
    const decision = evaluator()(
      { ...baseEvidence('observe'), currentSeizure: state('present') },
      decidedAt,
      tamperedPolicy,
    );
    expect(decision.disposition).toBe('emergency_response');
    expect(decision.reasonCodes).toEqual(['emergency.current_seizure']);
  });

  it('preserves hard urgent routing when unrelated evidence is malformed', () => {
    const malformed = {
      ...baseEvidence('observe'),
      previousWithdrawalSeizure: { state: 'not-a-state', source: 'self_report' },
      markedAutonomicSymptoms: state('present'),
    };
    const decision = evaluator()(malformed, decidedAt);
    expect(decision.disposition).toBe('urgent_medical_assessment');
    expect(decision.reasonCodes).toEqual(['urgent.marked_autonomic_symptoms']);
  });

  it('fails closed when evidence is malformed and has no hard emergency or urgent signal', () => {
    const decision = evaluator()(
      { ...baseEvidence('abstain'), epilepsy: null },
      decidedAt,
    );
    expect(decision.disposition).toBe('medical_assessment_advised');
    expect(decision.reasonCodes).toEqual(['system.invalid_evidence']);
  });

  it('emits only routing and audit fields across every disposition', () => {
    const decisions = [
      evaluator()({ ...baseEvidence('observe'), currentSeizure: state('present') }, decidedAt),
      evaluator()({ ...baseEvidence('observe'), markedAutonomicSymptoms: state('present') }, decidedAt),
      evaluator()({ ...baseEvidence('abstain'), previousWithdrawalSeizure: state('present') }, decidedAt),
      evaluator()(baseEvidence('abstain'), decidedAt),
    ] as Array<WithdrawalSafetyDecision & Record<string, unknown>>;

    expect(decisions.map((decision) => decision.disposition)).toEqual([
      'emergency_response',
      'urgent_medical_assessment',
      'medical_assessment_advised',
      'behavior_change_support_allowed',
    ]);

    const allowedKeys = [
      'decidedAt',
      'disposition',
      'engineId',
      'evaluatedEvidenceKeys',
      'reasonCodes',
      'ruleSetId',
      'ruleSetVersion',
      'unknownCriticalEvidenceKeys',
    ];
    const forbiddenInstructionTokens = [
      'taper',
      'drinkschedule',
      'medication',
      'dose',
      'prescription',
      'thiamine',
      'benzodiazepinedose',
    ];

    for (const decision of decisions) {
      expect(Object.keys(decision).sort()).toEqual(allowedKeys);
      const serialized = JSON.stringify(decision).toLowerCase();
      for (const token of forbiddenInstructionTokens) {
        expect(serialized).not.toContain(token);
      }
    }
  });
});
