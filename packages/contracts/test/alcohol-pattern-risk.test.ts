import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

interface Schema<T = unknown> {
  parse(value: unknown): T;
}

const patternContracts = contracts as unknown as {
  AlcoholDerivedEvidenceProvenanceSchema?: Schema;
  AlcoholPatternInsightSchema?: Schema;
};

const EVENT_A = '00000000-0000-4000-8000-000000000001';
const EVENT_B = '00000000-0000-4000-8000-000000000002';

const validProvenance = {
  engineId: 'alcohol_pattern_rules',
  ruleSetId: 'alcohol_pattern_rules_v1',
  ruleSetVersion: 1,
  windowStart: '2026-09-10T00:00:00.000Z',
  windowEnd: '2026-09-17T00:00:00.000Z',
  evidenceEventIds: [EVENT_A, EVENT_B],
  confidence: 'medium',
  missingness: 'partial',
  missingInputKeys: ['triggerTags'],
  computedAt: '2026-09-17T01:00:00.000Z',
} as const;

const validPattern = {
  schemaVersion: 1,
  moduleId: 'alcohol',
  insightId: 'pattern-friday-evening',
  insightType: 'day_of_week_concentration',
  direction: 'concentrated',
  strength: 'moderate',
  provenance: validProvenance,
} as const;

describe('Alcohol Pattern/Risk contracts — pattern insight', () => {
  it('exports and parses a valid associative pattern insight', () => {
    expect(patternContracts.AlcoholPatternInsightSchema).toBeDefined();
    if (!patternContracts.AlcoholPatternInsightSchema) {
      throw new Error('AlcoholPatternInsightSchema must be exported');
    }

    expect(patternContracts.AlcoholPatternInsightSchema.parse(validPattern)).toEqual(validPattern);
  });

  it('requires schemaVersion=1 and moduleId=alcohol', () => {
    expect(patternContracts.AlcoholPatternInsightSchema).toBeDefined();
    if (!patternContracts.AlcoholPatternInsightSchema) throw new Error('AlcoholPatternInsightSchema must be exported');

    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({ ...validPattern, schemaVersion: 2 }),
    ).toThrow();
    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({ ...validPattern, moduleId: 'tobacco' }),
    ).toThrow();
  });

  it('rejects an inverted provenance window', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema) {
      throw new Error('AlcoholDerivedEvidenceProvenanceSchema must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        windowStart: '2026-09-18T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects duplicate evidence event ids', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema) {
      throw new Error('AlcoholDerivedEvidenceProvenanceSchema must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        evidenceEventIds: [EVENT_A, EVENT_A],
      }),
    ).toThrow();
  });

  it('keeps missingness and missingInputKeys internally consistent', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema) {
      throw new Error('AlcoholDerivedEvidenceProvenanceSchema must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        missingness: 'none',
        missingInputKeys: ['triggerTags'],
      }),
    ).toThrow();

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        missingness: 'substantial',
        missingInputKeys: [],
      }),
    ).toThrow();
  });

  it('rejects duplicate missing input keys and causal/medical extension fields', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    expect(patternContracts.AlcoholPatternInsightSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema || !patternContracts.AlcoholPatternInsightSchema) {
      throw new Error('Pattern schemas must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        missingInputKeys: ['triggerTags', 'triggerTags'],
      }),
    ).toThrow();

    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({
        ...validPattern,
        causedBy: 'stress',
      }),
    ).toThrow();

    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({
        ...validPattern,
        withdrawalDisposition: 'behavior_change_support_allowed',
      }),
    ).toThrow();
  });
});
