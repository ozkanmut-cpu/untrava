import { afterEach, describe, expect, it } from 'vitest';
import type { Goal, QuitProfile } from '@untrava/contracts';
import { buildApp } from '../src/app';
import type { AnonymousIdentity, IdentityRepository } from '../src/modules/identity/service';
import type { ProfileRepository } from '../src/modules/quit-profile/profile.service';

const userId = '550e8400-e29b-41d4-a716-446655440001';
const identityRepository: IdentityRepository = {
  async createAnonymousUser(input): Promise<AnonymousIdentity> { return { userId, sessionId: '650e8400-e29b-41d4-a716-446655440010', deviceId: input.deviceId }; },
  async revokeDeviceSession() { return false; },
};
function profileRepository(): ProfileRepository {
  const goals = new Map<string, Goal>();
  return {
    async saveProfile(profile: QuitProfile) { return profile; },
    async createGoal(goal: Goal) { goals.set(goal.goalId, goal); return goal; },
    async endGoal(ownerId, goalId, endsAt) {
      const goal = goals.get(goalId); if (!goal || goal.userId !== ownerId) return null;
      const ended = { ...goal, endsAt }; goals.set(goalId, ended); return ended;
    },
  };
}
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

describe('quit profile routes', () => {
  it('creates a profile, starts a goal and ends it without deletion', async () => {
    app = await buildApp({ identityRepository, profileRepository: profileRepository() });
    const headers = { 'x-untrava-user-id': userId };
    const profile = await app.inject({ method: 'PUT', url: '/v1/quit-profile', headers, payload: {
      userId, strategy: 'quit_now', products: [{ product: 'cigarette', dailyQuantity: 10 }],
      createdAt: '2026-09-16T00:00:00.000Z', updatedAt: '2026-09-16T00:00:00.000Z',
    } });
    expect(profile.statusCode).toBe(200);
    const goalId = '550e8400-e29b-41d4-a716-446655440020';
    const goal = await app.inject({ method: 'POST', url: '/v1/goals', headers, payload: {
      goalId, userId, type: 'smoke_free', startsAt: '2026-09-16T00:00:00.000Z', endsAt: null,
    } });
    expect(goal.statusCode).toBe(201);
    const ended = await app.inject({ method: 'POST', url: `/v1/goals/${goalId}/end`, headers, payload: { endsAt: '2026-09-20T00:00:00.000Z' } });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().endsAt).toBe('2026-09-20T00:00:00.000Z');
  });
});
