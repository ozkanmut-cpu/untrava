import { z } from 'zod';
import { DeviceIdSchema, EventIdSchema, UserIdSchema } from '../ids';
import { ModuleIdSchema } from './goals';

export const BehaviorEventEnvelopeBaseSchema = z.object({
  eventId: EventIdSchema,
  userId: UserIdSchema,
  deviceId: DeviceIdSchema,
  moduleId: ModuleIdSchema,
  eventType: z.string().min(1),
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  schemaVersion: z.number().int().positive(),
  payload: z.unknown(),
});

export type BehaviorEventEnvelopeBase = z.infer<typeof BehaviorEventEnvelopeBaseSchema>;
