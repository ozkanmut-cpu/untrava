import type {
  AlcoholInterventionDefinition,
  AlcoholRescueContext,
  AlcoholRescueLibrary,
  InterventionActionKind,
  InterventionLevel,
  WithdrawalSafetyDecision,
} from '../../../../../packages/contracts/src/index';
import { hasValidInterventionLibraryIntegrity } from '../../rescue/library-integrity';

export type AlcoholRescueSelection =
  | {
      kind: 'intervention';
      interventionId: string;
      version: number;
      reasonCodes: string[];
    }
  | {
      kind: 'safety_routing';
      disposition: 'urgent_medical_assessment' | 'emergency_response';
      reasonCodes: string[];
    }
  | {
      kind: 'unavailable';
      reasonCodes: string[];
    };

const MEDICAL_ASSESSMENT_SUPPORTIVE_ACTIONS = new Set<InterventionActionKind>([
  'breathing',
  'urge_surfing',
  'cognitive_reframe',
  'environment_change',
  'human_support',
]);

const levelRank: Record<InterventionLevel, number> = {
  micro: 0,
  guided: 1,
  environment_escape: 2,
  human_support: 3,
};

const burdenRank: Record<AlcoholInterventionDefinition['burden'], number> = {
  very_low: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function isEligible(
  item: AlcoholInterventionDefinition,
  context: AlcoholRescueContext,
  safety: WithdrawalSafetyDecision,
): boolean {
  if (item.status !== 'active') return false;
  if (context.disabledInterventionIds?.includes(item.interventionId)) return false;
  if (
    item.eligibility.allowedGoalTypes &&
    !item.eligibility.allowedGoalTypes.includes(context.goalType)
  ) {
    return false;
  }
  if (
    item.eligibility.requiresEnvironmentMove &&
    context.canMoveEnvironment !== true
  ) {
    return false;
  }
  if (item.eligibility.requiresAudio && context.canUseAudio !== true) {
    return false;
  }
  if (
    (item.eligibility.requiresSupport ||
      item.safety.requiresHumanSupport) &&
    context.canContactSupport !== true
  ) {
    return false;
  }
  if (
    safety.disposition === 'medical_assessment_advised' &&
    !item.steps.every((step) =>
      MEDICAL_ASSESSMENT_SUPPORTIVE_ACTIONS.has(step.actionKind),
    )
  ) {
    return false;
  }
  return true;
}

function compareCandidates(
  left: AlcoholInterventionDefinition,
  right: AlcoholInterventionDefinition,
  context: AlcoholRescueContext,
): number {
  const leftDeclined = context.recentlyDeclinedInterventionIds?.includes(
    left.interventionId,
  )
    ? 1
    : 0;
  const rightDeclined = context.recentlyDeclinedInterventionIds?.includes(
    right.interventionId,
  )
    ? 1
    : 0;
  if (leftDeclined !== rightDeclined) return leftDeclined - rightDeclined;

  const leftPreferred = context.preferredInterventionIds?.includes(
    left.interventionId,
  )
    ? 0
    : 1;
  const rightPreferred = context.preferredInterventionIds?.includes(
    right.interventionId,
  )
    ? 0
    : 1;
  if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;

  const leftRecent = context.recentlyCompletedInterventionIds?.includes(
    left.interventionId,
  )
    ? 1
    : 0;
  const rightRecent = context.recentlyCompletedInterventionIds?.includes(
    right.interventionId,
  )
    ? 1
    : 0;
  if (leftRecent !== rightRecent) return leftRecent - rightRecent;

  if (levelRank[left.level] !== levelRank[right.level]) {
    return levelRank[left.level] - levelRank[right.level];
  }
  if (burdenRank[left.burden] !== burdenRank[right.burden]) {
    return burdenRank[left.burden] - burdenRank[right.burden];
  }
  const idOrder = left.interventionId.localeCompare(right.interventionId);
  return idOrder !== 0 ? idOrder : left.version - right.version;
}

export function selectAlcoholIntervention(
  library: AlcoholRescueLibrary | null,
  context: AlcoholRescueContext,
  safety: WithdrawalSafetyDecision,
  minimumLevel: InterventionLevel = 'micro',
): AlcoholRescueSelection {
  if (
    safety.disposition === 'emergency_response' ||
    safety.disposition === 'urgent_medical_assessment'
  ) {
    return {
      kind: 'safety_routing',
      disposition: safety.disposition,
      reasonCodes: [`safety:${safety.disposition}`],
    };
  }

  if (!library || !hasValidInterventionLibraryIntegrity(library)) {
    return {
      kind: 'unavailable',
      reasonCodes: ['library_unavailable'],
    };
  }

  const minimumRank = levelRank[minimumLevel];
  const candidates = library.interventions
    .filter(
      (item) =>
        isEligible(item, context, safety) &&
        levelRank[item.level] >= minimumRank,
    )
    .sort((left, right) => compareCandidates(left, right, context));

  const selected = candidates[0];
  if (!selected) {
    return {
      kind: 'unavailable',
      reasonCodes: ['no_eligible_intervention'],
    };
  }

  const reasonCodes = ['lowest_burden_eligible'];
  if (context.preferredInterventionIds?.includes(selected.interventionId)) {
    reasonCodes.push('user_preferred');
  }
  if (minimumLevel !== 'micro') {
    reasonCodes.push(`minimum_level:${minimumLevel}`);
  }
  if (safety.disposition === 'medical_assessment_advised') {
    reasonCodes.push('safety:medical_assessment_advised');
  }

  return {
    kind: 'intervention',
    interventionId: selected.interventionId,
    version: selected.version,
    reasonCodes,
  };
}
