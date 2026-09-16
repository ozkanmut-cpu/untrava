import { getOrCreateDeviceId, type KeyValueStore } from './device-identity';
import type { LocalEventStore } from './local-event-store';
import { RescueEventSinkAdapter } from './rescue/events';
import { RescueSessionCoordinator } from './rescue/session';
import {
  RescueSupportCoordinator,
  type SupportActionProvider,
} from './rescue/support';
import {
  createBundledTobaccoRescueLibrary,
  selectTobaccoIntervention,
} from './tobacco/rescue';
import type { SyncClient } from './sync/sync-client';
import type { SyncQueue } from './sync/sync-queue';
import { SyncWorker } from './sync/sync-worker';

export interface MobileFoundation {
  deviceId: string;
}

export interface RescueFoundation {
  library: ReturnType<typeof createBundledTobaccoRescueLibrary>;
  selectIntervention: typeof selectTobaccoIntervention;
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
    library: createBundledTobaccoRescueLibrary(),
    selectIntervention: selectTobaccoIntervention,
    eventSink: new RescueEventSinkAdapter(eventStore, createEventId, now),
    sessionCoordinator: RescueSessionCoordinator,
    support: new RescueSupportCoordinator(supportProvider),
  };
}
