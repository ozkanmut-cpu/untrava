import { z } from 'zod';
import { DeviceIdSchema, UserIdSchema } from './ids';
import { GoalTypeSchema, ProductTypeSchema } from './profile';

export const RescueLevelSchema = z.enum(['micro', 'guided', 'environment_escape', 'human_support']);
export const InterventionFamilySchema = z.enum([
  'act',
  'cbt',
  'behavioral_coping',
  'mindfulness_regulation',
  'environment_change',
  'human_support',
]);
export const InterventionBurdenSchema = z.enum(['very_low', 'low', 'medium', 'high']);
export const RescueProductIntentSchema = ProductTypeSchema;
export const RescueProductUseOutcomeSchema = z.enum(['no_use', 'use', 'unknown']);
export const RescueSessionStateSchema = z.enum([
  'started',
  'stabilizing',
  'intervention_selected',
  'intervention_active',
  'reassessing',
  'escalating',
  'support_offered',
  'recovery',
  'resolved',
  'abandoned',
]);

export const InterventionActionKindSchema = z.enum([
  'breathing',
  'urge_surfing',
  'cognitive_reframe',
  'delay',
  'substitution',
  'environment_change',
  'human_support',
  'recovery',
]);

export const InterventionStepSchema = z.object({
  stepId: z.string().min(1),
  copyKey: z.string().min(1),
  actionKind: InterventionActionKindSchema,
  skippable: z.boolean(),
  durationSeconds: z.number().int().positive().optional(),
  accessibility: z.record(z.string(), z.string()).optional(),
});

export const InterventionEligibilitySchema = z.object({
  requiresEnvironmentMove: z.boolean().optional(),
  requiresAudio: z.boolean().optional(),
  requiresSupport: z.boolean().optional(),
  allowedGoalTypes: z.array(GoalTypeSchema).min(1).optional(),
});

export const InterventionSafetyMetadataSchema = z.object({
  medicationAdvice: z.literal(false),
  requiresHumanSupport: z.boolean().optional(),
  avoidWhen: z.array(z.string().min(1)).optional(),
  escalationMessageKey: z.string().min(1).optional(),
});

export const InterventionOutcomePromptSchema = z.object({
  promptId: z.string().min(1),
  copyKey: z.string().min(1),
  kind: z.enum(['craving', 'delay', 'environment', 'exercise', 'support', 'product_use', 'helpfulness']),
  optional: z.boolean().default(true),
});

export const InterventionDefinitionSchema = z.object({
  interventionId: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(['active', 'retired']),
  family: InterventionFamilySchema,
  level: RescueLevelSchema,
  titleKey: z.string().min(1),
  summaryKey: z.string().min(1),
  steps: z.array(InterventionStepSchema),
  estimatedSeconds: z.number().int().positive(),
  burden: InterventionBurdenSchema,
  offlineCapable: z.literal(true),
  eligibility: InterventionEligibilitySchema,
  safety: InterventionSafetyMetadataSchema,
  outcomePrompts: z.array(InterventionOutcomePromptSchema),
  contentHash: z.string().min(1),
  recoveryEligible: z.boolean().default(false),
});

export const RescueLibrarySchema = z
  .object({
    libraryId: z.literal('untrava-rescue'),
    schemaVersion: z.literal(1),
    contentVersion: z.number().int().positive(),
    publishedAt: z.iso.datetime(),
    interventions: z.array(InterventionDefinitionSchema).min(1),
    contentHash: z.string().min(1),
  })
  .superRefine((library, ctx) => {
    const identities = new Set<string>();
    const activeIds = new Set<string>();

    library.interventions.forEach((intervention, index) => {
      const identity = `${intervention.interventionId}:${intervention.version}`;
      if (identities.has(identity)) {
        ctx.addIssue({
          code: 'custom',
          message: 'duplicate_intervention_version',
          path: ['interventions', index],
        });
      }
      identities.add(identity);

      if (intervention.status === 'active') {
        if (intervention.steps.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'active_intervention_requires_step',
            path: ['interventions', index, 'steps'],
          });
        }
        if (activeIds.has(intervention.interventionId)) {
          ctx.addIssue({
            code: 'custom',
            message: 'duplicate_active_intervention',
            path: ['interventions', index],
          });
        }
        activeIds.add(intervention.interventionId);
      }
    });
  });

export const RescueContextSchema = z.object({
  userId: UserIdSchema,
  deviceId: DeviceIdSchema,
  startedAt: z.iso.datetime(),
  goalType: GoalTypeSchema,
  productIntent: RescueProductIntentSchema.optional(),
  cravingIntensity: z.number().min(0).max(10).optional(),
  locationMode: z.enum(['home', 'work', 'social', 'travel', 'unknown']).optional(),
  canMoveEnvironment: z.boolean().optional(),
  canUseAudio: z.boolean().optional(),
  canContactSupport: z.boolean().optional(),
  preferredInterventionIds: z.array(z.string().min(1)).optional(),
  recentlyDeclinedInterventionIds: z.array(z.string().min(1)).optional(),
  recentlyCompletedInterventionIds: z.array(z.string().min(1)).optional(),
  disabledInterventionIds: z.array(z.string().min(1)).optional(),
});

export const RescueOutcomeSchema = z.object({
  cravingBefore: z.number().min(0).max(10).optional(),
  cravingAfter: z.number().min(0).max(10).optional(),
  delayMinutes: z.number().nonnegative().optional(),
  environmentChanged: z.boolean().optional(),
  exerciseCompleted: z.boolean().optional(),
  supportRequested: z.boolean().optional(),
  productUseOutcome: RescueProductUseOutcomeSchema.optional(),
  userHelpfulRating: z.enum(['helped', 'neutral', 'did_not_help']).optional(),
});

export const RescueSessionSchema = z.object({
  rescueSessionId: z.uuid(),
  context: RescueContextSchema,
  state: RescueSessionStateSchema,
  libraryContentVersion: z.number().int().positive(),
  interventionId: z.string().min(1).nullable(),
  interventionVersion: z.number().int().positive().nullable(),
  currentStepIndex: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  outcome: RescueOutcomeSchema.optional(),
});

export type RescueLevel = z.infer<typeof RescueLevelSchema>;
export type InterventionFamily = z.infer<typeof InterventionFamilySchema>;
export type InterventionBurden = z.infer<typeof InterventionBurdenSchema>;
export type InterventionActionKind = z.infer<typeof InterventionActionKindSchema>;
export type InterventionStep = z.infer<typeof InterventionStepSchema>;
export type InterventionEligibility = z.infer<typeof InterventionEligibilitySchema>;
export type InterventionSafetyMetadata = z.infer<typeof InterventionSafetyMetadataSchema>;
export type InterventionOutcomePrompt = z.infer<typeof InterventionOutcomePromptSchema>;
export type InterventionDefinition = z.infer<typeof InterventionDefinitionSchema>;
export type RescueLibrary = z.infer<typeof RescueLibrarySchema>;
export type RescueContext = z.infer<typeof RescueContextSchema>;
export type RescueOutcome = z.infer<typeof RescueOutcomeSchema>;
export type RescueSessionState = z.infer<typeof RescueSessionStateSchema>;
export type RescueSession = z.infer<typeof RescueSessionSchema>;
