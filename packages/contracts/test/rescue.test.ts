import { describe, expect, it } from 'vitest';
import { RescueLibrarySchema } from '../src/index';

const intervention = (overrides: Record<string, unknown> = {}) => ({
  interventionId: 'micro-breathe',
  version: 1,
  status: 'active',
  family: 'mindfulness_regulation',
  level: 'micro',
  titleKey: 'rescue.micro_breathe.title',
  summaryKey: 'rescue.micro_breathe.summary',
  steps: [
    {
      stepId: 'breathe',
      copyKey: 'rescue.micro_breathe.step.breathe',
      actionKind: 'breathing',
      skippable: true,
      durationSeconds: 60,
    },
  ],
  estimatedSeconds: 60,
  burden: 'very_low',
  offlineCapable: true,
  eligibility: {},
  safety: { medicationAdvice: false },
  outcomePrompts: [],
  contentHash: 'sha256:micro-breathe-v1',
  recoveryEligible: false,
  ...overrides,
});

const library = (interventions: unknown[], overrides: Record<string, unknown> = {}) => ({
  libraryId: 'untrava-rescue',
  schemaVersion: 1,
  contentVersion: 1,
  publishedAt: '2026-09-16T04:40:00.000Z',
  interventions,
  contentHash: 'sha256:library-v1',
  ...overrides,
});

describe('RescueLibrarySchema', () => {
  it('accepts a valid offline Rescue library', () => {
    expect(RescueLibrarySchema.parse(library([intervention()]))).toMatchObject({
      libraryId: 'untrava-rescue',
      schemaVersion: 1,
      contentVersion: 1,
    });
  });

  it('requires schema version 1', () => {
    expect(RescueLibrarySchema.safeParse(library([intervention()], { schemaVersion: 2 })).success).toBe(false);
  });

  it('requires active interventions to have at least one step', () => {
    expect(RescueLibrarySchema.safeParse(library([intervention({ steps: [] })])).success).toBe(false);
  });

  it('requires every intervention to be offline capable', () => {
    expect(RescueLibrarySchema.safeParse(library([intervention({ offlineCapable: false })])).success).toBe(false);
  });

  it('rejects duplicate intervention id/version pairs', () => {
    expect(RescueLibrarySchema.safeParse(library([intervention(), intervention()])).success).toBe(false);
  });

  it('allows historical versions but only one active version per intervention id', () => {
    expect(
      RescueLibrarySchema.safeParse(
        library([
          intervention({ version: 1, status: 'retired' }),
          intervention({ version: 2, status: 'active', contentHash: 'sha256:micro-breathe-v2' }),
        ]),
      ).success,
    ).toBe(true);

    expect(
      RescueLibrarySchema.safeParse(
        library([
          intervention({ version: 1, status: 'active' }),
          intervention({ version: 2, status: 'active', contentHash: 'sha256:micro-breathe-v2' }),
        ]),
      ).success,
    ).toBe(false);
  });
});
