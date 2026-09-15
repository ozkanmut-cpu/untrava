import type { ConsentAction, ConsentCategory } from '@untrava/contracts';

export interface ConsentRecordInput {
  userId: string;
  recipientId?: string | null;
  category: ConsentCategory;
  purpose: string;
  action: ConsentAction;
  version: number;
}

export interface ConsentLedgerEntry extends ConsentRecordInput {
  id: string;
  recordedAt: Date;
}

export interface ConsentRepository {
  append(input: ConsentRecordInput): Promise<ConsentLedgerEntry>;
  findLatest(
    userId: string,
    category: ConsentCategory,
    recipientId?: string | null,
  ): Promise<ConsentLedgerEntry | null>;
}

export class ConsentService {
  constructor(private readonly repository: ConsentRepository) {}

  record(entry: ConsentRecordInput): Promise<ConsentLedgerEntry> {
    return this.repository.append(entry);
  }

  async getEffective(
    userId: string,
    category: ConsentCategory,
    recipientId?: string | null,
  ): Promise<ConsentAction | null> {
    const latest = await this.repository.findLatest(userId, category, recipientId);
    return latest?.action ?? null;
  }
}
