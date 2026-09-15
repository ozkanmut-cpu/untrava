import { describe, expect, it } from 'vitest';
import { PrismaConsentRepository } from '../src/modules/consent/consent.repository';

const userId = '550e8400-e29b-41d4-a716-446655440001';

describe('PrismaConsentRepository', () => {
  it('appends consent entries and reads the latest matching scope', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const prisma = {
      consentLedgerEntry: {
        async create(args: { data: Record<string, unknown> }) {
          calls.push(args.data);
          return { id: '750e8400-e29b-41d4-a716-446655440001', recordedAt: new Date(1000), ...args.data };
        },
        async findFirst() {
          return { id: '750e8400-e29b-41d4-a716-446655440002', userId, recipientId: null, category: 'support_circle_sharing', purpose: 'support_circle', action: 'revoke', version: 1, recordedAt: new Date(2000) };
        },
      },
    };

    const repository = new PrismaConsentRepository(prisma as never);
    await repository.append({ userId, category: 'support_circle_sharing', purpose: 'support_circle', action: 'grant', version: 1 });
    const latest = await repository.findLatest(userId, 'support_circle_sharing');

    expect(calls).toHaveLength(1);
    expect(latest?.action).toBe('revoke');
  });
});
