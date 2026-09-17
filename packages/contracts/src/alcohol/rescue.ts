import { z } from 'zod';
import {
  addInterventionLibraryIssues,
  InterventionActionKindSchema,
  InterventionBaseEligibilitySchema,
  InterventionBurdenSchema,
  InterventionFamilySchema,
  InterventionLibraryEnvelopeBaseSchema,
  InterventionLevelSchema,
  InterventionOutcomePromptSchema,
  InterventionSafetyMetadataSchema,
  InterventionStepSchema,
} from '../core/interventions';
import { DeviceIdSchema, UserIdSchema } from '../ids';
import { AlcoholGoalTypeSchema } from './goals';

export const AlcoholRescueContextSchema = z
  .object({
    userId: UserIdSchema,
    deviceId: DeviceIdSchema,
    startedAt: z.iso.datetime(),
    goalType: AlcoholGoalTypeSchema,
    goalId: z.uuid().optional(),
    cravingIntensity: z.number().min(0).max(10).optional(),
    canMoveEnvironment: z.boolean().optional(),
    canUseAudio: z.boolean().optional(),
    canContactSupport: z.boolean().optional(),
    preferredInterventionIds: z.array(z.string().min(1)).optional(),
    recentlyDeclinedInterventionIds: z.array(z.string().min(1)).optional(),
    recentlyCompletedInterventionIds: z.array(z.string().min(1)).optional(),
    disabledInterventionIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const AlcoholInterventionEligibilitySchema = InterventionBaseEligibilitySchema.extend({
  allowedGoalTypes: z.array(AlcoholGoalTypeSchema).min(1).optional(),
}).strict();

export const AlcoholInterventionDefinitionSchema = z
  .object({
    interventionId: z.string().min(1),
    version: z.number().int().positive(),
    status: z.enum(['active', 'retired']),
    family: InterventionFamilySchema,
    level: InterventionLevelSchema,
    titleKey: z.string().min(1),
    summaryKey: z.string().min(1),
    steps: z.array(InterventionStepSchema),
    estimatedSeconds: z.number().int().positive(),
    burden: InterventionBurdenSchema,
    offlineCapable: z.literal(true),
    eligibility: AlcoholInterventionEligibilitySchema,
    safety: InterventionSafetyMetadataSchema,
    outcomePrompts: z.array(InterventionOutcomePromptSchema),
    contentHash: z.string().min(1),
    recoveryEligible: z.boolean().default(false),
  })
  .strict();

export const AlcoholRescueLibrarySchema = InterventionLibraryEnvelopeBaseSchema.extend({
  moduleId: z.literal('alcohol'),
  libraryId: z.literal('alcohol-rescue'),
  interventions: z.array(AlcoholInterventionDefinitionSchema).min(1),
})
  .strict()
  .superRefine((library, ctx) => addInterventionLibraryIssues(library.interventions, ctx));

export type AlcoholRescueContext = z.infer<typeof AlcoholRescueContextSchema>;
export type AlcoholInterventionEligibility = z.infer<typeof AlcoholInterventionEligibilitySchema>;
export type AlcoholInterventionDefinition = z.infer<typeof AlcoholInterventionDefinitionSchema>;
export type AlcoholRescueLibrary = z.infer<typeof AlcoholRescueLibrarySchema>;
export type AlcoholRescueActionKind = z.infer<typeof InterventionActionKindSchema>;
