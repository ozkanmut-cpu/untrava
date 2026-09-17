import { z } from 'zod';
import { EventIdSchema } from '../ids';

const hasDuplicates = (values: readonly string[]) => new Set(values).size !== values.length;

export const AlcoholDerivedConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const AlcoholDerivedMissingnessSchema = z.enum(['none', 'partial', 'substantial']);

export const AlcoholDerivedEvidenceProvenanceSchema = z
  .object({
    engineId: z.string().min(1),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    evidenceEventIds: z.array(EventIdSchema).min(1),
    confidence: AlcoholDerivedConfidenceSchema,
    missingness: AlcoholDerivedMissingnessSchema,
    missingInputKeys: z.array(z.string().min(1)),
    computedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.windowStart) > Date.parse(value.windowEnd)) {
      context.addIssue({
        code: 'custom',
        path: ['windowEnd'],
        message: 'windowEnd must be on or after windowStart',
      });
    }

    if (hasDuplicates(value.evidenceEventIds)) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceEventIds'],
        message: 'evidenceEventIds must be unique',
      });
    }

    if (hasDuplicates(value.missingInputKeys)) {
      context.addIssue({
        code: 'custom',
        path: ['missingInputKeys'],
        message: 'missingInputKeys must be unique',
      });
    }

    if (value.missingness === 'none' && value.missingInputKeys.length !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['missingInputKeys'],
        message: 'missingness=none requires no missing input keys',
      });
    }

    if (value.missingness !== 'none' && value.missingInputKeys.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['missingInputKeys'],
        message: 'partial/substantial missingness requires at least one missing input key',
      });
    }
  });

export const AlcoholPatternInsightTypeSchema = z.enum([
  'time_of_day_concentration',
  'day_of_week_concentration',
  'planned_vs_unplanned_trend',
  'plan_exceedance_pattern',
  'social_context_association',
  'first_drink_time_trend',
  'trigger_association',
  'alcohol_free_day_pattern',
  'rescue_outcome_association',
  'total_ethanol_trend',
]);

export const AlcoholPatternDirectionSchema = z.enum([
  'increasing',
  'decreasing',
  'stable',
  'concentrated',
  'associated',
]);

export const AlcoholPatternStrengthSchema = z.enum(['weak', 'moderate', 'strong']);

export const AlcoholPatternInsightSchema = z
  .object({
    schemaVersion: z.literal(1),
    moduleId: z.literal('alcohol'),
    insightId: z.string().min(1),
    insightType: AlcoholPatternInsightTypeSchema,
    direction: AlcoholPatternDirectionSchema,
    strength: AlcoholPatternStrengthSchema,
    provenance: AlcoholDerivedEvidenceProvenanceSchema,
  })
  .strict();

export const AlcoholNearTermRiskTargetSchema = z.enum([
  'unplanned_use',
  'plan_exceedance',
  'rescue_need',
]);

export const AlcoholNearTermRiskHorizonSchema = z.enum([
  'next_24_hours',
  'current_planning_day',
]);

export const AlcoholNearTermRiskBandSchema = z.enum([
  'unknown',
  'baseline',
  'elevated',
  'high',
]);

export const AlcoholNearTermRiskAssessmentSchema = z
  .object({
    schemaVersion: z.literal(1),
    moduleId: z.literal('alcohol'),
    assessmentId: z.string().min(1),
    target: AlcoholNearTermRiskTargetSchema,
    horizon: AlcoholNearTermRiskHorizonSchema,
    riskBand: AlcoholNearTermRiskBandSchema,
    contributingPatternIds: z.array(z.string().min(1)),
    provenance: AlcoholDerivedEvidenceProvenanceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (hasDuplicates(value.contributingPatternIds)) {
      context.addIssue({
        code: 'custom',
        path: ['contributingPatternIds'],
        message: 'contributingPatternIds must be unique',
      });
    }
  });

export type AlcoholDerivedConfidence = z.infer<typeof AlcoholDerivedConfidenceSchema>;
export type AlcoholDerivedMissingness = z.infer<typeof AlcoholDerivedMissingnessSchema>;
export type AlcoholDerivedEvidenceProvenance = z.infer<typeof AlcoholDerivedEvidenceProvenanceSchema>;
export type AlcoholPatternInsightType = z.infer<typeof AlcoholPatternInsightTypeSchema>;
export type AlcoholPatternDirection = z.infer<typeof AlcoholPatternDirectionSchema>;
export type AlcoholPatternStrength = z.infer<typeof AlcoholPatternStrengthSchema>;
export type AlcoholPatternInsight = z.infer<typeof AlcoholPatternInsightSchema>;
export type AlcoholNearTermRiskTarget = z.infer<typeof AlcoholNearTermRiskTargetSchema>;
export type AlcoholNearTermRiskHorizon = z.infer<typeof AlcoholNearTermRiskHorizonSchema>;
export type AlcoholNearTermRiskBand = z.infer<typeof AlcoholNearTermRiskBandSchema>;
export type AlcoholNearTermRiskAssessment = z.infer<typeof AlcoholNearTermRiskAssessmentSchema>;
