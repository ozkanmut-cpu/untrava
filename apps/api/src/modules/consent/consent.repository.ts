import type { PrismaClient } from '@prisma/client';
import { ConsentActionSchema, ConsentCategorySchema, type ConsentCategory } from '@untrava/contracts';
import { z } from 'zod';
import type { ConsentLedgerEntry, ConsentRecordInput, ConsentRepository } from './consent.service';

const PersistedConsentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  recipientId: z.uuid().nullable(),
  category: ConsentCategorySchema,
  purpose: z.string().min(1),
  action: ConsentActionSchema,
  version: z.number().int().positive(),
  recordedAt: z.date(),
});

export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(input: ConsentRecordInput): Promise<ConsentLedgerEntry> {
    const row = await this.prisma.consentLedgerEntry.create({ data: input });
    return PersistedConsentSchema.parse(row);
  }

  async findLatest(
    userId: string,
    category: ConsentCategory,
    recipientId?: string | null,
  ): Promise<ConsentLedgerEntry | null> {
    const row = await this.prisma.consentLedgerEntry.findFirst({
      where: { userId, category, recipientId: recipientId ?? null },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    });
    return row ? PersistedConsentSchema.parse(row) : null;
  }
}
