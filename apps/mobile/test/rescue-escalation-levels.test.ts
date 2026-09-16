import { describe, expect, it } from 'vitest';
import type { RescueContext, RescueLevel } from '../../../packages/contracts/src/index';
import { createBundledRescueLibrary } from '../src/rescue/library';
import { selectIntervention } from '../src/rescue/selector';
import { RescueSessionCoordinator } from '../src/rescue/session';

const context: RescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-16T05:00:00.000Z',
  goalType: 'smoke_free',
  canMoveEnvironment: true,
  canContactSupport: true,
};

const progression: Array<{ level: RescueLevel; expectedInterventionId: string }> = [
  { level: 'micro', expectedInterventionId: 'micro-regulate' },
  { level: 'guided', expectedInterventionId: 'cbt-reframe' },
  { level: 'environment_escape', expectedInterventionId: 'environment-escape' },
  { level: 'human_support', expectedInterventionId: 'human-support' },
];

const timestamps = [
  ['2026-09-16T05:00:02.000Z', '2026-09-16T05:00:03.000Z', '2026-09-16T05:01:03.000Z', '2026-09-16T05:01:04.000Z'],
  ['2026-09-16T05:01:05.000Z', '2026-09-16T05:01:06.000Z', '2026-09-16T05:03:06.000Z', '2026-09-16T05:03:07.000Z'],
  ['2026-09-16T05:03:08.000Z', '2026-09-16T05:03:09.000Z', '2026-09-16T05:06:09.000Z', '2026-09-16T05:06:10.000Z'],
  ['2026-09-16T05:06:11.000Z', '2026-09-16T05:06:12.000Z', '2026-09-16T05:07:12.000Z', '2026-09-16T05:07:13.000Z'],
] as const;

describe('Rescue escalation levels acceptance', () => {
  it('represents micro → guided → environment_escape → human_support with explicit state transitions', () => {
    const library = createBundledRescueLibrary();
    const rescue = RescueSessionCoordinator.start({
      rescueSessionId: '550e8400-e29b-41d4-a716-446655440023',
      context,
      libraryContentVersion: library.contentVersion,
      now: '2026-09-16T05:00:00.000Z',
    });

    expect(rescue.stabilize('2026-09-16T05:00:01.000Z').state).toBe('stabilizing');

    progression.forEach(({ level, expectedInterventionId }, index) => {
      const selection = selectIntervention(library, context, level);
      if (!selection) throw new Error(`missing_${level}_intervention`);

      const definition = library.interventions.find(
        (intervention) => intervention.interventionId === selection.interventionId && intervention.version === selection.version,
      );

      expect(selection.interventionId).toBe(expectedInterventionId);
      expect(definition?.level).toBe(level);

      const [selectedAt, startedAt, completedAt, nextAt] = timestamps[index];
      expect(rescue.select(selection, selectedAt).state).toBe('intervention_selected');
      expect(rescue.beginSelected(startedAt).state).toBe('intervention_active');
      expect(rescue.completeIntervention(completedAt).state).toBe('reassessing');

      if (level === 'human_support') {
        expect(rescue.requestSupport(nextAt).state).toBe('support_offered');
      } else {
        expect(rescue.reassess({ wantsAnother: true }, nextAt).state).toBe('escalating');
      }
    });
  });
});
