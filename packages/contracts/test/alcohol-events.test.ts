import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

const id = '550e8400-e29b-41d4-a716-446655440000';

interface RuntimeSchema {
  parse: (value: unknown) => unknown;
  safeParse: (value: unknown) => { success: boolean };
}

function schema(name: string): RuntimeSchema {
  const candidate = (contracts as Record<string, unknown>)[name] as RuntimeSchema | undefined;
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as RuntimeSchema;
}

const eventBase = {
  eventId: id,
  userId: id,
  deviceId: id,
  moduleId: 'alcohol',
  eventType: 'alcohol_use',
  occurredAt: '2026-09-16T17:30:00.000Z',
  recordedAt: '2026-09-16T17:31:00.000Z',
  schemaVersion: 1,
};

describe('alcohol event contracts', () => {
  it('accepts an exact known-ABV alcohol use fact with derived ethanol provenance', () => {
    const event = schema('AlcoholEventEnvelopeSchema');
    const parsed = event.parse({
      ...eventBase,
      payload: {
        beverageCategory: 'beer',
        beverageLabel: 'Lager',
        volumeMl: 500,
        abvPercent: 5,
        quantityConfidence: 'exact',
        entrySource: 'manual',
        planRelation: 'planned',
        pureEthanol: {
          grams: 19.725,
          calculationVersion: 'volume_abv_density_v1',
        },
        socialContext: 'with_others',
        contextTags: ['dinner'],
        triggerTags: ['social'],
      },
    }) as { moduleId: string; payload: { pureEthanol: { grams: number } } };

    expect(parsed.moduleId).toBe('alcohol');
    expect(parsed.payload.pureEthanol.grams).toBeCloseTo(19.725, 3);
  });

  it('allows a use record when ABV is unknown without inventing ethanol grams', () => {
    const event = schema('AlcoholEventEnvelopeSchema');

    expect(
      event.safeParse({
        ...eventBase,
        payload: {
          beverageCategory: 'unknown',
          volumeMl: 250,
          quantityConfidence: 'estimated',
          entrySource: 'repeat_previous',
          planRelation: 'unknown',
        },
      }).success,
    ).toBe(true);
  });

  it('rejects invalid volume, ABV, and inconsistent derived measurement presence', () => {
    const event = schema('AlcoholEventEnvelopeSchema');

    expect(
      event.safeParse({
        ...eventBase,
        payload: {
          beverageCategory: 'wine',
          volumeMl: 0,
          quantityConfidence: 'exact',
          entrySource: 'manual',
          planRelation: 'unplanned',
        },
      }).success,
    ).toBe(false);

    expect(
      event.safeParse({
        ...eventBase,
        payload: {
          beverageCategory: 'spirits',
          volumeMl: 50,
          abvPercent: 101,
          quantityConfidence: 'exact',
          entrySource: 'manual',
          planRelation: 'planned',
          pureEthanol: {
            grams: 39.45,
            calculationVersion: 'volume_abv_density_v1',
          },
        },
      }).success,
    ).toBe(false);

    expect(
      event.safeParse({
        ...eventBase,
        payload: {
          beverageCategory: 'beer',
          volumeMl: 500,
          abvPercent: 5,
          quantityConfidence: 'exact',
          entrySource: 'manual',
          planRelation: 'planned',
        },
      }).success,
    ).toBe(false);

    expect(
      event.safeParse({
        ...eventBase,
        payload: {
          beverageCategory: 'unknown',
          volumeMl: 250,
          quantityConfidence: 'estimated',
          entrySource: 'manual',
          planRelation: 'unknown',
          pureEthanol: {
            grams: 10,
            calculationVersion: 'volume_abv_density_v1',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('pins event module/schema and keeps plan relation factual', () => {
    const event = schema('AlcoholEventEnvelopeSchema');
    const payload = {
      beverageCategory: 'cider',
      volumeMl: 330,
      quantityConfidence: 'estimated',
      entrySource: 'favorite',
      planRelation: 'unplanned',
    };

    expect(event.safeParse({ ...eventBase, payload }).success).toBe(true);
    expect(event.safeParse({ ...eventBase, moduleId: 'tobacco', payload }).success).toBe(false);
    expect(event.safeParse({ ...eventBase, schemaVersion: 2, payload }).success).toBe(false);
    expect(event.safeParse({ ...eventBase, payload: { ...payload, planRelation: 'plan_exceeded' } }).success).toBe(false);
  });

  it('supports immutable correction and retraction references', () => {
    const event = schema('AlcoholEventEnvelopeSchema');

    expect(
      event.safeParse({
        ...eventBase,
        eventType: 'correction',
        payload: { targetEventId: id, replacementVolumeMl: 330 },
      }).success,
    ).toBe(true);

    expect(
      event.safeParse({
        ...eventBase,
        eventType: 'retraction',
        payload: { targetEventId: id, reason: 'duplicate entry' },
      }).success,
    ).toBe(true);
  });
});
