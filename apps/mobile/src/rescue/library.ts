import {
  RescueLibrarySchema,
  type InterventionDefinition,
  type RescueLibrary,
} from '../../../../packages/contracts/src/index';

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

function sealIntervention(intervention: InterventionDefinition): InterventionDefinition {
  const content = { ...intervention, contentHash: undefined };
  return { ...intervention, contentHash: checksum(content) };
}

export function sealRescueLibrary(candidate: RescueLibrary): RescueLibrary {
  const interventions = candidate.interventions.map(sealIntervention);
  const content = { ...candidate, interventions, contentHash: undefined };
  return RescueLibrarySchema.parse({
    ...candidate,
    interventions,
    contentHash: checksum(content),
  });
}

export function hasValidRescueLibraryIntegrity(candidate: RescueLibrary): boolean {
  const expected = sealRescueLibrary(candidate);
  if (candidate.contentHash !== expected.contentHash) return false;
  return candidate.interventions.every(
    (intervention, index) => intervention.contentHash === expected.interventions[index]?.contentHash,
  );
}

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

export function createBundledRescueLibrary(): RescueLibrary {
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
