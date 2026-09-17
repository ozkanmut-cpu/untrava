import { z } from 'zod';
import { EventIdSchema } from '../ids';

export const WithdrawalEvidenceStateSchema = z.enum(['present', 'absent', 'unknown']);
export const WithdrawalEvidenceSourceSchema = z.enum(['self_report', 'recorded_history', 'derived_local']);

export const WithdrawalEvidenceItemSchema = z
  .object({
    state: WithdrawalEvidenceStateSchema,
    source: WithdrawalEvidenceSourceSchema,
    observedAt: z.string().datetime().optional(),
    evidenceEventIds: z.array(EventIdSchema).min(1).optional(),
  })
  .strict();

export const AlcoholChangeIntentSchema = z.enum(['observe', 'reduce', 'abstain', 'unknown']);

export const WithdrawalEvidenceKeySchema = z.enum([
  'previousWithdrawalSeizure',
  'previousWithdrawalDelirium',
  'previousSevereWithdrawal',
  'repeatedWithdrawalEpisodes',
  'priorMedicallyAssistedWithdrawalComplication',
  'currentSeizure',
  'severeConfusionOrDisorientation',
  'withdrawalSymptomsAfterReduction',
  'markedAutonomicSymptoms',
  'significantPerceptualDisturbance',
  'longDurationHeavyRegularUse',
  'morningDrinkingOrReliefDrinking',
  'priorWithdrawalSymptomsWhenCuttingDownOrStopping',
  'sedativeHypnoticPhysiologicalDependence',
  'epilepsy',
  'significantUnstableMedicalIllness',
  'significantActivePsychiatricIllnessOrCognitiveImpairment',
]);

export const WithdrawalRiskEvidenceSchema = z
  .object({
    changeIntent: AlcoholChangeIntentSchema,
    previousWithdrawalSeizure: WithdrawalEvidenceItemSchema,
    previousWithdrawalDelirium: WithdrawalEvidenceItemSchema,
    previousSevereWithdrawal: WithdrawalEvidenceItemSchema,
    repeatedWithdrawalEpisodes: WithdrawalEvidenceItemSchema,
    priorMedicallyAssistedWithdrawalComplication: WithdrawalEvidenceItemSchema,
    currentSeizure: WithdrawalEvidenceItemSchema,
    severeConfusionOrDisorientation: WithdrawalEvidenceItemSchema,
    withdrawalSymptomsAfterReduction: WithdrawalEvidenceItemSchema,
    markedAutonomicSymptoms: WithdrawalEvidenceItemSchema,
    significantPerceptualDisturbance: WithdrawalEvidenceItemSchema,
    longDurationHeavyRegularUse: WithdrawalEvidenceItemSchema,
    morningDrinkingOrReliefDrinking: WithdrawalEvidenceItemSchema,
    priorWithdrawalSymptomsWhenCuttingDownOrStopping: WithdrawalEvidenceItemSchema,
    sedativeHypnoticPhysiologicalDependence: WithdrawalEvidenceItemSchema,
    epilepsy: WithdrawalEvidenceItemSchema,
    significantUnstableMedicalIllness: WithdrawalEvidenceItemSchema,
    significantActivePsychiatricIllnessOrCognitiveImpairment: WithdrawalEvidenceItemSchema,
  })
  .strict();

export const WithdrawalSafetyDispositionSchema = z.enum([
  'behavior_change_support_allowed',
  'medical_assessment_advised',
  'urgent_medical_assessment',
  'emergency_response',
]);

export const WithdrawalSafetyReasonCodeSchema = z.enum([
  'emergency.current_seizure',
  'emergency.severe_confusion',
  'urgent.marked_autonomic_symptoms',
  'urgent.significant_perceptual_disturbance',
  'history.previous_withdrawal_seizure',
  'history.previous_withdrawal_delirium',
  'history.repeated_withdrawal',
  'history.previous_severe_withdrawal',
  'history.prior_assisted_withdrawal_complication',
  'risk.withdrawal_symptoms_after_reduction',
  'risk.sedative_hypnotic_dependence',
  'risk.epilepsy',
  'risk.unstable_medical_illness',
  'risk.active_psychiatric_or_cognitive_concern',
  'risk.heavy_regular_use_pattern',
  'risk.morning_or_relief_drinking',
  'risk.prior_symptoms_on_reduction',
  'insufficient.required_evidence_unknown',
  'system.invalid_rule_set',
  'system.invalid_evidence',
]);

export const WithdrawalRiskPolicySchema = z
  .object({
    engineId: z.literal('alcohol_withdrawal_risk'),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    emergencyEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    urgentEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    assessmentEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    criticalEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    contentHash: z.string().regex(/^fnv1a32:v1:[0-9a-f]{8}$/),
  })
  .strict();

export const WithdrawalSafetyDecisionSchema = z
  .object({
    engineId: z.literal('alcohol_withdrawal_risk'),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    disposition: WithdrawalSafetyDispositionSchema,
    reasonCodes: z.array(WithdrawalSafetyReasonCodeSchema),
    evaluatedEvidenceKeys: z.array(WithdrawalEvidenceKeySchema),
    unknownCriticalEvidenceKeys: z.array(WithdrawalEvidenceKeySchema),
    decidedAt: z.string().datetime(),
  })
  .strict();

export type WithdrawalEvidenceState = z.infer<typeof WithdrawalEvidenceStateSchema>;
export type WithdrawalEvidenceItem = z.infer<typeof WithdrawalEvidenceItemSchema>;
export type AlcoholChangeIntent = z.infer<typeof AlcoholChangeIntentSchema>;
export type WithdrawalEvidenceKey = z.infer<typeof WithdrawalEvidenceKeySchema>;
export type WithdrawalRiskEvidence = z.infer<typeof WithdrawalRiskEvidenceSchema>;
export type WithdrawalSafetyDisposition = z.infer<typeof WithdrawalSafetyDispositionSchema>;
export type WithdrawalSafetyReasonCode = z.infer<typeof WithdrawalSafetyReasonCodeSchema>;
export type WithdrawalRiskPolicy = z.infer<typeof WithdrawalRiskPolicySchema>;
export type WithdrawalSafetyDecision = z.infer<typeof WithdrawalSafetyDecisionSchema>;
