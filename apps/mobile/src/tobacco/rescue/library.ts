import {
  RescueLibrarySchema,
  type InterventionDefinition,
  type RescueLibrary,
} from '../../../../../packages/contracts/src/index';
import { sealRescueLibrary } from '../../rescue/library-integrity';

function definition(
  interventionId: string,
  family: InterventionDefinition['family'],
  level: InterventionDefinition['level'],
  actionKind: InterventionDefinition['steps'][number]['actionKind'],
  burden: InterventionDefinition['burden'],
  options: {
    requiresEnvironmentMove?: boolean;
    requiresSupport?: boolean;
    recoveryEligible?: boolean;
    estimatedSeconds?: number;
  } = {},
): InterventionDefinition {
  return {
    interventionId,
    version: 1,
    status: 'active',
    family,
    level,
    titleKey: `rescue.${interventionId}.title`,
    summaryKey: `rescue.${interventionId}.summary`,
    steps: [
      {
        stepId: `${interventionId}-step-1`,
        copyKey: `rescue.${interventionId}.step.1`,
        actionKind,
        skippable: true,
        durationSeconds: options.estimatedSeconds ?? 60,
      },
    ],
    estimatedSeconds: options.estimatedSeconds ?? 60,
    burden,
    offlineCapable: true,
    eligibility: {
      requiresEnvironmentMove: options.requiresEnvironmentMove,
      requiresSupport: options.requiresSupport,
    },
    safety: {
      medicationAdvice: false,
      requiresHumanSupport: options.requiresSupport,
    },
    outcomePrompts: [],
    contentHash: 'pending',
    recoveryEligible: options.recoveryEligible ?? false,
  };
}

export function createBundledTobaccoRescueLibrary(): RescueLibrary {
  return sealRescueLibrary(
    RescueLibrarySchema.parse({
      libraryId: 'untrava-rescue',
      schemaVersion: 1,
      contentVersion: 1,
      publishedAt: '2026-09-16T00:00:00.000Z',
      contentHash: 'pending',
      interventions: [
        definition('micro-regulate', 'mindfulness_regulation', 'micro', 'breathing', 'very_low', { estimatedSeconds: 60 }),
        definition('urge-surf', 'act', 'micro', 'urge_surfing', 'low', { estimatedSeconds: 90 }),
        definition('cbt-reframe', 'cbt', 'guided', 'cognitive_reframe', 'low', { estimatedSeconds: 120 }),
        definition('delay-substitute', 'behavioral_coping', 'guided', 'delay', 'low', { estimatedSeconds: 180 }),
        definition('environment-escape', 'environment_change', 'environment_escape', 'environment_change', 'medium', {
          requiresEnvironmentMove: true,
          estimatedSeconds: 180,
        }),
        definition('human-support', 'human_support', 'human_support', 'human_support', 'high', {
          requiresSupport: true,
          estimatedSeconds: 60,
        }),
        definition('recovery-reset', 'behavioral_coping', 'micro', 'recovery', 'very_low', {
          recoveryEligible: true,
          estimatedSeconds: 60,
        }),
      ],
    }),
  );
}
