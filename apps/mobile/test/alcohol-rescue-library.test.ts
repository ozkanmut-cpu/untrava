import { describe, expect, it } from 'vitest';
import {
  ALCOHOL_RESCUE_LIBRARY,
  ALCOHOL_RESCUE_LOCALE_BASELINE,
  findMissingAlcoholRescueLocalizationKeys,
} from '../src/alcohol/rescue';
import {
  hasValidInterventionLibraryIntegrity,
  sealInterventionLibrary,
} from '../src/rescue/library-integrity';

const genericLibrary = () => ({
  moduleId: 'alcohol',
  libraryId: 'alcohol-rescue',
  schemaVersion: 1 as const,
  contentVersion: 1,
  publishedAt: '2026-09-17T00:00:00.000Z',
  interventions: [
    {
      interventionId: 'alcohol-micro-regulate',
      version: 1,
      contentHash: '',
    },
  ],
  contentHash: '',
});

describe('generic intervention library integrity', () => {
  it('seals and validates a domain-neutral intervention library', () => {
    const sealed = sealInterventionLibrary(genericLibrary());

    expect(sealed.contentHash).toMatch(/^fnv1a32:v1:[0-9a-f]{8}$/);
    expect(sealed.interventions[0]?.contentHash).toMatch(/^fnv1a32:v1:[0-9a-f]{8}$/);
    expect(hasValidInterventionLibraryIntegrity(sealed)).toBe(true);
  });

  it('detects tampering in intervention content', () => {
    const sealed = sealInterventionLibrary(genericLibrary());
    const tampered = {
      ...sealed,
      interventions: [{ ...sealed.interventions[0]!, interventionId: 'tampered' }],
    };

    expect(hasValidInterventionLibraryIntegrity(tampered)).toBe(false);
  });
});

describe('bundled Alcohol Rescue library', () => {
  it('contains the approved offline action kinds including Recovery', () => {
    expect(
      new Set(
        ALCOHOL_RESCUE_LIBRARY.interventions.flatMap((item) =>
          item.steps.map((step) => step.actionKind),
        ),
      ),
    ).toEqual(
      new Set([
        'breathing',
        'urge_surfing',
        'delay',
        'substitution',
        'environment_change',
        'cognitive_reframe',
        'human_support',
        'recovery',
      ]),
    );
  });

  it('uses collision-safe identity and valid sealed integrity', () => {
    expect(ALCOHOL_RESCUE_LIBRARY).toMatchObject({
      moduleId: 'alcohol',
      libraryId: 'alcohol-rescue',
      schemaVersion: 1,
      contentVersion: 2,
      publishedAt: '2026-09-17T00:00:00.000Z',
    });
    expect(hasValidInterventionLibraryIntegrity(ALCOHOL_RESCUE_LIBRARY)).toBe(true);
  });

  it('has complete fail-closed localization coverage', () => {
    expect(findMissingAlcoholRescueLocalizationKeys(ALCOHOL_RESCUE_LIBRARY)).toEqual([]);
  });

  it('reports a missing referenced localization key', () => {
    const missingKey = 'alcohol.rescue.missing.step';
    const [first, ...rest] = ALCOHOL_RESCUE_LIBRARY.interventions;
    const candidate = {
      ...ALCOHOL_RESCUE_LIBRARY,
      interventions: [
        {
          ...first!,
          steps: [
            { ...first!.steps[0]!, copyKey: missingKey },
            ...first!.steps.slice(1),
          ],
        },
        ...rest,
      ],
    };

    expect(findMissingAlcoholRescueLocalizationKeys(candidate)).toEqual([
      missingKey,
    ]);
  });

  it('keeps the existing interventions offline, medication-free, and outside Recovery', () => {
    const actionKinds = ALCOHOL_RESCUE_LIBRARY.interventions.flatMap((item) =>
      item.steps.map((step) => step.actionKind),
    );

    expect(ALCOHOL_RESCUE_LIBRARY.interventions).toHaveLength(8);
    expect(ALCOHOL_RESCUE_LIBRARY.interventions.every((item) => item.offlineCapable)).toBe(true);
    expect(
      ALCOHOL_RESCUE_LIBRARY.interventions.every(
        (item) => item.safety.medicationAdvice === false,
      ),
    ).toBe(true);
    const recoveryItems = ALCOHOL_RESCUE_LIBRARY.interventions.filter(
      (item) => item.status === 'active' && item.recoveryEligible,
    );

    expect(recoveryItems).toHaveLength(1);
    expect(recoveryItems[0]).toMatchObject({
      interventionId: 'alcohol-recovery-reset',
      version: 1,
      family: 'behavioral_coping',
      level: 'micro',
      burden: 'very_low',
      offlineCapable: true,
      estimatedSeconds: 60,
      safety: { medicationAdvice: false, requiresHumanSupport: false },
    });
    expect(
      ALCOHOL_RESCUE_LIBRARY.interventions
        .filter((item) => item.interventionId !== 'alcohol-recovery-reset')
        .every((item) => !item.recoveryEligible),
    ).toBe(true);
    expect(recoveryItems[0]?.steps).toHaveLength(2);
    expect(
      recoveryItems[0]?.steps.every(
        (step) => step.skippable && step.actionKind === 'recovery',
      ),
    ).toBe(true);
    expect(actionKinds).toContain('recovery');
  });

  it('provides non-punitive Recovery copy without unsafe guidance or outcome claims', () => {
    const locale: Readonly<Record<string, string>> = ALCOHOL_RESCUE_LOCALE_BASELINE;
    const recovery = ALCOHOL_RESCUE_LIBRARY.interventions.find(
      (item) => item.interventionId === 'alcohol-recovery-reset',
    );
    const copyKeys = [
      recovery?.titleKey,
      recovery?.summaryKey,
      ...(recovery?.steps.map((step) => step.copyKey) ?? []),
    ].filter((key): key is string => Boolean(key));
    const copy = copyKeys.map((key) => locale[key]).join(' ');

    expect(copyKeys).toEqual([
      'alcohol.recovery.reset.title',
      'alcohol.recovery.reset.summary',
      'alcohol.recovery.reset.step.1',
      'alcohol.recovery.reset.step.2',
    ]);
    expect(copy).toContain('without judgment');
    expect(copy).toContain('information, not a verdict');
    expect(copy).not.toMatch(/\b(?:dose|taper|medication|drink schedule)\b/i);
    expect(copy).not.toMatch(/\b(?:guarantee|ensure|will succeed|success)\b/i);
  });

  it('marks support and environment capabilities explicitly', () => {
    const support = ALCOHOL_RESCUE_LIBRARY.interventions.find(
      (item) => item.interventionId === 'alcohol-human-support',
    );
    const environment = ALCOHOL_RESCUE_LIBRARY.interventions.find(
      (item) => item.interventionId === 'alcohol-environment-change',
    );

    expect(support?.eligibility.requiresSupport).toBe(true);
    expect(support?.safety.requiresHumanSupport).toBe(true);
    expect(environment?.eligibility.requiresEnvironmentMove).toBe(true);
  });

  it('keeps human support offer-only and explicitly user-controlled', () => {
    const support = ALCOHOL_RESCUE_LIBRARY.interventions.find(
      (item) => item.interventionId === 'alcohol-human-support',
    );
    const locale: Readonly<Record<string, string>> =
      ALCOHOL_RESCUE_LOCALE_BASELINE;
    const copyKeys = [
      support?.summaryKey,
      ...support!.steps.map((step) => step.copyKey),
    ].filter((key): key is string => Boolean(key));
    const copy = copyKeys.map((key) => locale[key]).join(' ');

    expect(copy).toContain('you remain in control');
    expect(copy).toContain('yourself');
    expect(copy).toContain('Nothing is sent automatically');
  });
});
