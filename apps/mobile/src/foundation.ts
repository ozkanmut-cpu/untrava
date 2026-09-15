import { getOrCreateDeviceId, type KeyValueStore } from './device-identity';

export interface MobileFoundation {
  deviceId: string;
}

export async function createFoundation(store: KeyValueStore): Promise<MobileFoundation> {
  return { deviceId: await getOrCreateDeviceId(store) };
}
