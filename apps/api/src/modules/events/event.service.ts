import {
  QuitEventEnvelopeSchema,
  type QuitEventEnvelope,
  type SyncBatchResponse,
} from '@untrava/contracts';

export type EventAppendStatus = 'accepted' | 'duplicate';

export interface EventRepository {
  append(event: QuitEventEnvelope): Promise<EventAppendStatus>;
  findByEventId(eventId: string): Promise<QuitEventEnvelope | null>;
}

export class EventService {
  constructor(private readonly repository: EventRepository) {}

  async ingestBatch(userId: string, events: QuitEventEnvelope[]): Promise<SyncBatchResponse> {
    const results = [];

    for (const candidate of events) {
      const event = QuitEventEnvelopeSchema.parse(candidate);
      if (event.userId !== userId) {
        throw new Error('event user does not match authenticated user');
      }

      if (event.eventType === 'correction' || event.eventType === 'retraction') {
        const target = await this.repository.findByEventId(event.payload.targetEventId);
        if (!target) {
          throw new Error(`${event.eventType} target does not exist`);
        }
        if (target.userId !== userId) {
          throw new Error(`${event.eventType} target belongs to another user`);
        }
      }

      const status = await this.repository.append(event);
      results.push({ eventId: event.eventId, status });
    }

    return { results };
  }
}
