import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

const id = '550e8400-e29b-41d4-a716-446655440000';

type RuntimeSchema = {
  parse: (value: unknown) => unknown;
  safeParse: (value: unknown) => { success: boolean };
};

function schema(name: string): RuntimeSchema {
  const candidate = (contracts as Record<string, unknown>)[name] as RuntimeSchema | undefined;
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as RuntimeSchema;
}

describe('alcohol goal contracts', () => {
  it('exports the five Alcohol V1 goal types', () => {
    const goalType = (contracts as Record<string, unknown>).AlcoholGoalTypeSchema as
      | { options: string[] }
      | undefined;

    expect(goalType).toBeDefined();
    expect(goalType?.options).toEqual([
      'observe_only',
      'abstinence',
      'reduction',
      'alcohol_free_days',
      'usage_limit',
    ]);
  });

  it('uses discriminated goal configs with goal-specific constraints', () => {
    const goalConfig = schema('AlcoholGoalConfigSchema');

    expect(goalConfig.safeParse({ type: 'observe_only' }).success).toBe(true);
    expect(goalConfig.safeParse({ type: 'abstinence' }).success).toBe(true);
    expect(goalConfig.safeParse({ type: 'reduction', targetReductionPercent: 25 }).success).toBe(true);
    expect(goalConfig.safeParse({ type: 'alcohol_free_days', targetDaysPerWeek: 4 }).success).toBe(true);
    expect(
      goalConfig.safeParse({ type: 'usage_limit', period: 'week', maxPureEthanolGrams: 140 }).success,
    ).toBe(true);

    expect(goalConfig.safeParse({ type: 'reduction', targetReductionPercent: 0 }).success).toBe(false);
    expect(goalConfig.safeParse({ type: 'reduction', targetReductionPercent: 101 }).success).toBe(false);
    expect(goalConfig.safeParse({ type: 'alcohol_free_days', targetDaysPerWeek: 0 }).success).toBe(false);
    expect(goalConfig.safeParse({ type: 'alcohol_free_days', targetDaysPerWeek: 8 }).success).toBe(false);
    expect(
      goalConfig.safeParse({ type: 'usage_limit', period: 'day', maxPureEthanolGrams: 0 }).success,
    ).toBe(false);
    expect(
      goalConfig.safeParse({ type: 'usage_limit', period: 'month', maxPureEthanolGrams: 10 }).success,
    ).toBe(false);
  });

  it('pins Alcohol goal records to the alcohol module and matching config type', () => {
    const goalRecord = schema('AlcoholGoalRecordSchema');
    const base = {
      goalId: id,
      userId: id,
      moduleId: 'alcohol',
      goalSchemaVersion: 1,
      startsAt: '2026-09-16T00:00:00.000Z',
      endsAt: null,
    };

    expect(
      goalRecord.safeParse({
        ...base,
        goalTypeKey: 'reduction',
        config: { type: 'reduction', targetReductionPercent: 30 },
      }).success,
    ).toBe(true);

    expect(
      goalRecord.safeParse({
        ...base,
        moduleId: 'tobacco',
        goalTypeKey: 'reduction',
        config: { type: 'reduction', targetReductionPercent: 30 },
      }).success,
    ).toBe(false);

    expect(
      goalRecord.safeParse({
        ...base,
        goalSchemaVersion: 2,
        goalTypeKey: 'reduction',
        config: { type: 'reduction', targetReductionPercent: 30 },
      }).success,
    ).toBe(false);

    expect(
      goalRecord.safeParse({
        ...base,
        goalTypeKey: 'abstinence',
        config: { type: 'reduction', targetReductionPercent: 30 },
      }).success,
    ).toBe(false);
  });
});
