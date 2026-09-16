import type { RescueLibrary } from '../../../../packages/contracts/src/index';

export const RESCUE_LOCALE_BASELINE = {
  'rescue.micro-regulate.title': 'One-minute reset',
  'rescue.micro-regulate.summary': 'Slow the next minute down and create a little space before acting.',
  'rescue.micro-regulate.step.1': 'Pause, settle your posture, and take a few slow breaths.',
  'rescue.urge-surf.title': 'Ride the urge',
  'rescue.urge-surf.summary': 'Notice the urge as a changing experience instead of an instruction.',
  'rescue.urge-surf.step.1': 'Observe where the urge shows up and let it rise and fall without chasing it.',
  'rescue.cbt-reframe.title': 'Check the thought',
  'rescue.cbt-reframe.summary': 'Make the automatic thought a little less absolute.',
  'rescue.cbt-reframe.step.1': 'Name the thought, then choose one more balanced way to describe this moment.',
  'rescue.delay-substitute.title': 'Delay and switch',
  'rescue.delay-substitute.summary': 'Create a short delay and give your hands or attention another task.',
  'rescue.delay-substitute.step.1': 'Choose a brief substitute activity and postpone the decision until it ends.',
  'rescue.environment-escape.title': 'Change the scene',
  'rescue.environment-escape.summary': 'Step away from the immediate cue when moving is available to you.',
  'rescue.environment-escape.step.1': 'Move to a different safe place and stay there for a few minutes.',
  'rescue.human-support.title': 'Reach out for support',
  'rescue.human-support.summary': 'Open a user-controlled support option if you want another person involved.',
  'rescue.human-support.step.1': 'Choose whether you want to start a support action. Nothing is sent automatically.',
  'rescue.recovery-reset.title': 'Reset after use',
  'rescue.recovery-reset.summary': 'Record what happened without punishment and return to the goal you already chose.',
  'rescue.recovery-reset.step.1': 'Take a short reset, keep the current goal unchanged, and decide what would help next.',
} as const satisfies Readonly<Record<string, string>>;

function referencedLocalizationKeys(library: RescueLibrary): string[] {
  const keys = new Set<string>();

  for (const intervention of library.interventions) {
    keys.add(intervention.titleKey);
    keys.add(intervention.summaryKey);
    for (const step of intervention.steps) keys.add(step.copyKey);
    if (intervention.safety.escalationMessageKey) keys.add(intervention.safety.escalationMessageKey);
    for (const prompt of intervention.outcomePrompts) keys.add(prompt.copyKey);
  }

  return [...keys].sort();
}

export function findMissingRescueLocalizationKeys(library: RescueLibrary): string[] {
  return referencedLocalizationKeys(library).filter(
    (key) => !Object.prototype.hasOwnProperty.call(RESCUE_LOCALE_BASELINE, key),
  );
}
