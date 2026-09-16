import { QuitEventEnvelopeSchema, type QuitEventEnvelope } from '../../../../packages/contracts/src/index';
import type { SyncEventDatabase } from '../db/database';

export interface SyncQueueItem {
  event: QuitEventEnvelope;
  attemptCount: number;
  nextAttemptAt: string | null;
}

export interface SyncQueue {
  listDue(now: string, limit?: number): Promise<SyncQueueItem[]>;
  markSynced(eventId: string, syncedAt: string): Promise<void>;
  markFailed(eventId: string, attemptCount: number, nextAttemptAt: string): Promise<void>;
}

export class PersistentSyncQueue implements SyncQueue {
  constructor(private readonly database: SyncEventDatabase) {}

  async listDue(now: string, limit = 50): Promise<SyncQueueItem[]> {
    const rows = await this.database.listDue(now, limit);
    return rows.map((row) => ({
      event: QuitEventEnvelopeSchema.parse(JSON.parse(row.envelope)),
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
    }));
  }

  markSynced(eventId: string, syncedAt: string): Promise<void> {
    return this.database.markSynced(eventId, syncedAt);
  }

  markFailed(eventId: string, attemptCount: number, nextAttemptAt: string): Promise<void> {
    return this.database.markFailed(eventId, attemptCount, nextAttemptAt);
  }
}
