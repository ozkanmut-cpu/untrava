import { describe, expect, it } from 'vitest';
import { SyncBatchRequestSchema, SyncBatchResponseSchema } from '../src/index';

const id = '550e8400-e29b-41d4-a716-446655440000';

describe('sync batch contracts', () => {
  it('validates event batches and ingest results', () => {
    expect(
      SyncBatchRequestSchema.parse({
        events: [
          {
            eventId: id,
            userId: '550e8400-e29b-41d4-a716-446655440001',
            deviceId: '550e8400-e29b-41d4-a716-446655440002',
            eventType: 'craving',
            occurredAt: '2026-09-15T20:00:00.000Z',
            recordedAt: '2026-09-15T20:00:01.000Z',
            schemaVersion: 1,
            payload: {},
          },
        ],
      }).events,
    ).toHaveLength(1);

    expect(
      SyncBatchResponseSchema.parse({ results: [{ eventId: id, status: 'duplicate' }] }),
    ).toEqual({ results: [{ eventId: id, status: 'duplicate' }] });
  });
});
