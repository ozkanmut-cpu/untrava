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

const validDecision = {
  engineId: 'alcohol_withdrawal_risk',
  ruleSetId: 'alcohol_withdrawal_risk_v1',
  ruleSetVersion: 1,
  disposition: 'medical_assessment_advised',
  reasonCodes: ['history.previous_withdrawal_seizure'],
  evaluatedEvidenceKeys: ['previousWithdrawalSeizure'],
  unknownCriticalEvidenceKeys: [],
  decidedAt: '2026-09-17T02:30:00.000Z',
} as const;

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
    expect(safetyContracts.WithdrawalSafetyDecisionSchema.parse(validDecision)).toBeDefined();
  });

  it('rejects taper or drinking-schedule instructions in a safety decision', () => {
    expect(safetyContracts.WithdrawalSafetyDecisionSchema).toBeDefined();
    if (!safetyContracts.WithdrawalSafetyDecisionSchema) throw new Error('WithdrawalSafetyDecisionSchema must be exported');

    expect(() =>
      safetyContracts.WithdrawalSafetyDecisionSchema?.parse({
        ...validDecision,
        taperPlan: [{ day: 1, drinks: 6 }],
      }),
    ).toThrow();

    expect(() =>
      safetyContracts.WithdrawalSafetyDecisionSchema?.parse({
        ...validDecision,
        drinkSchedule: [{ at: '18:00', amount: 2 }],
      }),
    ).toThrow();
  });

  it('rejects medication, dose and prescription-change instructions in a safety decision', () => {
    expect(safetyContracts.WithdrawalSafetyDecisionSchema).toBeDefined();
    if (!safetyContracts.WithdrawalSafetyDecisionSchema) throw new Error('WithdrawalSafetyDecisionSchema must be exported');

    for (const forbiddenField of [
      ['medicationName', 'example'],
      ['medicationDose', 10],
      ['doseAmount', 10],
      ['doseUnit', 'mg'],
      ['doseSchedule', ['08:00']],
      ['prescriptionChange', 'stop'],
      ['thiamineDose', 100],
      ['benzodiazepineDose', 5],
    ] as const) {
      expect(() =>
        safetyContracts.WithdrawalSafetyDecisionSchema?.parse({
          ...validDecision,
          [forbiddenField[0]]: forbiddenField[1],
        }),
      ).toThrow();
    }
  });
});
