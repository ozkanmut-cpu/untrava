import {
  AlcoholRescueLibrarySchema,
  type AlcoholInterventionDefinition,
  type AlcoholRescueLibrary,
} from '../../../../../packages/contracts/src/index';
import { sealInterventionLibrary } from '../../rescue/library-integrity';
import { findMissingAlcoholRescueLocalizationKeys } from './localization';

function definition(
  interventionId: string,
  family: AlcoholInterventionDefinition['family'],
  level: AlcoholInterventionDefinition['level'],
  actionKind: AlcoholInterventionDefinition['steps'][number]['actionKind'],
  burden: AlcoholInterventionDefinition['burden'],
  options: {
    requiresEnvironmentMove?: boolean;
    requiresSupport?: boolean;
    requiresHumanSupport?: boolean;
    estimatedSeconds?: number;
    recoveryEligible?: boolean;
    steps?: AlcoholInterventionDefinition['steps'];
  } = {},
): AlcoholInterventionDefinition {
  const copyId = interventionId.replace(/^alcohol-(?:recovery-)?/, '');
  const copyPrefix = options.recoveryEligible ? 'alcohol.recovery' : 'alcohol.rescue';
  return {
    interventionId,
    version: 1,
    status: 'active',
    family,
    level,
    titleKey: `${copyPrefix}.${copyId}.title`,
    summaryKey: `${copyPrefix}.${copyId}.summary`,
    steps: options.steps ?? [
      {
        stepId: `${interventionId}-step-1`,
        copyKey: `${copyPrefix}.${copyId}.step.1`,
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
      requiresHumanSupport: options.requiresHumanSupport ?? options.requiresSupport,
    },
    outcomePrompts: [],
    contentHash: 'pending',
    recoveryEligible: options.recoveryEligible ?? false,
  };
}

const candidate: AlcoholRescueLibrary = {
  moduleId: 'alcohol',
  libraryId: 'alcohol-rescue',
  schemaVersion: 1,
  contentVersion: 2,
  publishedAt: '2026-09-17T00:00:00.000Z',
  contentHash: 'pending',
  interventions: [
    definition(
      'alcohol-micro-regulate',
      'mindfulness_regulation',
      'micro',
      'breathing',
      'very_low',
      { estimatedSeconds: 60 },
    ),
    definition('alcohol-urge-surf', 'act', 'micro', 'urge_surfing', 'low', {
      estimatedSeconds: 90,
    }),
    definition('alcohol-delay', 'behavioral_coping', 'guided', 'delay', 'low', {
      estimatedSeconds: 180,
    }),
    definition(
      'alcohol-substitution',
      'behavioral_coping',
      'guided',
      'substitution',
      'low',
      { estimatedSeconds: 120 },
    ),
    definition('alcohol-environment-change', 'environment_change', 'environment_escape', 'environment_change', 'medium', {
      requiresEnvironmentMove: true,
      estimatedSeconds: 180,
    }),
    definition('alcohol-cbt-reframe', 'cbt', 'guided', 'cognitive_reframe', 'low', {
      estimatedSeconds: 120,
    }),
    definition('alcohol-human-support', 'human_support', 'human_support', 'human_support', 'high', {
      requiresSupport: true,
      estimatedSeconds: 60,
    }),
    definition('alcohol-recovery-reset', 'behavioral_coping', 'micro', 'recovery', 'very_low', {
      estimatedSeconds: 60,
      recoveryEligible: true,
      requiresHumanSupport: false,
      steps: [
        {
          stepId: 'alcohol-recovery-reset-step-1',
          copyKey: 'alcohol.recovery.reset.step.1',
          actionKind: 'recovery',
          skippable: true,
          durationSeconds: 30,
        },
        {
          stepId: 'alcohol-recovery-reset-step-2',
          copyKey: 'alcohol.recovery.reset.step.2',
          actionKind: 'recovery',
          skippable: true,
          durationSeconds: 30,
        },
      ],
    }),
  ],
};

const sealed = sealInterventionLibrary(candidate);

export const ALCOHOL_RESCUE_LIBRARY = AlcoholRescueLibrarySchema.parse(sealed);

if (findMissingAlcoholRescueLocalizationKeys(ALCOHOL_RESCUE_LIBRARY).length > 0) {
  throw new Error('alcohol_rescue_localization_incomplete');
}
