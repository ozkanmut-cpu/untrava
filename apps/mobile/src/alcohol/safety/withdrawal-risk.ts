import {
  WithdrawalRiskEvidenceSchema,
  WithdrawalSafetyDecisionSchema,
  type WithdrawalEvidenceKey,
  type WithdrawalRiskEvidence,
  type WithdrawalRiskPolicy,
  type WithdrawalSafetyDecision,
  type WithdrawalSafetyDisposition,
  type WithdrawalSafetyReasonCode,
} from '../../../../../packages/contracts/src/index';
import {
  ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
  hasValidWithdrawalRiskPolicyIntegrity,
} from './policy';

const reasonByEvidenceKey: Record<WithdrawalEvidenceKey, WithdrawalSafetyReasonCode> = {
  currentSeizure: 'emergency.current_seizure',
  severeConfusionOrDisorientation: 'emergency.severe_confusion',
  markedAutonomicSymptoms: 'urgent.marked_autonomic_symptoms',
  significantPerceptualDisturbance: 'urgent.significant_perceptual_disturbance',
  withdrawalSymptomsAfterReduction: 'risk.withdrawal_symptoms_after_reduction',
  previousWithdrawalSeizure: 'history.previous_withdrawal_seizure',
  previousWithdrawalDelirium: 'history.previous_withdrawal_delirium',
  previousSevereWithdrawal: 'history.previous_severe_withdrawal',
  repeatedWithdrawalEpisodes: 'history.repeated_withdrawal',
  priorMedicallyAssistedWithdrawalComplication: 'history.prior_assisted_withdrawal_complication',
  longDurationHeavyRegularUse: 'risk.heavy_regular_use_pattern',
  morningDrinkingOrReliefDrinking: 'risk.morning_or_relief_drinking',
  priorWithdrawalSymptomsWhenCuttingDownOrStopping: 'risk.prior_symptoms_on_reduction',
  sedativeHypnoticPhysiologicalDependence: 'risk.sedative_hypnotic_dependence',
  epilepsy: 'risk.epilepsy',
  significantUnstableMedicalIllness: 'risk.unstable_medical_illness',
  significantActivePsychiatricIllnessOrCognitiveImpairment: 'risk.active_psychiatric_or_cognitive_concern',
};

function orderedUnique(groups: readonly (readonly WithdrawalEvidenceKey[])[]): WithdrawalEvidenceKey[] {
  const seen = new Set<WithdrawalEvidenceKey>();
  const result: WithdrawalEvidenceKey[] = [];
  for (const group of groups) {
    for (const key of group) {
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

function presentKeys(
  evidence: WithdrawalRiskEvidence,
  keys: readonly WithdrawalEvidenceKey[],
): WithdrawalEvidenceKey[] {
  return keys.filter((key) => evidence[key].state === 'present');
}

function unknownKeys(
  evidence: WithdrawalRiskEvidence,
  keys: readonly WithdrawalEvidenceKey[],
): WithdrawalEvidenceKey[] {
  return keys.filter((key) => evidence[key].state === 'unknown');
}

function decision(
  policy: WithdrawalRiskPolicy,
  disposition: WithdrawalSafetyDisposition,
  reasonCodes: WithdrawalSafetyReasonCode[],
  evaluatedEvidenceKeys: WithdrawalEvidenceKey[],
  unknownCriticalEvidenceKeys: WithdrawalEvidenceKey[],
  decidedAt: string,
): WithdrawalSafetyDecision {
  return WithdrawalSafetyDecisionSchema.parse({
    engineId: 'alcohol_withdrawal_risk',
    ruleSetId: policy.ruleSetId,
    ruleSetVersion: policy.ruleSetVersion,
    disposition,
    reasonCodes,
    evaluatedEvidenceKeys,
    unknownCriticalEvidenceKeys,
    decidedAt,
  });
}

export function evaluateWithdrawalRisk(
  evidenceCandidate: unknown,
  decidedAt: string,
  policyCandidate: unknown = ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
): WithdrawalSafetyDecision {
  const evidence = WithdrawalRiskEvidenceSchema.parse(evidenceCandidate);
  if (!hasValidWithdrawalRiskPolicyIntegrity(policyCandidate)) {
    throw new Error('Invalid alcohol withdrawal risk policy');
  }
  const policy = policyCandidate;
  const evaluatedEvidenceKeys = orderedUnique([
    policy.emergencyEvidenceKeys,
    policy.urgentEvidenceKeys,
    policy.assessmentEvidenceKeys,
    policy.criticalEvidenceKeys,
  ]);

  const emergencyKeys = presentKeys(evidence, policy.emergencyEvidenceKeys);
  if (emergencyKeys.length > 0) {
    return decision(
      policy,
      'emergency_response',
      emergencyKeys.map((key) => reasonByEvidenceKey[key]),
      evaluatedEvidenceKeys,
      [],
      decidedAt,
    );
  }

  const urgentKeys = presentKeys(evidence, policy.urgentEvidenceKeys);
  if (urgentKeys.length > 0) {
    return decision(
      policy,
      'urgent_medical_assessment',
      urgentKeys.map((key) => reasonByEvidenceKey[key]),
      evaluatedEvidenceKeys,
      [],
      decidedAt,
    );
  }

  if (evidence.changeIntent === 'observe') {
    return decision(
      policy,
      'behavior_change_support_allowed',
      [],
      evaluatedEvidenceKeys,
      [],
      decidedAt,
    );
  }

  const assessmentKeys = presentKeys(evidence, policy.assessmentEvidenceKeys);
  if (assessmentKeys.length > 0) {
    return decision(
      policy,
      'medical_assessment_advised',
      assessmentKeys.map((key) => reasonByEvidenceKey[key]),
      evaluatedEvidenceKeys,
      [],
      decidedAt,
    );
  }

  const unknownCriticalEvidenceKeys = unknownKeys(evidence, policy.criticalEvidenceKeys);
  if (unknownCriticalEvidenceKeys.length > 0) {
    return decision(
      policy,
      'medical_assessment_advised',
      ['insufficient.required_evidence_unknown'],
      evaluatedEvidenceKeys,
      unknownCriticalEvidenceKeys,
      decidedAt,
    );
  }

  return decision(
    policy,
    'behavior_change_support_allowed',
    [],
    evaluatedEvidenceKeys,
    [],
    decidedAt,
  );
}
