import { getOrCreateDeviceId, type KeyValueStore } from './device-identity';
import type { LocalEventStore } from './local-event-store';
import { RescueEventSinkAdapter } from './rescue/events';
import { createBundledRescueLibrary } from './rescue/library';
import { RescueSessionCoordinator } from './rescue/session';
import { selectIntervention } from './rescue/selector';
import {
  RescueSupportCoordinator,
  type SupportActionProvider,
} from './rescue/support';
import type { SyncClient } from './sync/sync-client';
import type { SyncQueue } from './sync/sync-queue';
import { SyncWorker } from './sync/sync-worker';

export interface MobileFoundation {
  deviceId: string;
}

export interface RescueFoundation {
  library: ReturnType<typeof createBundledRescueLibrary>;
  selectIntervention: typeof selectIntervention;
  eventSink: RescueEventSinkAdapter;
  sessionCoordinator: typeof RescueSessionCoordinator;
  support: RescueSupportCoordinator;
}

export async function createFoundation(store: KeyValueStore): Promise<MobileFoundation> {
  return { deviceId: await getOrCreateDeviceId(store) };
}

export function createSyncWorker(queue: SyncQueue, client: SyncClient): SyncWorker {
  return new SyncWorker(queue, client);
}

export function createRescueFoundation(
  eventStore: LocalEventStore,
  createEventId: () => string,
  now: () => string,
  supportProvider?: SupportActionProvider,
): RescueFoundation {
  return {
    library: createBundledRescueLibrary(),
    selectIntervention,
    eventSink: new RescueEventSinkAdapter(eventStore, createEventId, now),
    sessionCoordinator: RescueSessionCoordinator,
    support: new RescueSupportCoordinator(supportProvider),
  };
}
