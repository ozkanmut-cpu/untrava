import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

describe('alcohol goal contracts', () => {
  it('exports the five Alcohol V1 goal types', () => {
    const schema = (contracts as Record<string, unknown>).AlcoholGoalTypeSchema as
      | { options: string[] }
      | undefined;

    expect(schema).toBeDefined();
    expect(schema?.options).toEqual([
      'observe_only',
      'abstinence',
      'reduction',
      'alcohol_free_days',
      'usage_limit',
    ]);
  });
});
