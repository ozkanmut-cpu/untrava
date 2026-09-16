import { getOrCreateDeviceId, type KeyValueStore } from './device-identity';
import type { SyncClient } from './sync/sync-client';
import type { SyncQueue } from './sync/sync-queue';
import { SyncWorker } from './sync/sync-worker';

export interface MobileFoundation {
  deviceId: string;
}

export async function createFoundation(store: KeyValueStore): Promise<MobileFoundation> {
  return { deviceId: await getOrCreateDeviceId(store) };
}

export function createSyncWorker(queue: SyncQueue, client: SyncClient): SyncWorker {
  return new SyncWorker(queue, client);
}
