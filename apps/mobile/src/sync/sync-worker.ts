import type { SyncClient } from './sync-client';
import type { SyncQueue, SyncQueueItem } from './sync-queue';

const MAX_BACKOFF_MS = 15 * 60 * 1000;
const BASE_BACKOFF_MS = 5 * 1000;

export function nextRetryAt(now: string, attemptCount: number): string {
  const delay = Math.min(2 ** attemptCount * BASE_BACKOFF_MS, MAX_BACKOFF_MS);
  return new Date(Date.parse(now) + delay).toISOString();
}

export class SyncWorker {
  constructor(
    private readonly queue: SyncQueue,
    private readonly client: SyncClient,
    private readonly batchSize = 50,
  ) {}

  async runOnce(now: string): Promise<{ synced: number; failed: number }> {
    const due = await this.queue.listDue(now, this.batchSize);
    if (due.length === 0) return { synced: 0, failed: 0 };

    try {
      const response = await this.client.send(due.map((item) => item.event));
      const results = new Map(response.results.map((result) => [result.eventId, result.status]));
      let synced = 0;
      let failed = 0;

      for (const item of due) {
        const status = results.get(item.event.eventId);
        if (status === 'accepted' || status === 'duplicate') {
          await this.queue.markSynced(item.event.eventId, now);
          synced += 1;
        } else {
          await this.scheduleRetry(item, now);
          failed += 1;
        }
      }

      return { synced, failed };
    } catch {
      for (const item of due) await this.scheduleRetry(item, now);
      return { synced: 0, failed: due.length };
    }
  }

  private scheduleRetry(item: SyncQueueItem, now: string): Promise<void> {
    const attemptCount = item.attemptCount + 1;
    return this.queue.markFailed(
      item.event.eventId,
      attemptCount,
      nextRetryAt(now, attemptCount),
    );
  }
}
