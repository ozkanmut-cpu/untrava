import { describe, expect, it } from 'vitest';
import {
  ConsentService,
  type ConsentLedgerEntry,
  type ConsentRepository,
} from '../src/modules/consent/consent.service';

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
    async findLatest(userId, category, recipientId) {
      return (
        entries
          .filter(
            (entry) =>
              entry.userId === userId &&
              entry.category === category &&
              (entry.recipientId ?? null) === (recipientId ?? null),
          )
          .at(-1) ?? null
      );
    },
  };
}

const userId = '550e8400-e29b-41d4-a716-446655440001';

describe('ConsentService', () => {
  it('uses the latest ledger entry as effective consent', async () => {
    const consent = new ConsentService(memoryRepository());

    await consent.record({
      userId,
      category: 'support_circle_sharing',
      action: 'grant',
      purpose: 'support_circle',
      version: 1,
    });
    await consent.record({
      userId,
      category: 'support_circle_sharing',
      action: 'revoke',
      purpose: 'support_circle',
      version: 1,
    });

    await expect(consent.getEffective(userId, 'support_circle_sharing')).resolves.toBe('revoke');
  });

  it('keeps recipient-scoped consent independent', async () => {
    const consent = new ConsentService(memoryRepository());
    const recipientId = '650e8400-e29b-41d4-a716-446655440001';

    await consent.record({
      userId,
      recipientId,
      category: 'support_circle_sharing',
      action: 'grant',
      purpose: 'support_circle',
      version: 1,
    });

    await expect(
      consent.getEffective(userId, 'support_circle_sharing', recipientId),
    ).resolves.toBe('grant');
    await expect(consent.getEffective(userId, 'support_circle_sharing')).resolves.toBeNull();
  });
});
