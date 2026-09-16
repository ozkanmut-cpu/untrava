import { describe, expect, it } from 'vitest';
import { BehaviorEventEnvelopeBaseSchema } from '../src/core/events';
import { CoreGoalRecordSchema, ModuleIdSchema } from '../src/core/goals';

describe('domain-neutral Core contracts', () => {
  it('accepts a non-tobacco module goal without a global domain enum', () => {
    expect(ModuleIdSchema.parse('example_behavior')).toBe('example_behavior');

    const goal = CoreGoalRecordSchema.parse({
      goalId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      moduleId: 'example_behavior',
      goalTypeKey: 'custom_goal',
      goalSchemaVersion: 1,
      config: { target: 3 },
      startsAt: '2026-09-16T00:00:00.000Z',
      endsAt: null,
    });

    expect(goal.moduleId).toBe('example_behavior');
    expect(goal.goalTypeKey).toBe('custom_goal');
  });

  it('accepts a non-tobacco module event envelope without interpreting its payload', () => {
    const event = BehaviorEventEnvelopeBaseSchema.parse({
      eventId: '33333333-3333-4333-8333-333333333333',
      userId: '22222222-2222-4222-8222-222222222222',
      deviceId: '44444444-4444-4444-8444-444444444444',
      moduleId: 'example_behavior',
      eventType: 'custom_fact',
      occurredAt: '2026-09-16T00:00:00.000Z',
      recordedAt: '2026-09-16T00:00:01.000Z',
      schemaVersion: 1,
      payload: { arbitraryDomainValue: 42 },
    });

    expect(event.moduleId).toBe('example_behavior');
    expect(event.eventType).toBe('custom_fact');
    expect(event.payload).toEqual({ arbitraryDomainValue: 42 });
  });
});
