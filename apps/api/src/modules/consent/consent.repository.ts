import type { PrismaClient } from '@prisma/client';
import type { ConsentCategory } from '@untrava/contracts';
import type { ConsentLedgerEntry, ConsentRecordInput, ConsentRepository } from './consent.service';

export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(input: ConsentRecordInput): Promise<ConsentLedgerEntry> {
    return this.prisma.consentLedgerEntry.create({ data: input });
  }

  async findLatest(
    userId: string,
    category: ConsentCategory,
    recipientId?: string | null,
  ): Promise<ConsentLedgerEntry | null> {
    return this.prisma.consentLedgerEntry.findFirst({
      where: { userId, category, recipientId: recipientId ?? null },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    });
  }
}
