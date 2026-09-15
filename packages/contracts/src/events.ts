import { z } from 'zod';
import { DeviceIdSchema, EventIdSchema, UserIdSchema } from './ids';
import { ProductTypeSchema } from './profile';

export const QuitEventTypeSchema = z.enum([
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

const EventBaseSchema = z.object({
  eventId: EventIdSchema,
  userId: UserIdSchema,
  deviceId: DeviceIdSchema,
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  schemaVersion: z.literal(1),
});

const GenericPayloadSchema = z.record(z.string(), z.unknown());

const ProductUseEventSchema = EventBaseSchema.extend({
  eventType: z.literal('product_use'),
  payload: z.object({
    product: ProductTypeSchema,
    quantity: z.number().positive(),
  }),
});

const TreatmentAdherenceEventSchema = EventBaseSchema.extend({
  eventType: z.literal('treatment_adherence'),
  payload: z.object({
    treatmentKind: z.string().min(1),
    status: z.string().min(1),
  }),
});

const CorrectionEventSchema = EventBaseSchema.extend({
  eventType: z.literal('correction'),
  payload: z
    .object({
      targetEventId: EventIdSchema,
    })
    .catchall(z.unknown()),
});

const RetractionEventSchema = EventBaseSchema.extend({
  eventType: z.literal('retraction'),
  payload: z
    .object({
      targetEventId: EventIdSchema,
    })
    .catchall(z.unknown()),
});

const genericEvent = (eventType: Exclude<z.infer<typeof QuitEventTypeSchema>,
  'product_use' | 'treatment_adherence' | 'correction' | 'retraction'>) =>
  EventBaseSchema.extend({
    eventType: z.literal(eventType),
    payload: GenericPayloadSchema,
  });

export const QuitEventEnvelopeSchema = z.discriminatedUnion('eventType', [
  ProductUseEventSchema,
  genericEvent('craving'),
  genericEvent('withdrawal_observation'),
  genericEvent('intervention_started'),
  genericEvent('intervention_completed'),
  genericEvent('intervention_outcome'),
  genericEvent('support_request'),
  genericEvent('notification_response'),
  genericEvent('goal_changed'),
  TreatmentAdherenceEventSchema,
  genericEvent('health_context_observation'),
  CorrectionEventSchema,
  RetractionEventSchema,
]);

export type QuitEventType = z.infer<typeof QuitEventTypeSchema>;
export type QuitEventEnvelope = z.infer<typeof QuitEventEnvelopeSchema>;

export interface EventIngestResult {
  eventId: string;
  status: 'accepted' | 'duplicate';
}

export interface SyncBatchRequest {
  events: QuitEventEnvelope[];
}

export interface SyncBatchResponse {
  results: EventIngestResult[];
}
