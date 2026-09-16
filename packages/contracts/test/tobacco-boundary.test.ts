import { describe, expect, it } from 'vitest';
import {
  GoalTypeSchema as LegacyGoalTypeSchema,
  ProductTypeSchema as LegacyProductTypeSchema,
} from '../src/profile';
import { QuitEventEnvelopeSchema as LegacyQuitEventEnvelopeSchema } from '../src/events';
import { RescueContextSchema as LegacyRescueContextSchema } from '../src/rescue';
import {
  GoalTypeSchema as TobaccoGoalTypeSchema,
  ProductTypeSchema as TobaccoProductTypeSchema,
} from '../src/tobacco/profile';
import { QuitEventEnvelopeSchema as TobaccoQuitEventEnvelopeSchema } from '../src/tobacco/events';
import { RescueContextSchema as TobaccoRescueContextSchema } from '../src/tobacco/rescue';

const userId = '11111111-1111-4111-8111-111111111111';
const deviceId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';

describe('Tobacco contract ownership boundary', () => {
  it('owns tobacco product and goal enums while preserving legacy exports', () => {
    expect(TobaccoProductTypeSchema.options).toEqual(['cigarette', 'vape', 'heated_tobacco']);
    expect(TobaccoGoalTypeSchema.options).toEqual([
      'smoke_free',
      'tobacco_free',
      'nicotine_free',
      'reduction',
    ]);
    expect(LegacyProductTypeSchema.options).toEqual(TobaccoProductTypeSchema.options);
    expect(LegacyGoalTypeSchema.options).toEqual(TobaccoGoalTypeSchema.options);
  });

  it('preserves legacy Tobacco event validation', () => {
    const candidate = {
      eventId,
      userId,
      deviceId,
      eventType: 'product_use',
      occurredAt: '2026-09-16T00:00:00.000Z',
      recordedAt: '2026-09-16T00:00:01.000Z',
      schemaVersion: 1,
      payload: { product: 'cigarette', quantity: 1 },
    } as const;

    expect(TobaccoQuitEventEnvelopeSchema.parse(candidate)).toEqual(
      LegacyQuitEventEnvelopeSchema.parse(candidate),
    );
  });

  it('preserves legacy Tobacco Rescue context validation', () => {
    const candidate = {
      userId,
      deviceId,
      startedAt: '2026-09-16T00:00:00.000Z',
      goalType: 'smoke_free',
      productIntent: 'cigarette',
      cravingIntensity: 7,
    } as const;

    expect(TobaccoRescueContextSchema.parse(candidate)).toEqual(
      LegacyRescueContextSchema.parse(candidate),
    );
  });
});
