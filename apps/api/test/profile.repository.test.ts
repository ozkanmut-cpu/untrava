import { describe, expect, it } from 'vitest';
import { PrismaProfileRepository } from '../src/modules/quit-profile/profile.repository';

const userId = '550e8400-e29b-41d4-a716-446655440001';

describe('PrismaProfileRepository', () => {
  it('persists product baselines separately and ends goals without deleting them', async () => {
    let deleted = false;
    const prisma = {
      quitProfile: { async upsert() { return { userId, strategy: 'gradual_reduction', quitDate: null, createdAt: new Date(0), updatedAt: new Date(0), products: [{ product: 'cigarette', dailyQuantity: 5 }, { product: 'vape', dailyQuantity: 12 }] }; } },
      goal: {
        async create({ data }: { data: Record<string, unknown> }) { return { ...data, reductionProduct: null, reductionDailyQuantity: null }; },
        async findFirst() { return { goalId: '550e8400-e29b-41d4-a716-446655440010', userId, type: 'smoke_free', startsAt: new Date(0), endsAt: null, reductionProduct: null, reductionDailyQuantity: null }; },
        async update({ data }: { data: Record<string, unknown> }) { return { goalId: '550e8400-e29b-41d4-a716-446655440010', userId, type: 'smoke_free', startsAt: new Date(0), endsAt: data.endsAt, reductionProduct: null, reductionDailyQuantity: null }; },
        async delete() { deleted = true; },
      },
    };
    const repository = new PrismaProfileRepository(prisma as never);
    const profile = await repository.saveProfile({ userId, strategy: 'gradual_reduction', products: [{ product: 'cigarette', dailyQuantity: 5 }, { product: 'vape', dailyQuantity: 12 }], createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' });
    expect(profile.products).toHaveLength(2);
    await repository.endGoal(userId, '550e8400-e29b-41d4-a716-446655440010', '2026-09-20T00:00:00.000Z');
    expect(deleted).toBe(false);
  });
});
