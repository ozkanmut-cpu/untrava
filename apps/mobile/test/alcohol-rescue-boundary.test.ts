import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true; query: '?raw'; import: 'default' },
    ): Record<string, T>;
  }
}

const forbiddenTobaccoDependencies = [
  '/tobacco/',
  '../tobacco',
  'GoalTypeSchema',
  'ProductTypeSchema',
  'RescueProductIntentSchema',
] as const;

const forbiddenRuntimeDependencies = [
  'fetch(',
  'axios',
  'openai',
  'chatgpt',
  'XMLHttpRequest',
  'WebSocket',
] as const;

const forbiddenControlSurfaces = [
  'doseMg',
  'doseAmount',
  'doseUnit',
  'doseSchedule',
  'drinkSchedule',
  'medicationDose',
  'taperPlan',
  'prescriptionChange',
  'thiamineDose',
  'benzodiazepineDose',
  "actionKind: 'recovery'",
  "actionKind: 'nicotine_replacement'",
  "'cigarette'",
  "'vape'",
  "'heated_tobacco'",
] as const;

const forbiddenAutomaticSupportEffects = [
  'sendSms(',
  'sendSMS(',
  'sendTextMessage(',
  'makePhoneCall(',
  'dialPhone(',
  'notifySupportCircle(',
  'dispatchSupportMessage(',
  "Linking.openURL('sms:",
  "Linking.openURL('tel:",
] as const;

const alcoholRescueSources = import.meta.glob<string>(
  '../src/alcohol/rescue/*.ts',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
);

function expectSourcesNotToContain(tokens: readonly string[]): void {
  expect(Object.keys(alcoholRescueSources).length).toBeGreaterThan(0);

  for (const [path, source] of Object.entries(alcoholRescueSources)) {
    for (const token of tokens) {
      expect(source, `${path} must not contain ${token}`).not.toContain(token);
    }
  }
}

describe('Alcohol Rescue architecture and safety boundary', () => {
  it('does not depend on Tobacco contracts', () => {
    expectSourcesNotToContain(forbiddenTobaccoDependencies);
  });

  it('stays offline and AI-independent', () => {
    expectSourcesNotToContain(forbiddenRuntimeDependencies);
  });

  it('does not expose taper, dose, Recovery, or Tobacco control surfaces', () => {
    expectSourcesNotToContain(forbiddenControlSurfaces);
  });

  it('does not execute automatic support side effects', () => {
    expectSourcesNotToContain(forbiddenAutomaticSupportEffects);
  });
});
