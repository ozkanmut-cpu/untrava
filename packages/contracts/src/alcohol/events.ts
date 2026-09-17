import { z } from 'zod';
import { BehaviorEventEnvelopeBaseSchema } from '../core/events';
import { EventIdSchema } from '../ids';
import {
  AlcoholPlanRelationSchema,
  AlcoholRecoveryNextActionSchema,
  AlcoholRecoveryReflectionSchema,
} from './recovery';

export { AlcoholPlanRelationSchema } from './recovery';

export const AlcoholEventTypeSchema = z.enum([
  'alcohol_use',
  'alcohol_recovery_reflection',
  'alcohol_recovery_outcome',
  'correction',
  'retraction',
]);

export const AlcoholBeverageCategorySchema = z.enum([
  'beer',
  'wine',
  'spirits',
  'cider',
  'ready_to_drink',
  'fortified_wine',
  'other',
  'unknown',
]);

export const AlcoholQuantityConfidenceSchema = z.enum(['exact', 'estimated']);
export const AlcoholEntrySourceSchema = z.enum(['manual', 'favorite', 'repeat_previous']);
export const AlcoholSocialContextSchema = z.enum(['alone', 'with_others', 'mixed', 'unknown']);

export const PureEthanolMeasurementSchema = z
  .object({
    grams: z.number().positive(),
    calculationVersion: z.literal('volume_abv_density_v1'),
  })
  .strict();

const AlcoholUseContextSchema = z.object({
  beverageCategory: AlcoholBeverageCategorySchema,
  beverageLabel: z.string().min(1).optional(),
  volumeMl: z.number().positive(),
  quantityConfidence: AlcoholQuantityConfidenceSchema,
  entrySource: AlcoholEntrySourceSchema,
  planRelation: AlcoholPlanRelationSchema,
  socialContext: AlcoholSocialContextSchema.optional(),
  contextTags: z.array(z.string().min(1)).optional(),
  triggerTags: z.array(z.string().min(1)).optional(),
});

const UnknownAbvAlcoholUsePayloadSchema = AlcoholUseContextSchema.strict();

const KnownAbvAlcoholUsePayloadSchema = AlcoholUseContextSchema.extend({
  abvPercent: z.number().gt(0).max(100),
  pureEthanol: PureEthanolMeasurementSchema,
})
  .strict()
  .superRefine((value, context) => {
    const expectedGrams = value.volumeMl * (value.abvPercent / 100) * 0.789;
    if (Math.abs(value.pureEthanol.grams - expectedGrams) > 0.05) {
      context.addIssue({
        code: 'custom',
        path: ['pureEthanol', 'grams'],
        message: 'Pure ethanol grams must match volume, ABV, and calculation version',
      });
    }
  });

export const AlcoholUsePayloadSchema = z.union([
  KnownAbvAlcoholUsePayloadSchema,
  UnknownAbvAlcoholUsePayloadSchema,
]);

export const AlcoholRecoveryOutcomeStatusSchema = z.enum(['completed', 'abandoned', 'safety_routed']);

export const AlcoholRecoveryReflectionPayloadSchema = AlcoholRecoveryReflectionSchema.extend({
  recoverySessionId: z.uuid(),
  triggeringUseEventId: EventIdSchema,
}).strict();

const AlcoholRecoverySafetyAuditSchema = z
  .object({
    engineId: z.literal('alcohol_withdrawal_risk'),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    disposition: z.enum(['urgent_medical_assessment', 'emergency_response']),
  })
  .strict();

export const AlcoholRecoveryOutcomePayloadSchema = z
  .object({
    recoverySessionId: z.uuid(),
    triggeringUseEventId: EventIdSchema,
    goalId: z.uuid().optional(),
    outcome: AlcoholRecoveryOutcomeStatusSchema,
    nextAction: AlcoholRecoveryNextActionSchema.optional(),
    interventionId: z.string().min(1).optional(),
    interventionVersion: z.number().int().positive().optional(),
    safetyAudit: AlcoholRecoverySafetyAuditSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === 'safety_routed' && value.safetyAudit === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['safetyAudit'],
        message: 'Safety-routed outcomes require a safety audit',
      });
    }

    if (value.outcome !== 'safety_routed' && value.safetyAudit !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['safetyAudit'],
        message: 'Safety audit is only allowed for safety-routed outcomes',
      });
    }
  });

const AlcoholEventBaseSchema = BehaviorEventEnvelopeBaseSchema.extend({
  moduleId: z.literal('alcohol'),
  schemaVersion: z.literal(1),
});

const AlcoholUseEventSchema = AlcoholEventBaseSchema.extend({
  eventType: z.literal('alcohol_use'),
  payload: AlcoholUsePayloadSchema,
});

const AlcoholRecoveryReflectionEventSchema = AlcoholEventBaseSchema.extend({
  eventType: z.literal('alcohol_recovery_reflection'),
  payload: AlcoholRecoveryReflectionPayloadSchema,
});

const AlcoholRecoveryOutcomeEventSchema = AlcoholEventBaseSchema.extend({
  eventType: z.literal('alcohol_recovery_outcome'),
  payload: AlcoholRecoveryOutcomePayloadSchema,
});

const AlcoholCorrectionEventSchema = AlcoholEventBaseSchema.extend({
  eventType: z.literal('correction'),
  payload: z
    .object({
      targetEventId: EventIdSchema,
    })
    .catchall(z.unknown()),
});

const AlcoholRetractionEventSchema = AlcoholEventBaseSchema.extend({
  eventType: z.literal('retraction'),
  payload: z
    .object({
      targetEventId: EventIdSchema,
    })
    .catchall(z.unknown()),
});

export const AlcoholEventEnvelopeSchema = z.discriminatedUnion('eventType', [
  AlcoholUseEventSchema,
  AlcoholRecoveryReflectionEventSchema,
  AlcoholRecoveryOutcomeEventSchema,
  AlcoholCorrectionEventSchema,
  AlcoholRetractionEventSchema,
]);

export type AlcoholEventType = z.infer<typeof AlcoholEventTypeSchema>;
export type AlcoholBeverageCategory = z.infer<typeof AlcoholBeverageCategorySchema>;
export type AlcoholUsePayload = z.infer<typeof AlcoholUsePayloadSchema>;
export type AlcoholRecoveryOutcomeStatus = z.infer<typeof AlcoholRecoveryOutcomeStatusSchema>;
export type AlcoholRecoveryReflectionPayload = z.infer<typeof AlcoholRecoveryReflectionPayloadSchema>;
export type AlcoholRecoveryOutcomePayload = z.infer<typeof AlcoholRecoveryOutcomePayloadSchema>;
export type AlcoholEventEnvelope = z.infer<typeof AlcoholEventEnvelopeSchema>;
