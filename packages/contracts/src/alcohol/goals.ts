import { z } from 'zod';
import { CoreGoalRecordSchema } from '../core/goals';

export const AlcoholGoalTypeSchema = z.enum([
  'observe_only',
  'abstinence',
  'reduction',
  'alcohol_free_days',
  'usage_limit',
]);

export const ObserveOnlyGoalConfigSchema = z.object({ type: z.literal('observe_only') }).strict();
export const AbstinenceGoalConfigSchema = z.object({ type: z.literal('abstinence') }).strict();
export const ReductionGoalConfigSchema = z
  .object({
    type: z.literal('reduction'),
    targetReductionPercent: z.number().gt(0).max(100),
  })
  .strict();
export const AlcoholFreeDaysGoalConfigSchema = z
  .object({
    type: z.literal('alcohol_free_days'),
    targetDaysPerWeek: z.number().int().min(1).max(7),
  })
  .strict();
export const UsageLimitGoalConfigSchema = z
  .object({
    type: z.literal('usage_limit'),
    period: z.enum(['day', 'week']),
    maxPureEthanolGrams: z.number().positive(),
  })
  .strict();

export const AlcoholGoalConfigSchema = z.discriminatedUnion('type', [
  ObserveOnlyGoalConfigSchema,
  AbstinenceGoalConfigSchema,
  ReductionGoalConfigSchema,
  AlcoholFreeDaysGoalConfigSchema,
  UsageLimitGoalConfigSchema,
]);

export const AlcoholGoalRecordSchema = CoreGoalRecordSchema.extend({
  moduleId: z.literal('alcohol'),
  goalTypeKey: AlcoholGoalTypeSchema,
  goalSchemaVersion: z.literal(1),
  config: AlcoholGoalConfigSchema,
}).superRefine((value, context) => {
  if (value.goalTypeKey !== value.config.type) {
    context.addIssue({
      code: 'custom',
      path: ['config', 'type'],
      message: 'Alcohol goal config type must match goalTypeKey',
    });
  }
});

export type AlcoholGoalType = z.infer<typeof AlcoholGoalTypeSchema>;
export type AlcoholGoalConfig = z.infer<typeof AlcoholGoalConfigSchema>;
export type AlcoholGoalRecord = z.infer<typeof AlcoholGoalRecordSchema>;
