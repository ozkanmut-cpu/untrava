import type { AlcoholRescueLibrary } from '../../../../../packages/contracts/src/index';

export const ALCOHOL_RESCUE_LOCALE_BASELINE = {
  'alcohol.rescue.micro-regulate.title': 'One-minute reset',
  'alcohol.rescue.micro-regulate.summary': 'Slow this moment down before deciding what to do next.',
  'alcohol.rescue.micro-regulate.step.1': 'Settle your posture and take a few slow, comfortable breaths.',
  'alcohol.rescue.urge-surf.title': 'Ride the urge',
  'alcohol.rescue.urge-surf.summary': 'Notice the urge as a changing experience rather than an instruction.',
  'alcohol.rescue.urge-surf.step.1': 'Observe the urge rise and fall without needing to act on it.',
  'alcohol.rescue.delay.title': 'Create a short pause',
  'alcohol.rescue.delay.summary': 'Give yourself a brief pause before making the next choice.',
  'alcohol.rescue.delay.step.1': 'Start a short pause and revisit the choice when the pause ends.',
  'alcohol.rescue.substitution.title': 'Choose an alcohol-free option',
  'alcohol.rescue.substitution.summary': 'Switch your attention to an alcohol-free option you already have available.',
  'alcohol.rescue.substitution.step.1': 'Choose an alcohol-free drink or another simple activity for this moment.',
  'alcohol.rescue.environment-change.title': 'Change the scene',
  'alcohol.rescue.environment-change.summary': 'Step away from the immediate cue when moving is available to you.',
  'alcohol.rescue.environment-change.step.1': 'Move to a different safe place and give yourself space from the cue.',
  'alcohol.rescue.cbt-reframe.title': 'Check the thought',
  'alcohol.rescue.cbt-reframe.summary': 'Make the automatic thought a little less absolute.',
  'alcohol.rescue.cbt-reframe.step.1': 'Name the thought, then choose one more balanced way to describe this moment.',
  'alcohol.rescue.human-support.title': 'Reach out for support',
  'alcohol.rescue.human-support.summary': 'Choose whether you want another person involved; you remain in control.',
  'alcohol.rescue.human-support.step.1': 'Choose whether to start a support action yourself. Nothing is sent automatically.',
} as const satisfies Readonly<Record<string, string>>;

function referencedLocalizationKeys(library: AlcoholRescueLibrary): string[] {
  const keys = new Set<string>();

  for (const intervention of library.interventions) {
    keys.add(intervention.titleKey);
    keys.add(intervention.summaryKey);
    for (const step of intervention.steps) keys.add(step.copyKey);
    if (intervention.safety.escalationMessageKey) {
      keys.add(intervention.safety.escalationMessageKey);
    }
    for (const prompt of intervention.outcomePrompts) keys.add(prompt.copyKey);
  }

  return [...keys].sort();
}

export function findMissingAlcoholRescueLocalizationKeys(
  library: AlcoholRescueLibrary,
): string[] {
  return referencedLocalizationKeys(library).filter(
    (key) => !Object.prototype.hasOwnProperty.call(ALCOHOL_RESCUE_LOCALE_BASELINE, key),
  );
}
