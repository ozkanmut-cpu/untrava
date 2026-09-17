import { describe, expect, it } from 'vitest';
import { AlcoholRescueContextSchema, AlcoholRescueLibrarySchema } from '../src/index';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';

const validContext = (overrides: Record<string, unknown> = {}) => ({
  userId: USER_ID,
  deviceId: DEVICE_ID,
  startedAt: '2026-09-17T06:40:00.000Z',
  goalType: 'reduction',
  ...overrides,
});

const validIntervention = (overrides: Record<string, unknown> = {}) => ({
  interventionId: 'alcohol-micro-regulate',
  version: 1,
  status: 'active',
  family: 'mindfulness_regulation',
  level: 'micro',
  titleKey: 'alcohol.rescue.micro-regulate.title',
  summaryKey: 'alcohol.rescue.micro-regulate.summary',
  steps: [
    {
      stepId: 'settle-breathe',
      copyKey: 'alcohol.rescue.micro-regulate.step.1',
      actionKind: 'breathing',
      skippable: true,
      durationSeconds: 60,
    },
  ],
  estimatedSeconds: 60,
  burden: 'very_low',
  offlineCapable: true,
  eligibility: { allowedGoalTypes: ['reduction', 'abstinence'] },
  safety: { medicationAdvice: false },
  outcomePrompts: [],
  contentHash: 'fnv1a32:v1:00000000',
  recoveryEligible: false,
  ...overrides,
});

const validLibrary = (interventions: unknown[] = [validIntervention()], overrides: Record<string, unknown> = {}) => ({
  moduleId: 'alcohol',
  libraryId: 'alcohol-rescue',
  schemaVersion: 1,
  contentVersion: 1,
  publishedAt: '2026-09-17T00:00:00.000Z',
  interventions,
  contentHash: 'fnv1a32:v1:00000000',
  ...overrides,
});

describe('Alcohol Rescue contracts', () => {
  it('uses collision-safe Alcohol library identity', () => {
    expect(AlcoholRescueLibrarySchema.parse(validLibrary())).toMatchObject({
      moduleId: 'alcohol',
      libraryId: 'alcohol-rescue',
      schemaVersion: 1,
    });
    expect(AlcoholRescueLibrarySchema.safeParse(validLibrary(undefined, { moduleId: 'tobacco' })).success).toBe(false);
    expect(AlcoholRescueLibrarySchema.safeParse(validLibrary(undefined, { libraryId: 'untrava-rescue' })).success).toBe(false);
  });

  it('accepts Alcohol goals and rejects Tobacco goal keys', () => {
    expect(AlcoholRescueContextSchema.safeParse(validContext({ goalType: 'reduction' })).success).toBe(true);
    expect(AlcoholRescueContextSchema.safeParse(validContext({ goalType: 'smoke_free' })).success).toBe(false);
  });

  it('rejects medication-control extensions', () => {
    const candidate = validLibrary([
      validIntervention({ safety: { medicationAdvice: false, doseMg: 10 } }),
    ]);
    expect(AlcoholRescueLibrarySchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects duplicate intervention identities and duplicate active versions', () => {
    expect(AlcoholRescueLibrarySchema.safeParse(validLibrary([validIntervention(), validIntervention()])).success).toBe(false);
    expect(
      AlcoholRescueLibrarySchema.safeParse(
        validLibrary([
          validIntervention({ version: 1, status: 'active' }),
          validIntervention({ version: 2, status: 'active', contentHash: 'fnv1a32:v1:11111111' }),
        ]),
      ).success,
    ).toBe(false);
  });

  it('requires active interventions to contain at least one step', () => {
    expect(AlcoholRescueLibrarySchema.safeParse(validLibrary([validIntervention({ steps: [] })])).success).toBe(false);
  });

  it('keeps Alcohol eligibility strict and module-owned', () => {
    expect(
      AlcoholRescueLibrarySchema.safeParse(
        validLibrary([validIntervention({ eligibility: { allowedGoalTypes: ['smoke_free'] } })]),
      ).success,
    ).toBe(false);
    expect(
      AlcoholRescueLibrarySchema.safeParse(
        validLibrary([validIntervention({ eligibility: { allowedGoalTypes: ['reduction'], tobaccoProduct: 'vape' } })]),
      ).success,
    ).toBe(false);
  });
});
