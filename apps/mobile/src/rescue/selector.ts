import type {
  InterventionDefinition,
  RescueContext,
  RescueLevel,
  RescueLibrary,
} from '../../../../packages/contracts/src/index';

export interface InterventionSelection {
  interventionId: string;
  version: number;
  reasonCodes: string[];
}

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

function eligible(item: InterventionDefinition, context: RescueContext): boolean {
  if (item.status !== 'active') return false;
  if (context.disabledInterventionIds?.includes(item.interventionId)) return false;
  if (item.eligibility.requiresEnvironmentMove && context.canMoveEnvironment === false) return false;
  if (item.eligibility.requiresAudio && context.canUseAudio === false) return false;
  if ((item.eligibility.requiresSupport || item.safety.requiresHumanSupport) && context.canContactSupport === false) {
    return false;
  }
  return true;
}

export function selectIntervention(
  library: RescueLibrary,
  context: RescueContext,
  minimumLevel: RescueLevel = 'micro',
): InterventionSelection | null {
  const minimumRank = levelRank[minimumLevel];
  const candidates = library.interventions
    .filter((item) => eligible(item, context) && levelRank[item.level] >= minimumRank)
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
  if (!selected) return null;

  const reasonCodes = ['lowest_burden_eligible'];
  if (context.preferredInterventionIds?.includes(selected.interventionId)) reasonCodes.push('user_preferred');
  if (minimumLevel !== 'micro') reasonCodes.push(`minimum_level:${minimumLevel}`);

  return {
    interventionId: selected.interventionId,
    version: selected.version,
    reasonCodes,
  };
}
