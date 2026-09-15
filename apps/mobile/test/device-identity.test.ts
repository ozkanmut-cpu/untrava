import { describe, expect, it } from 'vitest';
import { getOrCreateDeviceId, type KeyValueStore } from '../src/device-identity';

class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('stable device identity', () => {
  it('creates one UUID and reuses it across launches', async () => {
    const store = new MemoryStore();
    const first = await getOrCreateDeviceId(store);
    const second = await getOrCreateDeviceId(store);

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).toBe(first);
  });
});
