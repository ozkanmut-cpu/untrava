import { describe, expect, it } from 'vitest';
import type { QuitEventEnvelope } from '../../../packages/contracts/src/index';
import { SyncWorker } from '../src/sync/sync-worker';
import type { SyncClient } from '../src/sync/sync-client';
import type { SyncQueue, SyncQueueItem } from '../src/sync/sync-queue';

const event: QuitEventEnvelope = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  eventType: 'craving',
  occurredAt: '2026-09-16T03:00:00.000Z',
  recordedAt: '2026-09-16T03:00:01.000Z',
  schemaVersion: 1,
  payload: { intensity: 7 },
};

class MemoryQueue implements SyncQueue {
  item: SyncQueueItem = { event, attemptCount: 0, nextAttemptAt: null };
  synced = false;

  async listDue(now: string) {
    if (this.synced) return [];
    if (this.item.nextAttemptAt && this.item.nextAttemptAt > now) return [];
    return [this.item];
  }

  async markSynced() {
    this.synced = true;
  }

  async markFailed(_eventId: string, attemptCount: number, nextAttemptAt: string) {
    this.item = { ...this.item, attemptCount, nextAttemptAt };
  }
}

class FakeClient implements SyncClient {
  calls = 0;
  fail = false;
  duplicate = false;

  async send(events: QuitEventEnvelope[]) {
    this.calls += 1;
    if (this.fail) throw new Error('offline');
    return {
      results: events.map((item) => ({
        eventId: item.eventId,
        status: this.duplicate ? ('duplicate' as const) : ('accepted' as const),
      })),
    };
  }
}

describe('SyncWorker', () => {
  it('keeps events queued after network failure and syncs them when due on retry', async () => {
    const queue = new MemoryQueue();
    const client = new FakeClient();
    const worker = new SyncWorker(queue, client);
    client.fail = true;

    expect(await worker.runOnce('2026-09-16T03:00:00.000Z')).toEqual({ synced: 0, failed: 1 });
    expect(queue.synced).toBe(false);
    expect(queue.item.attemptCount).toBe(1);
    expect(queue.item.nextAttemptAt).toBe('2026-09-16T03:00:10.000Z');

    client.fail = false;
    expect(await worker.runOnce('2026-09-16T03:00:09.000Z')).toEqual({ synced: 0, failed: 0 });
    expect(await worker.runOnce('2026-09-16T03:00:10.000Z')).toEqual({ synced: 1, failed: 0 });
    expect(queue.synced).toBe(true);
  });

  it('treats a duplicate response after uncertain delivery as synchronized', async () => {
    const queue = new MemoryQueue();
    queue.item = { ...queue.item, attemptCount: 1, nextAttemptAt: null };
    const client = new FakeClient();
    client.duplicate = true;
    const worker = new SyncWorker(queue, client);

    expect(await worker.runOnce('2026-09-16T03:01:00.000Z')).toEqual({ synced: 1, failed: 0 });
    expect(queue.synced).toBe(true);
  });
});
