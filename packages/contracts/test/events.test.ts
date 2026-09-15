import { describe, expect, it } from 'vitest';
import { QuitEventEnvelopeSchema, QuitEventTypeSchema } from '../src/index';

const eventId = '550e8400-e29b-41d4-a716-446655440000';
const userId = '550e8400-e29b-41d4-a716-446655440001';
const deviceId = '550e8400-e29b-41d4-a716-446655440002';
const targetEventId = '550e8400-e29b-41d4-a716-446655440003';

const envelope = (eventType: string, payload: unknown) => ({
  eventId,
  userId,
  deviceId,
  eventType,
  occurredAt: '2026-09-15T19:00:00.000Z',
  recordedAt: '2026-09-15T19:00:01.000Z',
  schemaVersion: 1,
  payload,
});

describe('immutable quit event contracts', () => {
  it('exposes the complete foundation event vocabulary', () => {
    expect(QuitEventTypeSchema.options).toEqual([
      'product_use',
      'craving',
      'withdrawal_observation',
      'intervention_started',
      'intervention_completed',
      'intervention_outcome',
      'support_request',
      'notification_response',
      'goal_changed',
      'treatment_adherence',
      'health_context_observation',
      'correction',
      'retraction',
    ]);
  });

  it('accepts product use with a tobacco product and positive quantity', () => {
    expect(
      QuitEventEnvelopeSchema.parse(envelope('product_use', { product: 'vape', quantity: 2 })),
    ).toMatchObject({ eventType: 'product_use', payload: { product: 'vape', quantity: 2 } });

    expect(
      QuitEventEnvelopeSchema.safeParse(envelope('product_use', { product: 'cigarette', quantity: 0 }))
        .success,
    ).toBe(false);
  });

  it('requires correction and retraction events to target an existing event id', () => {
    expect(
      QuitEventEnvelopeSchema.parse(
        envelope('correction', { targetEventId, replacement: { quantity: 1 } }),
      ),
    ).toMatchObject({ eventType: 'correction', payload: { targetEventId } });

    expect(QuitEventEnvelopeSchema.safeParse(envelope('correction', {})).success).toBe(false);
    expect(QuitEventEnvelopeSchema.safeParse(envelope('retraction', {})).success).toBe(false);
  });

  it('keeps treatment adherence separate from tobacco product types', () => {
    expect(
      QuitEventEnvelopeSchema.parse(
        envelope('treatment_adherence', { treatmentKind: 'nrt_patch', status: 'taken' }),
      ),
    ).toMatchObject({
      eventType: 'treatment_adherence',
      payload: { treatmentKind: 'nrt_patch', status: 'taken' },
    });
  });

  it('requires schema version 1', () => {
    expect(QuitEventEnvelopeSchema.safeParse({ ...envelope('craving', {}), schemaVersion: 2 }).success).toBe(
      false,
    );
  });
});
