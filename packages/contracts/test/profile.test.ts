import { describe, expect, it } from 'vitest';
import {
  DeviceIdSchema,
  EventIdSchema,
  GoalSchema,
  GoalTypeSchema,
  ProductTypeSchema,
  QuitProfileSchema,
  QuitStrategySchema,
  UserIdSchema,
} from '../src/index';

const id = '550e8400-e29b-41d4-a716-446655440000';

describe('foundation profile contracts', () => {
  it('accepts UUID identifiers', () => {
    expect(UserIdSchema.parse(id)).toBe(id);
    expect(DeviceIdSchema.parse(id)).toBe(id);
    expect(EventIdSchema.parse(id)).toBe(id);
  });

  it('keeps tobacco products separate from treatment', () => {
    expect(ProductTypeSchema.options).toEqual(['cigarette', 'vape', 'heated_tobacco']);
    expect(ProductTypeSchema.safeParse('nrt').success).toBe(false);
  });

  it('supports the four goal types and four quit strategies', () => {
    expect(GoalTypeSchema.options).toEqual([
      'smoke_free',
      'tobacco_free',
      'nicotine_free',
      'reduction',
    ]);
    expect(QuitStrategySchema.options).toEqual([
      'quit_now',
      'future_date',
      'gradual_reduction',
      'learn_first',
    ]);
  });

  it('validates a product-specific quit profile', () => {
    expect(
      QuitProfileSchema.parse({
        userId: id,
        strategy: 'gradual_reduction',
        products: [
          { product: 'cigarette', dailyQuantity: 12 },
          { product: 'vape', dailyQuantity: 3 },
        ],
      }),
    ).toMatchObject({ userId: id, strategy: 'gradual_reduction' });
  });

  it('validates time-bounded goals without deleting history', () => {
    expect(
      GoalSchema.parse({
        goalId: id,
        userId: id,
        type: 'smoke_free',
        startsAt: '2026-09-15T00:00:00.000Z',
        endsAt: null,
      }),
    ).toMatchObject({ type: 'smoke_free', endsAt: null });
  });
});
