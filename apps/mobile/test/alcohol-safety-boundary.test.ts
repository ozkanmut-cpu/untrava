import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true; query: '?raw'; import: 'default' },
    ): Record<string, T>;
  }
}

const forbidden = [
  '/alcohol/safety',
  'WithdrawalRiskEvidence',
  'WithdrawalSafetyDecision',
  'alcohol_withdrawal_risk',
  'previousWithdrawalSeizure',
] as const;

const forbiddenInstructionTokens = [
  'taperPlan',
  'drinkSchedule',
  'medicationDose',
  'doseAmount',
  'doseUnit',
  'doseSchedule',
  'prescriptionChange',
  'thiamineDose',
  'benzodiazepineDose',
] as const;

describe('Alcohol safety module boundary', () => {
  it('keeps Alcohol withdrawal semantics out of generic Rescue and Tobacco source', () => {
    const sources = {
      ...import.meta.glob<string>('../src/rescue/*.ts', {
        eager: true,
        query: '?raw',
        import: 'default',
      }),
      ...import.meta.glob<string>('../src/tobacco/**/*.ts', {
        eager: true,
        query: '?raw',
        import: 'default',
      }),
    };

    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [path, source] of Object.entries(sources)) {
      for (const token of forbidden) {
        expect(source, `${path} must not contain ${token}`).not.toContain(token);
      }
    }
  });

  it('keeps the withdrawal evaluator offline and AI-independent', () => {
    const source = import.meta.glob<string>('../src/alcohol/safety/withdrawal-risk.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    const text = Object.values(source).join('\n');
    expect(text).not.toContain('fetch(');
    expect(text).not.toContain('axios');
    expect(text).not.toContain('OpenAI');
    expect(text).not.toContain('chat.completions');
  });

  it('keeps Alcohol safety runtime free of taper and medication-dosing instruction surfaces', () => {
    const sources = import.meta.glob<string>('../src/alcohol/safety/**/*.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    });

    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [path, source] of Object.entries(sources)) {
      for (const token of forbiddenInstructionTokens) {
        expect(source, `${path} must not contain ${token}`).not.toContain(token);
      }
    }
  });
});
