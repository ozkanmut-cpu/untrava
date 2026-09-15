import type { LocalEventDatabase, LocalEventRow } from '../local-event-store';

export interface SQLiteResultRow {
  [column: string]: unknown;
}

export interface SQLiteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T extends SQLiteResultRow>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T extends SQLiteResultRow>(source: string, ...params: (string | number | null)[]): Promise<T[]>;
}

type EventSqlRow = SQLiteResultRow & {
  event_id: string;
  envelope: string;
  sync_state: 'pending' | 'synced' | 'failed';
  attempt_count: number;
  next_attempt_at: string | null;
  synced_at: string | null;
};

export const LOCAL_EVENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS quit_events_local (
  event_id TEXT PRIMARY KEY NOT NULL,
  envelope TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS quit_events_local_pending_idx
  ON quit_events_local(sync_state, next_attempt_at);
`;

function toLocalEventRow(row: EventSqlRow): LocalEventRow {
  return {
    eventId: row.event_id,
    envelope: row.envelope,
    syncState: row.sync_state,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    syncedAt: row.synced_at,
  };
}

export class SQLiteLocalEventDatabase implements LocalEventDatabase {
  private initialized = false;

  constructor(private readonly database: SQLiteDatabase) {}

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.database.execAsync(LOCAL_EVENT_SCHEMA);
    this.initialized = true;
  }

  async get(eventId: string): Promise<LocalEventRow | null> {
    await this.initialize();
    const row = await this.database.getFirstAsync<EventSqlRow>(
      `SELECT event_id, envelope, sync_state, attempt_count, next_attempt_at, synced_at
       FROM quit_events_local WHERE event_id = ?`,
      eventId,
    );
    return row ? toLocalEventRow(row) : null;
  }

  async insert(eventId: string, envelope: string): Promise<void> {
    await this.initialize();
    await this.database.runAsync(
      `INSERT INTO quit_events_local
       (event_id, envelope, sync_state, attempt_count, next_attempt_at, synced_at)
       VALUES (?, ?, 'pending', 0, NULL, NULL)`,
      eventId,
      envelope,
    );
  }

  async listPending(limit: number): Promise<LocalEventRow[]> {
    await this.initialize();
    const rows = await this.database.getAllAsync<EventSqlRow>(
      `SELECT event_id, envelope, sync_state, attempt_count, next_attempt_at, synced_at
       FROM quit_events_local
       WHERE sync_state = 'pending'
       ORDER BY rowid ASC
       LIMIT ?`,
      limit,
    );
    return rows.map(toLocalEventRow);
  }

  async markSynced(eventId: string, syncedAt: string): Promise<void> {
    await this.initialize();
    await this.database.runAsync(
      `UPDATE quit_events_local
       SET sync_state = 'synced', synced_at = ?, next_attempt_at = NULL
       WHERE event_id = ?`,
      syncedAt,
      eventId,
    );
  }
}
