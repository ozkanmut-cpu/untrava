import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true },
    ): Record<string, T>;
  }
}

interface PolicyModule {
  ALCOHOL_WITHDRAWAL_RISK_POLICY_V1?: {
    engineId: string;
    ruleSetId: string;
    ruleSetVersion: number;
    emergencyEvidenceKeys: readonly string[];
    urgentEvidenceKeys: readonly string[];
    assessmentEvidenceKeys: readonly string[];
  };
  hasValidWithdrawalRiskPolicyIntegrity?: (candidate: unknown) => boolean;
}

function loadPolicyModule(): PolicyModule {
  const modules = import.meta.glob<PolicyModule>('../src/alcohol/safety/policy.ts', { eager: true });
  expect(Object.keys(modules)).toHaveLength(1);
  const module = Object.values(modules)[0];
  if (!module) throw new Error('Alcohol withdrawal policy module must exist');
  return module;
}

describe('Alcohol withdrawal V1 policy', () => {
  it('pins the frozen V1 rule identity and key groups', () => {
    const module = loadPolicyModule();
    expect(module.ALCOHOL_WITHDRAWAL_RISK_POLICY_V1).toBeDefined();
    const policy = module.ALCOHOL_WITHDRAWAL_RISK_POLICY_V1;
    if (!policy) throw new Error('ALCOHOL_WITHDRAWAL_RISK_POLICY_V1 must be exported');
    expect(policy.engineId).toBe('alcohol_withdrawal_risk');
    expect(policy.ruleSetId).toBe('alcohol_withdrawal_risk_v1');
    expect(policy.ruleSetVersion).toBe(1);
    expect(policy.emergencyEvidenceKeys).toEqual([
      'currentSeizure',
      'severeConfusionOrDisorientation',
    ]);
    expect(policy.urgentEvidenceKeys).toEqual([
      'markedAutonomicSymptoms',
      'significantPerceptualDisturbance',
    ]);
  });

  it('detects policy tampering', () => {
    const module = loadPolicyModule();
    const policy = module.ALCOHOL_WITHDRAWAL_RISK_POLICY_V1;
    const validate = module.hasValidWithdrawalRiskPolicyIntegrity;
    expect(policy).toBeDefined();
    expect(validate).toBeDefined();
    if (!policy || !validate) throw new Error('Policy and integrity validator must be exported');
    expect(validate(policy)).toBe(true);
    expect(
      validate({
        ...policy,
        assessmentEvidenceKeys: ['longDurationHeavyRegularUse'],
      }),
    ).toBe(false);
  });
});
