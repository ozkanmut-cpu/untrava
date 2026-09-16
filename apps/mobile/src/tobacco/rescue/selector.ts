import type {
  InterventionDefinition,
  RescueContext,
  RescueLevel,
  RescueLibrary,
} from '../../../../../packages/contracts/src/index';

export interface InterventionSelection {
  interventionId: string;
  version: number;
  reasonCodes: string[];
}

export type RescueSelectionMode = 'rescue' | 'recovery';

export const MINIMAL_STABILIZATION_FALLBACK = {
  interventionId: 'minimal-stabilization-fallback',
  version: 1,
  level: 'micro',
  estimatedSeconds: 60,
  title: 'One quiet minute',
  summary: 'Use one simple offline step while Rescue resets.',
  steps: [
    {
      stepId: 'minimal-stabilization-fallback-step-1',
      instruction: 'Breathe slowly and give the urge one minute before deciding what to do next.',
      durationSeconds: 60,
    },
  ],
  safety: {
    medicationAdvice: false,
  },
} as const;

const levelRank: Record<RescueLevel, number> = {
  micro: 0,
  guided: 1,
  environment_escape: 2,
  human_support: 3,
};

const burdenRank: Record<InterventionDefinition['burden'], number> = {
  very_low: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function eligible(
  item: InterventionDefinition,
  context: RescueContext,
  mode: RescueSelectionMode,
): boolean {
  if (item.status !== 'active') return false;
  if (mode === 'recovery' && !item.recoveryEligible) return false;
  if (context.disabledInterventionIds?.includes(item.interventionId)) return false;
  if (item.eligibility.allowedGoalTypes && !item.eligibility.allowedGoalTypes.includes(context.goalType)) return false;
  if (item.eligibility.requiresEnvironmentMove && context.canMoveEnvironment === false) return false;
  if (item.eligibility.requiresAudio && context.canUseAudio === false) return false;
  if ((item.eligibility.requiresSupport || item.safety.requiresHumanSupport) && context.canContactSupport === false) {
    return false;
  }
  return true;
}

export function selectTobaccoIntervention(
  library: RescueLibrary,
  context: RescueContext,
  minimumLevel: RescueLevel = 'micro',
  mode: RescueSelectionMode = 'rescue',
): InterventionSelection | null {
  const minimumRank = levelRank[minimumLevel];
  const candidates = library.interventions
    .filter((item) => eligible(item, context, mode) && levelRank[item.level] >= minimumRank)
    .sort((left, right) => {
      const leftDeclined = context.recentlyDeclinedInterventionIds?.includes(left.interventionId) ? 1 : 0;
      const rightDeclined = context.recentlyDeclinedInterventionIds?.includes(right.interventionId) ? 1 : 0;
      if (leftDeclined !== rightDeclined) return leftDeclined - rightDeclined;

      const leftPreferred = context.preferredInterventionIds?.includes(left.interventionId) ? 0 : 1;
      const rightPreferred = context.preferredInterventionIds?.includes(right.interventionId) ? 0 : 1;
      if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;

      const leftRecent = context.recentlyCompletedInterventionIds?.includes(left.interventionId) ? 1 : 0;
      const rightRecent = context.recentlyCompletedInterventionIds?.includes(right.interventionId) ? 1 : 0;
      if (leftRecent !== rightRecent) return leftRecent - rightRecent;

      if (levelRank[left.level] !== levelRank[right.level]) return levelRank[left.level] - levelRank[right.level];
      if (burdenRank[left.burden] !== burdenRank[right.burden]) return burdenRank[left.burden] - burdenRank[right.burden];
      const idOrder = left.interventionId.localeCompare(right.interventionId);
      return idOrder !== 0 ? idOrder : left.version - right.version;
    });

  const selected = candidates[0];
  if (!selected) {
    if (mode === 'rescue' && minimumLevel === 'micro') {
      return {
        interventionId: MINIMAL_STABILIZATION_FALLBACK.interventionId,
        version: MINIMAL_STABILIZATION_FALLBACK.version,
        reasonCodes: ['hardcoded_minimal_fallback'],
      };
    }
    return null;
  }

  const reasonCodes = ['lowest_burden_eligible'];
  if (context.preferredInterventionIds?.includes(selected.interventionId)) reasonCodes.push('user_preferred');
  if (minimumLevel !== 'micro') reasonCodes.push(`minimum_level:${minimumLevel}`);
  if (mode === 'recovery') reasonCodes.push('recovery_mode');

  return {
    interventionId: selected.interventionId,
    version: selected.version,
    reasonCodes,
  };
}
