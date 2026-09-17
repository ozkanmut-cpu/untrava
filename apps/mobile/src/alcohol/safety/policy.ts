import {
  WithdrawalRiskPolicySchema,
  type WithdrawalEvidenceKey,
  type WithdrawalRiskPolicy,
} from '../../../../../packages/contracts/src/index';

const emergencyEvidenceKeys = [
  'currentSeizure',
  'severeConfusionOrDisorientation',
] as const satisfies readonly WithdrawalEvidenceKey[];

const urgentEvidenceKeys = [
  'markedAutonomicSymptoms',
  'significantPerceptualDisturbance',
] as const satisfies readonly WithdrawalEvidenceKey[];

const assessmentEvidenceKeys = [
  'withdrawalSymptomsAfterReduction',
  'previousWithdrawalSeizure',
  'previousWithdrawalDelirium',
  'previousSevereWithdrawal',
  'repeatedWithdrawalEpisodes',
  'priorMedicallyAssistedWithdrawalComplication',
  'longDurationHeavyRegularUse',
  'morningDrinkingOrReliefDrinking',
  'priorWithdrawalSymptomsWhenCuttingDownOrStopping',
  'sedativeHypnoticPhysiologicalDependence',
  'epilepsy',
  'significantUnstableMedicalIllness',
  'significantActivePsychiatricIllnessOrCognitiveImpairment',
] as const satisfies readonly WithdrawalEvidenceKey[];

const criticalEvidenceKeys = [
  'currentSeizure',
  'severeConfusionOrDisorientation',
  'withdrawalSymptomsAfterReduction',
  'previousWithdrawalSeizure',
  'previousWithdrawalDelirium',
  'longDurationHeavyRegularUse',
  'morningDrinkingOrReliefDrinking',
  'priorWithdrawalSymptomsWhenCuttingDownOrStopping',
  'sedativeHypnoticPhysiologicalDependence',
  'epilepsy',
  'significantUnstableMedicalIllness',
  'significantActivePsychiatricIllnessOrCognitiveImpairment',
] as const satisfies readonly WithdrawalEvidenceKey[];

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function checksum(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:v1:${hash.toString(16).padStart(8, '0')}`;
}

const policyContent = {
  engineId: 'alcohol_withdrawal_risk' as const,
  ruleSetId: 'alcohol_withdrawal_risk_v1',
  ruleSetVersion: 1,
  emergencyEvidenceKeys: [...emergencyEvidenceKeys],
  urgentEvidenceKeys: [...urgentEvidenceKeys],
  assessmentEvidenceKeys: [...assessmentEvidenceKeys],
  criticalEvidenceKeys: [...criticalEvidenceKeys],
};

export const ALCOHOL_WITHDRAWAL_RISK_POLICY_V1 = WithdrawalRiskPolicySchema.parse({
  ...policyContent,
  contentHash: checksum(policyContent),
});

export function hasValidWithdrawalRiskPolicyIntegrity(candidate: unknown): candidate is WithdrawalRiskPolicy {
  const parsed = WithdrawalRiskPolicySchema.safeParse(candidate);
  if (!parsed.success) return false;
  const { contentHash, ...content } = parsed.data;
  return contentHash === checksum(content);
}
