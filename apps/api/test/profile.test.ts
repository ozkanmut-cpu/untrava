import { describe, expect, it } from 'vitest';
import type { Goal, QuitProfile } from '@untrava/contracts';
import { ProfileService, type ProfileRepository } from '../src/modules/quit-profile/profile.service';

const userId = '550e8400-e29b-41d4-a716-446655440001';

class MemoryProfileRepository implements ProfileRepository {
  profile?: QuitProfile;
  goals: Goal[] = [];
  async saveProfile(profile: QuitProfile) { this.profile = profile; return profile; }
  async createGoal(goal: Goal) { this.goals.push(goal); return goal; }
  async endGoal(ownerId: string, goalId: string, endsAt: string) {
    const goal = this.goals.find((item) => item.userId === ownerId && item.goalId === goalId);
    if (!goal) return null;
    goal.endsAt = endsAt;
    return goal;
  }
}

describe('ProfileService', () => {
  it('retains product-specific baselines without flattening to cigarettes', async () => {
    const repository = new MemoryProfileRepository();
    const service = new ProfileService(repository);
    const profile = await service.createProfile({
      userId,
      strategy: 'gradual_reduction',
      products: [
        { product: 'cigarette', dailyQuantity: 5 },
        { product: 'vape', dailyQuantity: 12 },
      ],
      createdAt: '2026-09-16T00:00:00.000Z',
      updatedAt: '2026-09-16T00:00:00.000Z',
    });
    expect(profile.products).toEqual([
      { product: 'cigarette', dailyQuantity: 5 },
      { product: 'vape', dailyQuantity: 12 },
    ]);
  });

  it('ends a goal by timestamp instead of deleting history', async () => {
    const repository = new MemoryProfileRepository();
    const service = new ProfileService(repository);
    const goal = await service.startGoal({
      goalId: '550e8400-e29b-41d4-a716-446655440010', userId,
      type: 'smoke_free', startsAt: '2026-09-16T00:00:00.000Z', endsAt: null,
    });
    const ended = await service.endGoal(userId, goal.goalId, '2026-09-20T00:00:00.000Z');
    expect(ended?.endsAt).toBe('2026-09-20T00:00:00.000Z');
    expect(repository.goals).toHaveLength(1);
  });
});
