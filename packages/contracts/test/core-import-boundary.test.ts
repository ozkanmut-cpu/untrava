import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true; query: '?raw'; import: 'default' },
    ): Record<string, T>;
  }
}

const forbiddenCoreTokens = [
  '/tobacco/',
  '../tobacco',
  'ProductTypeSchema',
  'GoalTypeSchema',
  "'cigarette'",
  "'vape'",
  "'heated_tobacco'",
  "'smoke_free'",
  "'tobacco_free'",
  "'nicotine_free'",
  '/alcohol/',
  '../alcohol',
  'AlcoholGoalTypeSchema',
  "'alcohol'",
  "'observe_only'",
  "'abstinence'",
  "'alcohol_free_days'",
  "'usage_limit'",
] as const;

describe('Core import boundary', () => {
  it('keeps Tobacco and Alcohol imports and domain literals out of Core source', () => {
    const sources = import.meta.glob<string>('../src/core/*.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    });

    expect(Object.keys(sources).length).toBeGreaterThan(0);

    for (const [path, source] of Object.entries(sources)) {
      for (const token of forbiddenCoreTokens) {
        expect(source, `${path} must not contain ${token}`).not.toContain(token);
      }
    }
  });
});
