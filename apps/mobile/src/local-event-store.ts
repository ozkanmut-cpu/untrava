import { QuitEventEnvelopeSchema, type QuitEventEnvelope } from '../../../packages/contracts/src/index';

export type LocalSyncState = 'pending' | 'synced' | 'failed';

export interface LocalEventRow {
  eventId: string;
  envelope: string;
  syncState: LocalSyncState;
  attemptCount: number;
  nextAttemptAt: string | null;
  syncedAt: string | null;
}

export interface LocalEventDatabase {
  get(eventId: string): Promise<LocalEventRow | null>;
  insert(eventId: string, envelope: string): Promise<void>;
  listPending(limit: number): Promise<LocalEventRow[]>;
  markSynced(eventId: string, syncedAt: string): Promise<void>;
}

export class LocalEventStore {
  constructor(private readonly database: LocalEventDatabase) {}

  async append(candidate: QuitEventEnvelope): Promise<void> {
    const event = QuitEventEnvelopeSchema.parse(candidate);
    const envelope = JSON.stringify(event);
    const existing = await this.database.get(event.eventId);
    if (existing) {
      const existingEvent = QuitEventEnvelopeSchema.parse(JSON.parse(existing.envelope));
      if (JSON.stringify(existingEvent) === envelope) return;
      throw new Error('conflicting_event_id');
    }
    await this.database.insert(event.eventId, envelope);
  }

  async get(eventId: string): Promise<QuitEventEnvelope | null> {
    const row = await this.database.get(eventId);
    return row ? QuitEventEnvelopeSchema.parse(JSON.parse(row.envelope)) : null;
  }

  async listPending(limit: number): Promise<QuitEventEnvelope[]> {
    const rows = await this.database.listPending(limit);
    return rows.map((row) => QuitEventEnvelopeSchema.parse(JSON.parse(row.envelope)));
  }

  markSynced(eventId: string, syncedAt: string): Promise<void> {
    return this.database.markSynced(eventId, syncedAt);
  }
}
