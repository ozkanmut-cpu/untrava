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

const forbiddenAlcoholRecoveryAndSafetySymbols = [
  'AlcoholPlanRelationSchema',
  'AlcoholInterventionModeSchema',
  'AlcoholRecoveryNextActionSchema',
  'AlcoholRecoveryReflectionSchema',
  'AlcoholRecoveryContextSchema',
  'AlcoholRecoverySessionStateSchema',
  'AlcoholRecoverySessionSchema',
  'AlcoholRecoveryNextAction',
  'AlcoholInterventionMode',
  'AlcoholRecoveryReflection',
  'AlcoholRecoveryContext',
  'AlcoholRecoverySessionState',
  'AlcoholRecoverySession',
  'WithdrawalEvidenceStateSchema',
  'WithdrawalEvidenceSourceSchema',
  'WithdrawalEvidenceItemSchema',
  'AlcoholChangeIntentSchema',
  'WithdrawalEvidenceKeySchema',
  'WithdrawalRiskEvidenceSchema',
  'WithdrawalSafetyDispositionSchema',
  'WithdrawalSafetyReasonCodeSchema',
  'WithdrawalRiskPolicySchema',
  'WithdrawalSafetyDecisionSchema',
  'WithdrawalEvidenceState',
  'WithdrawalEvidenceItem',
  'AlcoholChangeIntent',
  'WithdrawalEvidenceKey',
  'WithdrawalRiskEvidence',
  'WithdrawalSafetyDisposition',
  'WithdrawalSafetyReasonCode',
  'WithdrawalRiskPolicy',
  'WithdrawalSafetyDecision',
] as const;

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
  'alcohol_withdrawal_risk',
  'previousWithdrawalSeizure',
  ...forbiddenAlcoholRecoveryAndSafetySymbols,
  'doseMg',
  'doseUnit',
  'doseSchedule',
  'taperPlan',
  'prescriptionChange',
  'thiamineDose',
  'benzodiazepineDose',
] as const;

function findForbiddenCoreTokens(source: string): string[] {
  return forbiddenCoreTokens.filter((token) => source.includes(token));
}

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
      expect(findForbiddenCoreTokens(source), `${path} must not contain a forbidden token`).toEqual([]);
    }
  });

  it('rejects every public Alcohol Recovery and Withdrawal Safety symbol in Core source', () => {
    for (const symbol of forbiddenAlcoholRecoveryAndSafetySymbols) {
      expect(findForbiddenCoreTokens(`import { ${symbol} } from '../src/index';`)).toContain(symbol);
    }
  });
});
