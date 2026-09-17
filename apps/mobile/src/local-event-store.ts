import {
  QuitEventEnvelopeSchema,
  type BehaviorEventEnvelopeBase,
  type QuitEventEnvelope,
} from '../../../packages/contracts/src/index';

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

type LocalEventEnvelope = BehaviorEventEnvelopeBase | QuitEventEnvelope;

interface EnvelopeSchema<TEvent extends LocalEventEnvelope> {
  parse(candidate: unknown): TEvent;
}

export class LocalEventStore<TEvent extends LocalEventEnvelope = QuitEventEnvelope> {
  private readonly schema: EnvelopeSchema<TEvent>;

  constructor(
    private readonly database: LocalEventDatabase,
    schema?: EnvelopeSchema<TEvent>,
  ) {
    this.schema = schema ?? (QuitEventEnvelopeSchema as unknown as EnvelopeSchema<TEvent>);
  }

  async append(candidate: TEvent): Promise<void> {
    const event = this.schema.parse(candidate);
    const envelope = JSON.stringify(event);
    const existing = await this.database.get(event.eventId);
    if (existing) {
      const existingEvent = this.schema.parse(JSON.parse(existing.envelope));
      if (JSON.stringify(existingEvent) === envelope) return;
      throw new Error('conflicting_event_id');
    }
    await this.database.insert(event.eventId, envelope);
  }

  async get(eventId: string): Promise<TEvent | null> {
    const row = await this.database.get(eventId);
    return row ? this.schema.parse(JSON.parse(row.envelope)) : null;
  }

  async listPending(limit: number): Promise<TEvent[]> {
    const rows = await this.database.listPending(limit);
    return rows.map((row) => this.schema.parse(JSON.parse(row.envelope)));
  }

  markSynced(eventId: string, syncedAt: string): Promise<void> {
    return this.database.markSynced(eventId, syncedAt);
  }
}
