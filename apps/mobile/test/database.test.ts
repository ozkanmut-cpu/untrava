import { describe, expect, it } from 'vitest';
import { LOCAL_EVENT_SCHEMA, SQLiteLocalEventDatabase, type SQLiteDatabase, type SQLiteResultRow } from '../src/db/database';

class FakeSQLite implements SQLiteDatabase {
  execCalls: string[] = [];
  runCalls: Array<{ source: string; params: (string | number | null)[] }> = [];
  firstRow: SQLiteResultRow | null = null;
  allRows: SQLiteResultRow[] = [];

  async execAsync(source: string) { this.execCalls.push(source); }
  async runAsync(source: string, ...params: (string | number | null)[]) { this.runCalls.push({ source, params }); }
  async getFirstAsync<T extends SQLiteResultRow>() { return this.firstRow as T | null; }
  async getAllAsync<T extends SQLiteResultRow>() { return this.allRows as T[]; }
}

describe('SQLiteLocalEventDatabase', () => {
  it('creates the local immutable event table with sync metadata', async () => {
    const sqlite = new FakeSQLite();
    const database = new SQLiteLocalEventDatabase(sqlite);
    await database.get('550e8400-e29b-41d4-a716-446655440000');
    expect(sqlite.execCalls).toEqual([LOCAL_EVENT_SCHEMA]);
    expect(LOCAL_EVENT_SCHEMA).toContain('event_id TEXT PRIMARY KEY');
    expect(LOCAL_EVENT_SCHEMA).toContain('sync_state TEXT');
    expect(LOCAL_EVENT_SCHEMA).toContain('attempt_count INTEGER');
    expect(LOCAL_EVENT_SCHEMA).toContain('next_attempt_at TEXT');
    expect(LOCAL_EVENT_SCHEMA).toContain('synced_at TEXT');
  });

  it('inserts a new event as pending and preserves its serialized envelope', async () => {
    const sqlite = new FakeSQLite();
    const database = new SQLiteLocalEventDatabase(sqlite);
    await database.insert('event-1', '{"eventId":"event-1"}');
    const call = sqlite.runCalls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected insert call');
    expect(call.source).toContain('INSERT INTO quit_events_local');
    expect(call.source).toContain("'pending', 0, NULL, NULL");
    expect(call.params).toEqual(['event-1', '{"eventId":"event-1"}']);
  });

  it('maps persisted sync metadata and marks an event synced without deleting it', async () => {
    const sqlite = new FakeSQLite();
    sqlite.firstRow = {
      event_id: 'event-1',
      envelope: '{"eventId":"event-1"}',
      sync_state: 'pending',
      attempt_count: 2,
      next_attempt_at: '2026-09-16T00:05:00.000Z',
      synced_at: null,
    };
    const database = new SQLiteLocalEventDatabase(sqlite);
    expect(await database.get('event-1')).toEqual({
      eventId: 'event-1',
      envelope: '{"eventId":"event-1"}',
      syncState: 'pending',
      attemptCount: 2,
      nextAttemptAt: '2026-09-16T00:05:00.000Z',
      syncedAt: null,
    });
    await database.markSynced('event-1', '2026-09-16T00:10:00.000Z');
    expect(sqlite.runCalls.at(-1)?.source).toContain("SET sync_state = 'synced'");
    expect(sqlite.runCalls.at(-1)?.params).toEqual(['2026-09-16T00:10:00.000Z', 'event-1']);
  });
});
