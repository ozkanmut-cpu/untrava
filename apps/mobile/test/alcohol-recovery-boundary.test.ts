import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true; query: '?raw'; import: 'default' },
    ): Record<string, T>;
  }
}

const forbiddenTokens = [
  '/tobacco/',
  '../tobacco',
  'fetch(',
  'axios',
  'openai',
  'chatgpt',
  'XMLHttpRequest',
  'WebSocket',
  'doseMg',
  'doseUnit',
  'doseSchedule',
  'drinkSchedule',
  'taperPlan',
  'prescriptionChange',
  'thiamineDose',
  'benzodiazepineDose',
  'sendSms(',
  'makePhoneCall(',
  'notifySupportCircle(',
  'goal_changed',
] as const;

const forbiddenModuleSpecifierPatterns = [
  /(?:^|\/)(?:pattern|risk|intelligence|navigation|server)(?:\/|$)/,
  /^@react-navigation(?:\/|$)/,
  /^react-navigation(?:\/|$)/,
  /^expo-router(?:\/|$)/,
] as const;

const moduleSpecifierPatterns = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
] as const;

function findForbiddenModuleSpecifiers(source: string): string[] {
  const specifiers = moduleSpecifierPatterns.flatMap((pattern) => (
    Array.from(source.matchAll(pattern), ([, specifier]) => specifier)
  ));

  return specifiers.filter((specifier) => (
    forbiddenModuleSpecifierPatterns.some((pattern) => pattern.test(specifier))
  ));
}

const alcoholRecoverySources = import.meta.glob<string>(
  '../src/alcohol/recovery/*.ts',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
);

describe('Alcohol Recovery architecture boundary', () => {
  it('keeps Tobacco, network, dosage, automated support, and goal mutation tokens out of Recovery source', () => {
    expect(Object.keys(alcoholRecoverySources).length).toBeGreaterThan(0);

    for (const [path, source] of Object.entries(alcoholRecoverySources)) {
      for (const token of forbiddenTokens) {
        expect(source, `${path} must not contain ${token}`).not.toContain(token);
      }
    }
  });

  it('does not import Pattern/Risk, Intelligence, navigation, or server modules', () => {
    expect(Object.keys(alcoholRecoverySources).length).toBeGreaterThan(0);

    for (const [path, source] of Object.entries(alcoholRecoverySources)) {
      expect(findForbiddenModuleSpecifiers(source), `${path} must not import a forbidden module`).toEqual([]);
    }
  });

  it('rejects forbidden modules in static, side-effect, dynamic, and CommonJS imports', () => {
    const forbiddenSpecifiers = [
      '../pattern',
      '../risk',
      '../intelligence',
      '@react-navigation/native',
      'react-navigation',
      'expo-router',
      '../navigation',
      '../server',
    ];
    const importForms = [
      (specifier: string) => `import { unsafe } from '${specifier}';`,
      (specifier: string) => `import '${specifier}';`,
      (specifier: string) => `await import('${specifier}');`,
      (specifier: string) => `require('${specifier}');`,
    ];

    for (const specifier of forbiddenSpecifiers) {
      for (const importForm of importForms) {
        expect(findForbiddenModuleSpecifiers(importForm(specifier))).toContain(specifier);
      }
    }
  });
});
