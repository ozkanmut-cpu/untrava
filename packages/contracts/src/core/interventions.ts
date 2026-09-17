import { z } from 'zod';

export const InterventionLevelSchema = z.enum(['micro', 'guided', 'environment_escape', 'human_support']);

export const InterventionFamilySchema = z.enum([
  'act',
  'cbt',
  'behavioral_coping',
  'mindfulness_regulation',
  'environment_change',
  'human_support',
]);

export const InterventionBurdenSchema = z.enum(['very_low', 'low', 'medium', 'high']);

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

export const InterventionBaseEligibilitySchema = z.object({
  requiresEnvironmentMove: z.boolean().optional(),
  requiresAudio: z.boolean().optional(),
  requiresSupport: z.boolean().optional(),
});

export const InterventionSafetyMetadataSchema = z
  .object({
    medicationAdvice: z.literal(false),
    requiresHumanSupport: z.boolean().optional(),
    avoidWhen: z.array(z.string().min(1)).optional(),
    escalationMessageKey: z.string().min(1).optional(),
  })
  .strict();

export const InterventionOutcomePromptSchema = z.object({
  promptId: z.string().min(1),
  copyKey: z.string().min(1),
  kind: z.enum(['craving', 'delay', 'environment', 'exercise', 'support', 'product_use', 'helpfulness']),
  optional: z.boolean().default(true),
});

export const InterventionLibraryEnvelopeBaseSchema = z.object({
  moduleId: z.string().min(1),
  libraryId: z.string().min(1),
  schemaVersion: z.literal(1),
  contentVersion: z.number().int().positive(),
  publishedAt: z.iso.datetime(),
  contentHash: z.string().min(1),
});

export interface LibraryInterventionIdentity {
  interventionId: string;
  version: number;
  status: 'active' | 'retired';
  steps: readonly unknown[];
}

export function addInterventionLibraryIssues(
  interventions: readonly LibraryInterventionIdentity[],
  ctx: z.RefinementCtx,
): void {
  const identities = new Set<string>();
  const activeIds = new Set<string>();

  interventions.forEach((intervention, index) => {
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
}

export type InterventionLevel = z.infer<typeof InterventionLevelSchema>;
export type InterventionFamily = z.infer<typeof InterventionFamilySchema>;
export type InterventionBurden = z.infer<typeof InterventionBurdenSchema>;
export type InterventionActionKind = z.infer<typeof InterventionActionKindSchema>;
export type InterventionStep = z.infer<typeof InterventionStepSchema>;
export type InterventionBaseEligibility = z.infer<typeof InterventionBaseEligibilitySchema>;
export type InterventionSafetyMetadata = z.infer<typeof InterventionSafetyMetadataSchema>;
export type InterventionOutcomePrompt = z.infer<typeof InterventionOutcomePromptSchema>;
export type InterventionLibraryEnvelopeBase = z.infer<typeof InterventionLibraryEnvelopeBaseSchema>;
