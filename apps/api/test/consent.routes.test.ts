import { afterEach, describe, expect, it } from 'vitest';
import type { ConsentLedgerEntry, ConsentRepository } from '../src/modules/consent/consent.service';
import type { AnonymousIdentity, IdentityRepository } from '../src/modules/identity/service';
import { buildApp } from '../src/app';

const userId = '550e8400-e29b-41d4-a716-446655440001';

const identityRepository: IdentityRepository = {
  async createAnonymousUser(input): Promise<AnonymousIdentity> {
    return {
      userId,
      sessionId: '650e8400-e29b-41d4-a716-446655440010',
      deviceId: input.deviceId,
    };
  },
  async revokeDeviceSession() {
    return false;
  },
};

function memoryRepository(): ConsentRepository {
  const entries: ConsentLedgerEntry[] = [];
  let sequence = 0;
  return {
    async append(input) {
      sequence += 1;
      const entry: ConsentLedgerEntry = {
        ...input,
        id: `750e8400-e29b-41d4-a716-${String(sequence).padStart(12, '0')}`,
        recordedAt: new Date(sequence * 1000),
      };
      entries.push(entry);
      return entry;
    },
    async findLatest(owner, category, recipientId) {
      return entries.filter(
        (entry) =>
          entry.userId === owner &&
          entry.category === category &&
          (entry.recipientId ?? null) === (recipientId ?? null),
      ).at(-1) ?? null;
    },
  };
}

let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

describe('consent routes', () => {
  it('makes a revoke immediately effective', async () => {
    app = await buildApp({ identityRepository, consentRepository: memoryRepository() });
    const headers = { 'x-untrava-user-id': userId };
    const body = {
      category: 'support_circle_sharing',
      purpose: 'support_circle',
      version: 1,
    };

    expect((await app.inject({ method: 'POST', url: '/v1/consents', headers, payload: { ...body, action: 'grant' } })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/v1/consents', headers, payload: { ...body, action: 'revoke' } })).statusCode).toBe(201);

    const effective = await app.inject({
      method: 'GET',
      url: '/v1/consents/effective?category=support_circle_sharing',
      headers,
    });
    expect(effective.statusCode).toBe(200);
    expect(effective.json()).toEqual({ action: 'revoke' });
  });
});
