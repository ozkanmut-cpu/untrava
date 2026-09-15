export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const DEVICE_ID_KEY = 'untrava.device-id';

export async function getOrCreateDeviceId(store: KeyValueStore): Promise<string> {
  const existing = await store.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const deviceId = crypto.randomUUID();
  await store.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}
