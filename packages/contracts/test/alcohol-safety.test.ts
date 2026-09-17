import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

interface Schema<T = unknown> {
  parse(value: unknown): T;
}

interface EnumSchema {
  options: readonly string[];
}

const safetyContracts = contracts as unknown as {
  WithdrawalRiskEvidenceSchema?: Schema;
  WithdrawalSafetyDispositionSchema?: EnumSchema;
  WithdrawalSafetyDecisionSchema?: Schema;
};

const item = (state: 'present' | 'absent' | 'unknown') => ({
  state,
  source: 'self_report' as const,
});

const completeEvidence = {
  changeIntent: 'abstain' as const,
  previousWithdrawalSeizure: item('absent'),
  previousWithdrawalDelirium: item('absent'),
  previousSevereWithdrawal: item('absent'),
  repeatedWithdrawalEpisodes: item('absent'),
  priorMedicallyAssistedWithdrawalComplication: item('absent'),
  currentSeizure: item('absent'),
  severeConfusionOrDisorientation: item('absent'),
  withdrawalSymptomsAfterReduction: item('absent'),
  markedAutonomicSymptoms: item('absent'),
  significantPerceptualDisturbance: item('absent'),
  longDurationHeavyRegularUse: item('absent'),
  morningDrinkingOrReliefDrinking: item('absent'),
  priorWithdrawalSymptomsWhenCuttingDownOrStopping: item('absent'),
  sedativeHypnoticPhysiologicalDependence: item('absent'),
  epilepsy: item('absent'),
  significantUnstableMedicalIllness: item('absent'),
  significantActivePsychiatricIllnessOrCognitiveImpairment: item('absent'),
};

describe('Alcohol withdrawal safety contracts', () => {
  it('exports and accepts tri-state structured withdrawal evidence', () => {
    expect(safetyContracts.WithdrawalRiskEvidenceSchema).toBeDefined();
    if (!safetyContracts.WithdrawalRiskEvidenceSchema) throw new Error('WithdrawalRiskEvidenceSchema must be exported');
    expect(safetyContracts.WithdrawalRiskEvidenceSchema.parse(completeEvidence)).toEqual(completeEvidence);
  });

  it('rejects missing evidence fields instead of treating missing as absent', () => {
    expect(safetyContracts.WithdrawalRiskEvidenceSchema).toBeDefined();
    if (!safetyContracts.WithdrawalRiskEvidenceSchema) throw new Error('WithdrawalRiskEvidenceSchema must be exported');
    const incomplete: Partial<typeof completeEvidence> = { ...completeEvidence };
    delete incomplete.previousWithdrawalSeizure;
    expect(() => safetyContracts.WithdrawalRiskEvidenceSchema?.parse(incomplete)).toThrow();
  });

  it('accepts only the four frozen product routing dispositions', () => {
    expect(safetyContracts.WithdrawalSafetyDispositionSchema).toBeDefined();
    if (!safetyContracts.WithdrawalSafetyDispositionSchema) {
      throw new Error('WithdrawalSafetyDispositionSchema must be exported');
    }
    expect(safetyContracts.WithdrawalSafetyDispositionSchema.options).toEqual([
      'behavior_change_support_allowed',
      'medical_assessment_advised',
      'urgent_medical_assessment',
      'emergency_response',
    ]);
  });

  it('validates an auditable decision trace', () => {
    expect(safetyContracts.WithdrawalSafetyDecisionSchema).toBeDefined();
    if (!safetyContracts.WithdrawalSafetyDecisionSchema) throw new Error('WithdrawalSafetyDecisionSchema must be exported');
    expect(
      safetyContracts.WithdrawalSafetyDecisionSchema.parse({
        engineId: 'alcohol_withdrawal_risk',
        ruleSetId: 'alcohol_withdrawal_risk_v1',
        ruleSetVersion: 1,
        disposition: 'medical_assessment_advised',
        reasonCodes: ['history.previous_withdrawal_seizure'],
        evaluatedEvidenceKeys: ['previousWithdrawalSeizure'],
        unknownCriticalEvidenceKeys: [],
        decidedAt: '2026-09-17T02:30:00.000Z',
      }),
    ).toBeDefined();
  });
});
