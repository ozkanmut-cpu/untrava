import { describe, expect, it } from 'vitest';
import { InterventionLevelSchema } from '../src/index';

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
  'RescueProductIntentSchema',
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
  '/alcohol/safety',
  'WithdrawalRiskEvidenceSchema',
  'WithdrawalSafetyDecisionSchema',
  'alcohol_withdrawal_risk',
  'previousWithdrawalSeizure',
  'doseMg',
  'doseUnit',
  'doseSchedule',
  'taperPlan',
  'prescriptionChange',
  'thiamineDose',
  'benzodiazepineDose',
] as const;

describe('Core import boundary', () => {
  it('exports the generic intervention level contract', () => {
    expect(InterventionLevelSchema.options).toEqual(['micro', 'guided', 'environment_escape', 'human_support']);
  });

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
